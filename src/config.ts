
const Keys = {
    Auto: 'Auto'
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
                onChange: (evt: {  target: { checked: boolean}}) => { 
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