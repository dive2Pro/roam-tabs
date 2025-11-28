import { extension_helper } from "./helper";
import { initExtension } from "./extension";
import { initConfig } from "./config";
import type { RoamExtensionAPI } from "roam-types";

function onload({ extensionAPI }: { extensionAPI: RoamExtensionAPI }) {
  initConfig(extensionAPI);
  initExtension(extensionAPI);
}

function onunload() {
  extension_helper.uninstall();
}

export default {
  onload,
  onunload,
};
