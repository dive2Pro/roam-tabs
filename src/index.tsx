import { extension_helper } from "./helper";
import { initExtension } from "./extension";
import { initTopbarIcon } from "./topbar-icon";

function onload({ extensionAPI }: { extensionAPI: RoamExtensionAPI }) {
  initTopbarIcon(extensionAPI);
  initExtension();
}

function onunload() {
  extension_helper.uninstall();
}

export default {
  onload,
  onunload,
};
