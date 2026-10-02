import React from "react";
import { ClientConfig } from "./ClientConfig";
import type { CacheTab, Tab, TabSnapshot } from "./type";
import { RoamExtensionAPI } from "roam-types";
import { renderApp } from "./stack";
import { renderHorizontalApp } from "./extension";
import { extension_helper } from "./helper";
import {
  globalSwitchCommandOperator,
  renderSwitchCommand,
} from "./SwitchCommand";
import { unwatchAllRoamSections, watchAllRoamSections } from "./hooks/useRememberLastEditedBlock";
import { clearQueuedRouteIntentNow, queueTabSwitchNavigation } from "./routeIntent";

const Keys = {
  Auto: "Auto",
  Tabs: "Tabs",
  Close: "Close",
  Client: "Client",
  ClientConfig: "ClientConfig",
  ClientCanSaveConfig: "ClientCanSaveConfig",
  TabMode: "TabMode",
  StackPageWidth: "StackPageWidth",
  StackRememberLastEditedBlock: 'StackRememberLastEditedBlock'
};

let API: RoamExtensionAPI;
export function initConfig(extensionAPI: RoamExtensionAPI) {
  API = extensionAPI;
  extensionAPI.ui.commandPalette.addCommand({
    label: "Tabs: Change to Horizontal Mode",
    callback: () => {
      API.settings.set(Keys.TabMode, "horizontal");
      renderAppForConfig();
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Roam Tabs: Change to Stack Mode",
    callback: () => {
      API.settings.set(Keys.TabMode, "stack");
      renderAppForConfig();
    },
  });
  extension_helper.on_uninstall(() => {
    extensionAPI.ui.commandPalette.removeCommand({
      label: "Roam Tabs: Change to Horizontal Mode",
    });

    extensionAPI.ui.commandPalette.removeCommand({
      label: "Roam Tabs: Change to Stack Mode",
    });
  });

  extensionAPI.settings.panel.create({
    tabTitle: "Tabs",
    settings: [
      {
        id: Keys.Auto,
        name: "Auto Mode",
        description:
          "Automatically open links in new tabs",
        action: {
          type: "switch",
          onChange: (evt: { target: { checked: boolean } }) => {
            API.settings.set(Keys.Auto, evt.target.checked);
          },
        },
      },
      {
        id: Keys.TabMode,
        name: "Tab Display Mode",
        description:
          "Choose how tabs are displayed: Horizontal (default) or Stack Mode (pages open to the right, horizontal scrolling)",
        action: {
          type: "select",
          items: ["horizontal", "stack"],
          onChange: (evt: string) => {
            API.settings.set(Keys.TabMode, evt);
            renderAppForConfig();
          },
        },
      },
      {
        id: Keys.StackPageWidth,
        name: "Stack Page Width",
        description: "Set the width of the stack page, default is 650, !",
        action: {
          type: "input",
          placeholder: "650",
          onChange: (evt: { target: { value: string } }) => {
            const value = evt.target.value;
            // console.log("onChange", value, typeof value);

            if (Number(value)) {
              API.settings.set(Keys.StackPageWidth, Number(value));
              renderAppForConfig();
            }
          },
        },
      },
      {
        id: Keys.StackRememberLastEditedBlock,
        name: "Remember Last Edited Block",
        description: "",
        action: {
          type: "switch" as const,
          onChange: (evt: { target: { checked: boolean } }) => {
            API.settings.set(
              Keys.StackRememberLastEditedBlock,
              evt.target.checked
            );
            if (evt.target.checked) {
              watchAllRoamSections()
            } else {
              unwatchAllRoamSections();
            }
          },
        },
      },
      ...(isAdmin()
        ? [
            {
              id: Keys.Client,
              name: "Initial Tabs for Visitors",
              description: "Set initial tabs for collaborators and visitors",
              action: {
                type: "reactComponent" as const,
                component: ({}) => {
                  return (
                    <ClientConfig
                      selected={(getTabsForClient()?.tabs || []).map(
                        (item: Tab) => ({
                          value: item.uid,
                          label: item.title,
                        })
                      )}
                      onSave={(tabs) =>
                        saveTabsForClientToSettings(
                          tabs.map((item) => ({
                            tabId: createTabId(item.value),
                            uid: item.value,
                            title: item.label,
                            blockUid: "",
                            pin: false,
                          }))
                        )
                      }
                    />
                  );
                },
              },
            },
            {
              id: Keys.ClientCanSaveConfig,
              name: "Collaborator Tabs",
              description:
                "When enabled, allows collaborators to save their personal tab state to browser local storage, which will be restored after page refresh",
              action: {
                type: "switch" as const,
                onChange: (evt: { target: { checked: boolean } }) => {
                  API.settings.set(
                    Keys.ClientCanSaveConfig,
                    evt.target.checked
                  );
                },
              },
            },
          ]
        : []),
    ],
  });
  API.ui.commandPalette.addCommand({
    label: "Roam Tabs: Toggle Auto Mode",
    callback: () => {
      const auto = API.settings.get(Keys.Auto) as boolean;
      API.settings.set(Keys.Auto, !auto);
    },
  })
  API.ui.commandPalette.addCommand({
    label: "Roam Tabs: Switch Tab...",
    callback() {
      globalSwitchCommandOperator.open();
    },
  });
  API.ui.commandPalette.addCommand({
    label: "Roam Tabs: Close Current Tab",
    callback: () => {
      const currentTab = loadTabsFromSettings()?.activeTab;
      if (currentTab) {
        removeTab(currentTab.tabId);
      }
    },
  });
  API.ui.commandPalette.addCommand({
    label: "Roam Tabs: Close Other Tabs",
    callback: () => {
      const currentTab = loadTabsFromSettings()?.activeTab;
      if (currentTab) {
        removeOtherTabs(currentTab.tabId);
      }
    },
  });
  API.ui.commandPalette.addCommand({
    label: "Roam Tabs: Close to the right",
    callback: () => {
      const currentTab = loadTabsFromSettings()?.activeTab;
      if (!currentTab) {
        return;
      }
      const index = loadTabsFromSettings()?.tabs.findIndex(
        (v) => v.tabId === currentTab.tabId
      );
      if (index === -1) {
        return;
      }
      removeToTheRightTabs(index);
    },
  });
  API.ui.commandPalette.addCommand({
    label: "Roam Tabs: Pin",
    callback: () => {
      const currentTab = loadTabsFromSettings()?.activeTab;
      if (currentTab) {
        toggleTabPin(currentTab.tabId);
      }
    },
  });
  const onHistoryHotkey = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) {
      return;
    }

    const direction =
      event.code === "BracketLeft" || event.key === "["
        ? "back"
        : event.code === "BracketRight" || event.key === "]"
          ? "forward"
          : undefined;

    if (!direction) {
      return;
    }

    if (!hasActiveTabManagedHistory()) {
      return;
    }

    // Once a tab has managed history, keep Cmd/Ctrl+[ and ] inside that tab.
    // Otherwise the browser-level history can re-open the page we just left
    // and create an A <-> B loop at the tab boundary.
    event.preventDefault();
    event.stopPropagation();

    const canNavigate =
      direction === "back"
        ? canNavigateActiveTabBack()
        : canNavigateActiveTabForward();
    if (!canNavigate) {
      return;
    }

    void (direction === "back"
      ? navigateActiveTabBack()
      : navigateActiveTabForward());
  };
  document.addEventListener("keydown", onHistoryHotkey, true);
  extension_helper.on_uninstall(() => {
    document.removeEventListener("keydown", onHistoryHotkey, true);
  });
  if(isRememberLastEditedBlockInStackMode()) {
    watchAllRoamSections();
  }
  renderAppForConfig();
}

