import React from "react";
import { ClientConfig } from "./ClientConfig";
import type { CacheTab, Tab, RoamExtensionAPI } from "./type";

const Keys = {
  Auto: "Auto",
  Tabs: "Tabs",
  Close: "Close",
  Client: "Client",
  ClientConfig: "ClientConfig",
  ClientCanSaveConfig: "ClientCanSaveConfig",
};

let API: RoamExtensionAPI;
export function initConfig(extensionAPI: RoamExtensionAPI) {
  API = extensionAPI;
  extensionAPI.settings.panel.create({
    tabTitle: "Tabs",
    settings: [
      {
        id: Keys.Auto,
        name: "Auto Mode",
        description: "Automatically open links in new tabs",
        action: {
          type: "switch",
          onChange: (evt: { target: { checked: boolean } }) => {
            API.settings.set(Keys.Auto, evt.target.checked);
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
                type: "reactComponent",
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
                type: "switch",
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
}

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
