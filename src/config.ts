
const Keys = {
    Auto: 'Auto',
    Tabs: 'Tabs',
}

let API: RoamExtensionAPI;
export function initConfig(extensionAPI: RoamExtensionAPI) {
    API = extensionAPI
    extensionAPI.settings.panel.create({
        tabTitle: 'Tabs',
        settings: [{
            id: Keys.Auto,
            name: 'Auto Mode',
            description: 'Automatically open links in new tabs',
            action: {
                type: "switch",
                onChange: (evt: { target: { checked: boolean } }) => {
                    console.log(evt, ' ----@@@')
                    API.settings.set(Keys.Auto, evt.target.checked);
                }
            }
        }]
    })
}

export function isAutoOpenNewTab() {
    return API.settings.get(Keys.Auto) === true;
}

type CacheTab = { tabs: Tab[], activeTab: string };

export function loadTabsFromSettings(): CacheTab {
    return (API.settings.get(Keys.Tabs) as CacheTab)
}

export function saveTabsToSettings(tabs: Tab[], activeTab: string) {
    API.settings.set(Keys.Tabs, {
        tabs,
        activeTab
    })
}