export function isRememberLastEditedBlockInStackMode(): boolean {
  return API.settings.get(Keys.StackRememberLastEditedBlock) === true;
}

export function getStackPageWidth(): number {
  if (!API) {
    return 650;
  }
  // console.log(API);
  return (API.settings.get(Keys.StackPageWidth) as number) || 650;
}

const renderAppForConfig = () => {
  setTimeout(() => {
    toggleAppClass();
    const tabs = [...(loadTabsFromSettings()?.tabs || [])];
    const activeTab = loadTabsFromSettings()?.activeTab
      ? { ...loadTabsFromSettings()?.activeTab! }
      : undefined;
    renderHorizontalApp(tabs, activeTab);
    renderStackApp();
    renderSwitchCommand(tabs, activeTab);
  }, 10);
};

const renderStackApp = () => {
  setTimeout(() => {
    const tabs = loadTabsFromSettings()?.tabs || [];
    const activeTab = loadTabsFromSettings()?.activeTab || undefined;
    const collapsedUids = loadTabsFromSettings()?.collapsedUids || [];

    renderApp(
      API.settings.get(Keys.TabMode),
      tabs,
      activeTab,
      getStackPageWidth(),
      collapsedUids
    );
  });
};

const toggleAppClass = () => {
  const app = document.querySelector(".roam-app");
  if (!app) {
    return;
  }
  if (isStackMode()) {
    app.classList.add("roam-app-stack");
  } else {
    app.classList.remove("roam-app-stack");
  }
};
const isAdmin = (): boolean => {
  return (window.roamAlphaAPI as any).user?.isAdmin() ?? false;
};

