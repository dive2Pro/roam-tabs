import React from "react";
import { ClientConfig } from "./ClientConfig";
import type { CacheTab, Tab } from "./type";
import { RoamExtensionAPI } from "roam-types";
import { renderApp } from "./stack";
import { initExtension } from "./extension";
import { extension_helper } from "./helper";

const Keys = {
  Auto: "Auto",
  Tabs: "Tabs",
  Close: "Close",
  Client: "Client",
  ClientConfig: "ClientConfig",
  ClientCanSaveConfig: "ClientCanSaveConfig",
  TabMode: "TabMode",
  StackPageWidth: "StackPageWidth",
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
    label: "Tabs: Change to Stack Mode",
    callback: () => {
      API.settings.set(Keys.TabMode, "stack");
      renderAppForConfig();
    },
  });
  extension_helper.on_uninstall(() => {
    extensionAPI.ui.commandPalette.removeCommand({
      label: "Tabs: Change to Horizontal Mode",
    });

    extensionAPI.ui.commandPalette.removeCommand({
      label: "Tabs: Change to Stack Mode",
    });
  });

  extensionAPI.settings.panel.create({
    tabTitle: "Tabs",
    settings: [
      {
        id: Keys.Auto,
        name: "Auto Mode",
        description:
          "Automatically open links in new tabs, only works in horizontal mode",
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
            console.log("onChange", value, typeof value);

            if (Number(value)) {
              API.settings.set(Keys.StackPageWidth, Number(value));
              renderAppForConfig();
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
  renderAppForConfig();
}

export function getStackPageWidth(): number {
  if (!API) {
    return 650;
  }
  console.log(API);
  return (API.settings.get(Keys.StackPageWidth) as number) || 650;
}

const renderAppForConfig = () => {
  setTimeout(() => {
    toggleAppClass();
    initExtension(API);
    renderStackApp();
  }, 10);
};

const renderStackApp = () => {
  setTimeout(() => {
    const tabs = loadTabsFromSettings()?.tabs || [];
    const activeTab = loadTabsFromSettings()?.activeTab || undefined;

    renderApp(
      API.settings.get(Keys.TabMode),
      API,
      tabs,
      activeTab,
      getStackPageWidth()
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
  renderStackApp();
}

export function removeTab(tabUid: string): void {
  const cacheTab = loadTabsFromSettings();
  const tabs = cacheTab?.tabs || [];
  const newTabs = tabs.filter((tab) => tab.uid !== tabUid);
  if (cacheTab?.activeTab?.uid !== tabUid) {
    saveTabsToSettings(newTabs);
    renderStackApp();
    return;
  }
  const activeTab = newTabs.length ? newTabs[newTabs.length - 1] : undefined;
  saveTabsToSettings(newTabs, activeTab);
  renderStackApp();
  if (!activeTab) {
    window.roamAlphaAPI.ui.mainWindow.openDailyNotes();
  } else {
    window.roamAlphaAPI.ui.mainWindow.openBlock({
      block: {
        uid: activeTab.blockUid || activeTab.uid,
      },
    });
  }
}

export function focusOnPageTab(uid: string) {
  const cacheTab = loadTabsFromSettings();
  const tabs = [...(cacheTab?.tabs || [])];
  const tabIndex = tabs.findIndex((tab) => tab.uid === uid);
  if (tabIndex > -1) {
    tabs[tabIndex].blockUid = uid;
    saveTabsToSettings(tabs, tabs[tabIndex]);
    renderStackApp();
  }
}
export function focusTab(uid: string) {
  const cacheTab = loadTabsFromSettings();
  const tabs = cacheTab?.tabs || [];
  const tabIndex = tabs.findIndex((tab) => tab.uid === uid);
  if (tabIndex > -1) {
    saveTabsToSettings(tabs, tabs[tabIndex]);
    renderStackApp();
    window.roamAlphaAPI.ui.mainWindow.openBlock({
      block: {
        uid: tabs[tabIndex].blockUid || tabs[tabIndex].uid,
      },
    });
  }
}

export function saveTabsToSettings(tabs: Tab[], activeTab?: Tab): void {
  // 非用户，不保存
  const uid = userUid();
  if (!uid) {
    return;
  }

  const cacheTab: CacheTab = {
    tabs,
    ...(activeTab && { activeTab }),
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
