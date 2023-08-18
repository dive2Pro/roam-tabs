let uninstalls: Function[] = [];

export const extension_helper = {
  on_uninstall: (cb: Function) => {
    uninstalls.push(cb);
  },
  uninstall() {
    uninstalls.forEach((fn) => {
      fn();
    });
    uninstalls = [];
  },
};

export function copyToClipboard(text: string) {
  try {
    navigator.clipboard.writeText(text).then(() => {
      console.log("Text copied to clipboard");
    });
  } catch (e) {
    oldCopyToClipboard(text);
  }
  function oldCopyToClipboard(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    console.log("Text copied to clipboard");
  }
}
export const appendToTopbar = (name: string) => {
  //Add button (thanks Tyler Wince!)
  var nameToUse = name; //Change to whatever

  var checkForButton = document.getElementById(nameToUse + "-icon");
  if (!checkForButton) {
    checkForButton = document.createElement("span");
    var roamTopbar = document.getElementsByClassName("rm-topbar");
    var nextIconButton = roamTopbar[0].lastElementChild;
    var flexDiv = document.createElement("div");
    flexDiv.className = "rm-topbar__spacer-sm";
    nextIconButton.insertAdjacentElement("afterend", checkForButton);
  }
  return checkForButton;
};