const userUid = (): string => {
  return (window.roamAlphaAPI as any).user?.uid() ?? "";
};

function createTabId(seed = ""): string {
  const fallback = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : fallback;
  return seed ? `tab-${seed}-${random}` : `tab-${random}`;
}

function createLegacyTabId(tab: Pick<Tab, "uid" | "blockUid">, index: number) {
  return `legacy-tab-${index}-${tab.uid}-${tab.blockUid || tab.uid}`;
}

function normalizeSnapshot(
  snapshot?: Partial<TabSnapshot>
): TabSnapshot | undefined {
  if (!snapshot?.uid) {
    return undefined;
  }
  return {
    uid: snapshot.uid,
    title: snapshot.title || snapshot.uid,
    blockUid: snapshot.blockUid || snapshot.uid,
  };
}

function normalizeTab(tab?: Partial<Tab>, index = 0): Tab | undefined {
  if (!tab?.uid) {
    return undefined;
  }
  return {
    tabId: tab.tabId || createLegacyTabId(tab as Tab, index),
    uid: tab.uid,
    title: tab.title || tab.uid,
    blockUid: tab.blockUid || tab.uid,
    scrollTop: tab.scrollTop,
    pin: tab.pin ?? false,
    backStack: (tab.backStack || [])
      .map((snapshot) => normalizeSnapshot(snapshot))
      .filter(Boolean) as TabSnapshot[],
    forwardStack: (tab.forwardStack || [])
      .map((snapshot) => normalizeSnapshot(snapshot))
      .filter(Boolean) as TabSnapshot[],
  };
}

function isSameTabPage(left?: Partial<Tab>, right?: Partial<Tab>): boolean {
  if (!left?.uid || !right?.uid) {
    return false;
  }
  return (
    left.uid === right.uid &&
    (left.blockUid || left.uid) === (right.blockUid || right.uid) &&
    (left.title || left.uid) === (right.title || right.uid)
  );
}

function normalizeCacheTab(cacheTab?: CacheTab): CacheTab | undefined {
  if (!cacheTab) {
    return undefined;
  }

  const tabs = (cacheTab.tabs || [])
    .map((tab, index) => normalizeTab(tab, index))
    .filter(Boolean) as Tab[];
  const normalizedActive = normalizeTab(cacheTab.activeTab, tabs.length);
  const activeTab = normalizedActive
    ? tabs.find((tab) => tab.tabId === normalizedActive.tabId) ||
      tabs.find((tab) => isSameTabPage(tab, normalizedActive)) ||
      normalizedActive
    : undefined;

  return {
    tabs,
    ...(activeTab && { activeTab }),
    collapsedUids: cacheTab.collapsedUids || [],
  };
}

