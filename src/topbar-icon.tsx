import { Button, Dialog } from "@blueprintjs/core";
import { useState } from "react";
import ReactDom from "react-dom";
import Extension from "./extension";

import { appendToTopbar, extension_helper } from "./helper";

function TopbarIcon() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        icon="add"
        onClick={() => {
          setOpen((prev) => !prev);
        }}
      />
      <Dialog onClose={() => setOpen((prev) => !prev)} isOpen={open}>
        <Extension />
      </Dialog>
    </>
  );
}

export function initTopbarIcon(extensionAPI: RoamExtensionAPI) {
  const topbarIcon = appendToTopbar("Extension-Name");
  ReactDom.render(<TopbarIcon />, topbarIcon);
  extension_helper.on_uninstall(() => {
    topbarIcon.parentElement.removeChild(topbarIcon);
  });
}
