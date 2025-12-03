import React from "react";
import { Menu, MenuItem, MenuDivider } from "@blueprintjs/core";
import { PageItem, StackContextType } from "../types";
import { removeTab } from "../../config";
import { copyToClipboard } from "../../helper";

export const StackPageMenu = ({
  item,
  index,
  total,
  context,
}: {
  item: PageItem;
  index: number;
  total: number;
  context: StackContextType;
}) => {
  const {
    foldAll,
    unfoldAll,
    removeOtherTabs,
    removeToTheRightTabs,
    openInSidebar,
    togglePin,
  } = context;

  return (
    <Menu>
      <MenuItem
        onClick={() => {
          togglePin(item.id);
        }}
        text={item.pin ? "Unpin" : "Pin"}
      />
      <MenuItem
        disabled={item.pin}
        text="Close"
        tagName="span"
        onClick={() => {
          removeTab(item.id);
        }}
      />
      <MenuItem
        text="Close Others"
        onClick={() => {
          removeOtherTabs(item.id);
        }}
        disabled={total === 1}
      />
      <MenuItem
        onClick={() => {
          removeToTheRightTabs(index);
        }}
        text="Close to the Right"
        disabled={index + 1 >= total}
      />
      <MenuDivider />
      <MenuItem
        onClick={() => {
          copyToClipboard(`[[${item.title}]]`);
        }}
        text="Copy Page Reference"
      />
      <MenuDivider />
      <MenuItem
        onClick={() => {
          openInSidebar(item.id);
        }}
        text="Open in Sidebar"
      />
      <MenuDivider />

      <MenuItem
        text="Fold All"
        onClick={() => {
          foldAll();
        }}
      />
      <MenuItem
        text="Unfold All"
        onClick={() => {
          unfoldAll();
        }}
      />
      <MenuDivider />
    </Menu>
  );
};