function normalizeTabs(tabs: Tab[]): Tab[] {
  return tabs
    .map((tab, index) => normalizeTab(tab, index))
    .filter(Boolean) as Tab[];
}

function resolveActiveTab(tabs: Tab[], activeTab?: Tab): Tab | undefined {
  const normalizedActive = normalizeTab(activeTab, tabs.length);
  if (!normalizedActive) {
    return undefined;
  }
  return (
    tabs.find((tab) => tab.tabId === normalizedActive.tabId) ||
    tabs.find((tab) => isSameTabPage(tab, normalizedActive)) ||
    normalizedActive
  );
}

function getSettingsKeyWithUser(): string {
  const uid = userUid();
  if (!isAdmin()) {
    return `${Keys.ClientConfig}-${uid}`;
  }
  return `${Keys.Tabs}-${uid}`;
}

export function isAutoOpenNewTab(): boolean {
  return API.settings.get(Keys.Auto) === true;
}

export function isClientCanSaveConfig(): boolean {
  return !!API.settings.get(Keys.ClientCanSaveConfig);
}

export function getTabMode(): "horizontal" | "andy" {
  return (
    (API.settings.get(Keys.TabMode) as "horizontal" | "andy") || "horizontal"
  );
}

/**
 * 加载 tabs， isAdmin 时从全局加载，否则从用户加载
 * 如果是用户加载， 如果没有用户， 不保存则是公开页面，
 */
export function loadTabsFromSettings(): CacheTab | undefined {
  if (isAdmin()) {
    // 如果有保存过， 则返回
    const userSettings = API.settings.get(getSettingsKeyWithUser()) as
      | CacheTab
      | undefined;
    if (userSettings) {
      return normalizeCacheTab(userSettings);
    }

    return normalizeCacheTab(
      (API.settings.get(Keys.Tabs) as CacheTab | undefined) ?? {
        tabs: [],
      }
    );
  }

  const uid = userUid();
  if (!uid) {
    return normalizeCacheTab(
      (API.settings.get(Keys.ClientConfig) as CacheTab | undefined) ?? {
        tabs: [],
      }
    );
  }

  if (isClientCanSaveConfig()) {
    try {
      const cacheTab = localStorage.getItem(getSettingsKeyWithUser());
      if (cacheTab) {
        return normalizeCacheTab(JSON.parse(cacheTab) as CacheTab);
      }
    } catch (error) {
      console.error("Failed to parse cached tabs from localStorage:", error);
    }
  }

  return getTabsForClient();
}

function getTabsForClient(): CacheTab | undefined {
  return normalizeCacheTab(
    (API.settings.get(Keys.ClientConfig) as CacheTab | undefined) ?? {
      tabs: [],
    }
  );
}

function saveTabsForClientToSettings(tabs: Tab[]): void {
  API.settings.set(Keys.ClientConfig, {
    tabs: normalizeTabs(tabs),
  });
}

export function saveAndRefreshTabs(tabs: Tab[], activeTab?: Tab): void {
  saveTabsToSettings(tabs, activeTab);
  renderAppForConfig();
}

export function removeTab(tabId: string): void {
  const cacheTab = loadTabsFromSettings();
  const tabs = cacheTab?.tabs || [];
  const tab = tabs.find((tab) => tab.tabId === tabId);
  if (!tab) {
    return;
  }
  const index = tabs.findIndex((tab) => tab.tabId === tabId);

  if (tab.pin) {
    // find first unpin tab
    const unpinTabIndex = tabs.findIndex((tab) => !tab.pin);
    if (unpinTabIndex > -1) {
      saveAndRefreshTabs(tabs, tabs[unpinTabIndex]);
    }
    return;
  }

  const newTabs = tabs.filter((tab) => tab.tabId !== tabId);
  if (cacheTab?.activeTab?.tabId !== tabId) {
    saveAndRefreshTabs(newTabs, cacheTab?.activeTab);
    return;
  }
  const activeTab = newTabs.length
    ? newTabs[Math.min(index, newTabs.length - 1)]
    : undefined;
  saveAndRefreshTabs(newTabs, activeTab);
  setTimeout(() => {
    console.log(` next active `, newTabs, activeTab);
    if (!activeTab) {
      window.roamAlphaAPI.ui.mainWindow.openDailyNotes();
    } else {
      window.roamAlphaAPI.ui.mainWindow.openBlock({
        block: {
          uid: activeTab.blockUid || activeTab.uid,
        },
      });
    }
  }, 100);
}

