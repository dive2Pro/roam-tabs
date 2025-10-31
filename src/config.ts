const Keys = {
  Auto: "Auto",
  Tabs: "Tabs",
  Close: "Close",
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
            console.log(evt, " ----@@@");
            API.settings.set(Keys.Auto, evt.target.checked);
          },
        },
      },
    ],
  });
}

function getSettingsKeyWithUser() {
  // @ts-ignore
  return `${Keys.Tabs}-${window.roamAlphaAPI.user.uid()}`
}

export function isAutoOpenNewTab() {
  return API.settings.get(Keys.Auto) === true;
}

type CacheTab = { tabs: Tab[]; activeTab: Tab };

export function loadTabsFromSettings(): CacheTab {
  if(API.settings.get(getSettingsKeyWithUser())) {
    return API.settings.get(getSettingsKeyWithUser()) as CacheTab;
  }
  return API.settings.get(Keys.Tabs) as CacheTab;
}

export function saveTabsToSettings(tabs: Tab[], activeTab: Tab) {
  API.settings.set(getSettingsKeyWithUser(), {
    tabs,
    activeTab,
  });
}
