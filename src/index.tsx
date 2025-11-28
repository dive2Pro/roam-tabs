import { extension_helper } from "./helper";
import { initConfig } from "./config";
import type { RoamExtensionAPI } from "roam-types";

function onload({ extensionAPI }: { extensionAPI: RoamExtensionAPI }) {
  initConfig(extensionAPI);
}

function onunload() {
  extension_helper.uninstall();
}

export default {
  onload,
  onunload,
};