export function focusOnPageTab(tabId: string) {
  const cacheTab = loadTabsFromSettings();
  const tabs = [...(cacheTab?.tabs || [])];
  const tabIndex = tabs.findIndex((tab) => tab.tabId === tabId);
  if (tabIndex > -1) {
    tabs[tabIndex].blockUid = tabs[tabIndex].uid;
    saveAndRefreshTabs(tabs, tabs[tabIndex]);
  }
}
export function focusTab(tabId: string) {
  const cacheTab = loadTabsFromSettings();
  const tabs = cacheTab?.tabs || [];
  const tabIndex = tabs.findIndex((tab) => tab.tabId === tabId);
  if (tabIndex > -1) {
    const targetTab = tabs[tabIndex];
    const targetUid = getTabNavigationTarget(targetTab);
    const shouldSyncMainWindow = shouldSyncMainWindowToTarget(targetUid);

    saveAndRefreshTabs(tabs, targetTab);

    if (!shouldSyncMainWindow) {
      clearQueuedRouteIntentNow();
      return;
    }

    queueTabSwitchNavigation(tabId, targetUid);
    void ensureMainWindowMatchesTab(targetTab, targetUid);
  }
}

function uidExists(uid?: string): boolean {
  if (!uid) {
    return false;
  }
  const entityId = window.roamAlphaAPI.q(`
[
  :find ?e .
  :where
    [?e :block/uid "${uid}"]
]
`) as unknown as string;
  return !!entityId;
}

function resolveExistingSnapshot(
  snapshot?: TabSnapshot
): TabSnapshot | undefined {
  if (!snapshot?.uid || !uidExists(snapshot.uid)) {
    return undefined;
  }

  if (snapshot.blockUid && uidExists(snapshot.blockUid)) {
    return snapshot;
  }

  return {
    ...snapshot,
    blockUid: snapshot.uid,
  };
}

function trimInvalidHistoryStack(stack: TabSnapshot[] = []): TabSnapshot[] {
  const nextStack = [...stack];
  while (nextStack.length) {
    const top = resolveExistingSnapshot(nextStack[nextStack.length - 1]);
    if (top) {
      nextStack[nextStack.length - 1] = top;
      break;
    }
    nextStack.pop();
  }
  return nextStack;
}

function areHistoryStacksEqual(
  left: TabSnapshot[] = [],
  right: TabSnapshot[] = []
): boolean {
  return (
    left.length === right.length &&
    left.every((snapshot, index) => {
      const other = right[index];
      return (
        snapshot.uid === other?.uid &&
        snapshot.title === other?.title &&
        snapshot.blockUid === other?.blockUid
      );
    })
  );
}

export function snapshotTab(tab?: Tab): TabSnapshot | undefined {
  if (!tab) {
    return undefined;
  }
  return resolveExistingSnapshot({
    uid: tab.uid,
    title: tab.title,
    blockUid: tab.blockUid,
  });
}

export function createOrReuseTab(
  next: TabSnapshot,
  existing?: Tab
): Tab {
  return {
    tabId: existing?.tabId || createTabId(next.uid),
    uid: next.uid,
    title: next.title,
    blockUid: next.blockUid || next.uid,
    scrollTop: existing?.scrollTop,
    pin: existing?.pin ?? false,
    backStack: [...(existing?.backStack || [])],
    forwardStack: [...(existing?.forwardStack || [])],
  };
}

export function replaceTabPage(currentTab: Tab, next: TabSnapshot): Tab {
  const currentSnapshot = snapshotTab(currentTab);
  return {
    ...currentTab,
    ...next,
    pin: currentTab.pin,
    backStack: currentSnapshot
      ? [...(currentTab.backStack || []), currentSnapshot]
      : [...(currentTab.backStack || [])],
    forwardStack: [],
  };
}

