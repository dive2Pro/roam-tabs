import React from "react";
import { ClientConfig } from "./ClientConfig";
import type { CacheTab, Tab } from "./type";
import { RoamExtensionAPI } from "roam-types";
import { renderApp } from "./stack";
import { renderHorizontalApp } from "./extension";
import { extension_helper } from "./helper";
import {
  globalSwitchCommandOperator,
  renderSwitchCommand,
} from "./SwitchCommand";
import { unwatchAllRoamSections, watchAllRoamSections } from "./hooks/useRememberLastEditedBlock";

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
        removeTab(currentTab.uid);
      }
    },
  });
  API.ui.commandPalette.addCommand({
    label: "Roam Tabs: Close Other Tabs",
    callback: () => {
      const currentTab = loadTabsFromSettings()?.activeTab;
      if (currentTab) {
        removeOtherTabs(currentTab.uid);
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
        (v) => v.uid === currentTab.uid
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
        toggleTabPin(currentTab.uid);
      }
    },
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
    const activeTab = { ...(loadTabsFromSettings()?.activeTab || undefined) };
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
      return userSettings;
    }

    return (
      (API.settings.get(Keys.Tabs) as CacheTab | undefined) ?? {
        tabs: [],
      }
    );
  }

  const uid = userUid();
  if (!uid) {
    return (
      (API.settings.get(Keys.ClientConfig) as CacheTab | undefined) ?? {
        tabs: [],
      }
    );
  }

  if (isClientCanSaveConfig()) {
    try {
      const cacheTab = localStorage.getItem(getSettingsKeyWithUser());
      if (cacheTab) {
        return JSON.parse(cacheTab) as CacheTab;
      }
    } catch (error) {
      console.error("Failed to parse cached tabs from localStorage:", error);
    }
  }

  return getTabsForClient();
}

function getTabsForClient(): CacheTab | undefined {
  return (
    (API.settings.get(Keys.ClientConfig) as CacheTab | undefined) ?? {
      tabs: [],
    }
  );
}

function saveTabsForClientToSettings(tabs: Tab[]): void {
  API.settings.set(Keys.ClientConfig, {
    tabs,
  });
}

export function saveAndRefreshTabs(tabs: Tab[], activeTab?: Tab): void {
  saveTabsToSettings(tabs, activeTab);
  renderAppForConfig();
}

export function removeTab(tabUid: string): void {
  const cacheTab = loadTabsFromSettings();
  const tabs = cacheTab?.tabs || [];
  const tab = tabs.find((tab) => tab.uid === tabUid);
  if (!tab) {
    return;
  }
  const index = tabs.findIndex((tab) => tab.uid === tabUid);

  if (tab.pin) {
    // find first unpin tab
    const unpinTabIndex = tabs.findIndex((tab) => !tab.pin);
    if (unpinTabIndex > -1) {
      saveAndRefreshTabs(tabs, tabs[unpinTabIndex]);
    }
    return;
  }

  const newTabs = tabs.filter((tab) => tab.uid !== tabUid);
  if (cacheTab?.activeTab?.uid !== tabUid) {
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

export function focusOnPageTab(uid: string) {
  const cacheTab = loadTabsFromSettings();
  const tabs = [...(cacheTab?.tabs || [])];
  const tabIndex = tabs.findIndex((tab) => tab.uid === uid);
  if (tabIndex > -1) {
    tabs[tabIndex].blockUid = uid;
    saveAndRefreshTabs(tabs, tabs[tabIndex]);
  }
}
export function focusTab(uid: string) {
  const cacheTab = loadTabsFromSettings();
  const tabs = cacheTab?.tabs || [];
  const tabIndex = tabs.findIndex((tab) => tab.uid === uid);
  if (tabIndex > -1) {
    saveAndRefreshTabs(tabs, tabs[tabIndex]);
    window.roamAlphaAPI.ui.mainWindow.openBlock({
      block: {
        uid: tabs[tabIndex].blockUid || tabs[tabIndex].uid,
      },
    });
  }
}

export function removeOtherTabs(uid: string): void {
  const cacheTab = loadTabsFromSettings();
  const tabs = cacheTab?.tabs || [];
  const lastTab = tabs.find((tab) => tab.uid === uid);
  if (!lastTab) {
    return;
  }
  const newTabs = tabs.filter((tab) => tab.pin || tab.uid === uid);
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
    (t) => t.uid === cacheTab?.activeTab?.uid
  );
  const activeTab =
    currentIndex === -1 || currentIndex > index
      ? newTabs[index]
      : cacheTab?.activeTab;
  saveAndRefreshTabs(newTabs, activeTab);
}

export function toggleTabPin(uid: string): void {
  const cacheTab = loadTabsFromSettings();
  const tabs = cacheTab?.tabs || [];
  const updatedTabs = tabs.map((tab) =>
    tab.uid === uid ? { ...tab, pin: !tab.pin } : tab
  );
  // Sort: pinned tabs first
  const sortedTabs = [
    ...updatedTabs.filter((t) => t.pin),
    ...updatedTabs.filter((t) => !t.pin),
  ];
  const updatedCurrentTab =
    sortedTabs.find((tab) => tab.uid === uid) ||
    (cacheTab?.activeTab?.uid === uid
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
  const cacheTab: CacheTab = {
    tabs,
    ...(activeTab && { activeTab }),
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
