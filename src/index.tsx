import { extension_helper } from "./helper";
import { initExtension } from "./extension";
import { initConfig } from "./config";

function onload({ extensionAPI }: { extensionAPI: RoamExtensionAPI }) {
  initConfig(extensionAPI);
  initExtension();
}

function onunload() {
  extension_helper.uninstall();
}

export default {
  onload,
  onunload,
};