export function restoreTabFromHistory(
  currentTab: Tab,
  destinationPageUid: string
): Tab | undefined {
  const currentSnapshot = snapshotTab(currentTab);
  if (!currentSnapshot) {
    return undefined;
  }

  const backStack = trimInvalidHistoryStack(currentTab.backStack || []);
  const backTarget = backStack[backStack.length - 1];
  if (backTarget?.uid === destinationPageUid) {
    return {
      ...currentTab,
      ...backTarget,
      pin: currentTab.pin,
      backStack: backStack.slice(0, -1),
      forwardStack: [...(currentTab.forwardStack || []), currentSnapshot],
    };
  }

  const forwardStack = trimInvalidHistoryStack(currentTab.forwardStack || []);
  const forwardTarget = forwardStack[forwardStack.length - 1];
  if (forwardTarget?.uid === destinationPageUid) {
    return {
      ...currentTab,
      ...forwardTarget,
      pin: currentTab.pin,
      backStack: [...backStack, currentSnapshot],
      forwardStack: forwardStack.slice(0, -1),
    };
  }

  return undefined;
}

function getPreviousSnapshot(currentTab: Tab): TabSnapshot | undefined {
  const backStack = trimInvalidHistoryStack(currentTab.backStack || []);
  return backStack[backStack.length - 1];
}

function getNextSnapshot(currentTab: Tab): TabSnapshot | undefined {
  const forwardStack = trimInvalidHistoryStack(currentTab.forwardStack || []);
  return forwardStack[forwardStack.length - 1];
}

export function findExactTabForSnapshot(
  tabs: Tab[],
  snapshot: TabSnapshot,
  currentTabId?: string
): Tab | undefined {
  const resolvedSnapshot = resolveExistingSnapshot(snapshot);
  if (!resolvedSnapshot) {
    return undefined;
  }

  const targetBlockUid = resolvedSnapshot.blockUid || resolvedSnapshot.uid;

  return tabs.find(
    (tab) =>
      tab.tabId !== currentTabId &&
      tab.uid === resolvedSnapshot.uid &&
      (tab.blockUid || tab.uid) === targetBlockUid
  );
}

function hasManagedHistory(tab?: Tab): boolean {
  if (!tab) {
    return false;
  }
  return (
    trimInvalidHistoryStack(tab.backStack || []).length > 0 ||
    trimInvalidHistoryStack(tab.forwardStack || []).length > 0
  );
}

export function hasActiveTabManagedHistory(): boolean {
  return hasManagedHistory(loadTabsFromSettings()?.activeTab);
}

export function canNavigateActiveTabBack(): boolean {
  const activeTab = loadTabsFromSettings()?.activeTab;
  return !!activeTab && !!getPreviousSnapshot(activeTab);
}

export function canNavigateActiveTabForward(): boolean {
  const activeTab = loadTabsFromSettings()?.activeTab;
  return !!activeTab && !!getNextSnapshot(activeTab);
}

async function applyActiveTabHistoryNavigation(
  direction: "back" | "forward"
): Promise<boolean> {
  const cacheTab = loadTabsFromSettings();
  const currentTab = cacheTab?.activeTab;
  const tabs = cacheTab?.tabs || [];
  if (!currentTab) {
    return false;
  }

  const currentSnapshot = snapshotTab(currentTab);
  const trimmedBackStack = trimInvalidHistoryStack(currentTab.backStack || []);
  const trimmedForwardStack = trimInvalidHistoryStack(
    currentTab.forwardStack || []
  );
  const sanitizedCurrentTab = {
    ...currentTab,
    backStack: trimmedBackStack,
    forwardStack: trimmedForwardStack,
  };
  const historyWasTrimmed =
    !areHistoryStacksEqual(currentTab.backStack || [], trimmedBackStack) ||
    !areHistoryStacksEqual(currentTab.forwardStack || [], trimmedForwardStack);

  const destination =
    direction === "back"
      ? getPreviousSnapshot(sanitizedCurrentTab)
      : getNextSnapshot(sanitizedCurrentTab);
  if (!destination) {
    if (historyWasTrimmed) {
      const updatedTabs = tabs.map((tab) =>
        tab.tabId === currentTab.tabId ? sanitizedCurrentTab : tab
      );
      saveAndRefreshTabs(updatedTabs, sanitizedCurrentTab);
    }
    return false;
  }

  const existingTab = findExactTabForSnapshot(
    tabs,
    destination,
    currentTab.tabId
  );
  if (existingTab) {
    if (historyWasTrimmed) {
      const updatedTabs = tabs.map((tab) =>
        tab.tabId === currentTab.tabId ? sanitizedCurrentTab : tab
      );
      saveAndRefreshTabs(updatedTabs, existingTab);
      await ensureMainWindowMatchesTab(existingTab);
      return true;
    }
    focusTab(existingTab.tabId);
    return true;
  }

  const updatedTab =
    direction === "back"
      ? {
          ...sanitizedCurrentTab,
          ...destination,
          pin: sanitizedCurrentTab.pin,
          backStack: (sanitizedCurrentTab.backStack || []).slice(0, -1),
          forwardStack: currentSnapshot
            ? [...(sanitizedCurrentTab.forwardStack || []), currentSnapshot]
            : [...(sanitizedCurrentTab.forwardStack || [])],
        }
      : {
          ...sanitizedCurrentTab,
          ...destination,
          pin: sanitizedCurrentTab.pin,
          backStack: currentSnapshot
            ? [...(sanitizedCurrentTab.backStack || []), currentSnapshot]
            : [...(sanitizedCurrentTab.backStack || [])],
          forwardStack: (sanitizedCurrentTab.forwardStack || []).slice(0, -1),
        };

  const updatedTabs = tabs.map((tab) =>
    tab.tabId === currentTab.tabId ? updatedTab : tab
  );

  saveAndRefreshTabs(updatedTabs, updatedTab);
  await ensureMainWindowMatchesTab(updatedTab);
  return true;
}

export function navigateActiveTabBack(): Promise<boolean> {
  return applyActiveTabHistoryNavigation("back");
}

export function navigateActiveTabForward(): Promise<boolean> {
  return applyActiveTabHistoryNavigation("forward");
}

let syncingMainWindowTarget: string | null = null;

function getTabNavigationTarget(tab?: Tab): string | undefined {
  if (!tab) {
    return undefined;
  }

  return (
    (tab.blockUid && uidExists(tab.blockUid) && tab.blockUid) ||
    (uidExists(tab.uid) && tab.uid) ||
    undefined
  );
}

function getContainingPageUid(uid?: string): string | undefined {
  if (!uid || !uidExists(uid)) {
    return undefined;
  }
  const pageUid = window.roamAlphaAPI.q(`
[
    :find ?e .
    :where
     [?b :block/uid "${uid}"]
     [?b :block/page ?p]
     [?p :block/uid ?e]
]
  `) as unknown as string;
  return pageUid || uid;
}

function shouldSyncMainWindowToTarget(targetUid?: string): boolean {
  if (!targetUid) {
    return false;
  }

  const currentOpenUid = window.roamAlphaAPI.ui.mainWindow.getOpenPageOrBlockUid();
  const targetPageUid = getContainingPageUid(targetUid);
  const currentPageUid = getContainingPageUid(currentOpenUid);

  if (currentOpenUid === targetUid) {
    return false;
  }

  if (targetUid === targetPageUid && currentPageUid === targetPageUid) {
    return false;
  }

  if (syncingMainWindowTarget === targetUid) {
    return false;
  }

  return true;
}

export async function ensureMainWindowMatchesTab(
  tab?: Tab,
  resolvedTargetUid = getTabNavigationTarget(tab)
): Promise<void> {
  if (!shouldSyncMainWindowToTarget(resolvedTargetUid)) {
    return;
  }

  syncingMainWindowTarget = resolvedTargetUid;
  try {
    await window.roamAlphaAPI.ui.mainWindow.openBlock({
      block: {
        uid: resolvedTargetUid,
      },
    });
  } finally {
    setTimeout(() => {
      if (syncingMainWindowTarget === resolvedTargetUid) {
        syncingMainWindowTarget = null;
      }
    }, 0);
  }
}

export function removeOtherTabs(tabId: string): void {
  const cacheTab = loadTabsFromSettings();
  const tabs = cacheTab?.tabs || [];
  const lastTab = tabs.find((tab) => tab.tabId === tabId);
  if (!lastTab) {
    return;
  }
  const newTabs = tabs.filter((tab) => tab.pin || tab.tabId === tabId);
  saveAndRefreshTabs(newTabs, lastTab);
}

export function removeToTheRightTabs(index: number): void {
  const cacheTab = loadTabsFromSettings();
  const tabs = cacheTab?.tabs || [];
  const newTabs = [
    ...tabs.slice(0, index + 1),
    ...tabs.slice(index + 1).filter((t) => t.pin),
  ];
  const currentIndex = newTabs.findIndex(
    (t) => t.tabId === cacheTab?.activeTab?.tabId
  );
  const activeTab =
    currentIndex === -1 || currentIndex > index
      ? newTabs[index]
      : cacheTab?.activeTab;
  saveAndRefreshTabs(newTabs, activeTab);
}

export function toggleTabPin(tabId: string): void {
  const cacheTab = loadTabsFromSettings();
  const tabs = cacheTab?.tabs || [];
  const updatedTabs = tabs.map((tab) =>
    tab.tabId === tabId ? { ...tab, pin: !tab.pin } : tab
  );
  // Sort: pinned tabs first
  const sortedTabs = [
    ...updatedTabs.filter((t) => t.pin),
    ...updatedTabs.filter((t) => !t.pin),
  ];
  const updatedCurrentTab =
    sortedTabs.find((tab) => tab.tabId === tabId) ||
    (cacheTab?.activeTab?.tabId === tabId
      ? { ...cacheTab.activeTab, pin: !cacheTab.activeTab.pin }
      : cacheTab?.activeTab);
  saveAndRefreshTabs(sortedTabs, updatedCurrentTab);
}

export function saveTabsToSettings(tabs: Tab[], activeTab?: Tab): void {
  // 非用户，不保存
  const uid = userUid();
  if (!uid) {
    return;
  }

  const prev = loadTabsFromSettings();
  const normalizedTabs = normalizeTabs(tabs);
  const resolvedActiveTab = resolveActiveTab(normalizedTabs, activeTab);
  const cacheTab: CacheTab = {
    tabs: normalizedTabs,
    ...(resolvedActiveTab && { activeTab: resolvedActiveTab }),
    collapsedUids: prev?.collapsedUids || [],
  };

  if (isAdmin()) {
    API.settings.set(getSettingsKeyWithUser(), cacheTab);
    return;
  }

  if (isClientCanSaveConfig()) {
    try {
      localStorage.setItem(getSettingsKeyWithUser(), JSON.stringify(cacheTab));
    } catch (error) {
      console.error("Failed to save tabs to localStorage:", error);
    }
  }
}

export function isStackMode(): boolean {
  return API.settings.get(Keys.TabMode) === "stack";
}

export function getCollapsedUids(): string[] {
  return loadTabsFromSettings()?.collapsedUids || [];
}

export function setCollapsedUids(uids: string[]): void {
  const uid = userUid();
  if (!uid) return;
  const prev = loadTabsFromSettings() || { tabs: [] };
  const cacheTab: CacheTab = {
    tabs: prev.tabs || [],
    ...(prev.activeTab && { activeTab: prev.activeTab }),
    collapsedUids: uids,
  };
  if (isAdmin()) {
    API.settings.set(getSettingsKeyWithUser(), cacheTab);
    renderAppForConfig();
    return;
  }
  if (isClientCanSaveConfig()) {
    try {
      localStorage.setItem(getSettingsKeyWithUser(), JSON.stringify(cacheTab));
      renderAppForConfig();
    } catch (error) {
      console.error("Failed to save collapsedUids to localStorage:", error);
    }
  }
}
