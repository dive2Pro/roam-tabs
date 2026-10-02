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
  isCollapsed,
}: {
  item: PageItem;
  index: number;
  total: number;
  isCollapsed: boolean;
  context: StackContextType;
}) => {
  const {
    toggleCollapsed,
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
        icon={item.pin ? "pin" : "unpin"}
        intent={item.pin ? "danger" : 'none'}
        onClick={() => {
          togglePin(item.id);
        }}
        text={item.pin ? "Unpin" : "Pin"}
      />
      <MenuDivider />
      <MenuItem
        disabled={item.pin}
        icon="small-cross"
        text="Close"
        tagName="span"
        onClick={() => {
          removeTab(item.id);
        }}
      />
      <MenuItem
        icon="small-cross"
        text="Close Others"
        onClick={() => {
          removeOtherTabs(item.id);
        }}
        disabled={total === 1}
      />
      <MenuItem
        icon="cross"
        onClick={() => {
          removeToTheRightTabs(index);
        }}
        text="Close to the Right"
        disabled={index + 1 >= total}
      />
      <MenuDivider />
      <MenuItem
        icon="duplicate"
        onClick={() => {
          copyToClipboard(`[[${item.title}]]`);
        }}
        text="Copy Page Reference"
      />
      <MenuDivider />
      <MenuItem
        icon="add-column-right"
        onClick={() => {
          openInSidebar(item.id);
        }}
        text="Open in Sidebar"
      />
      <MenuDivider />
      <MenuItem 
        text={isCollapsed ? "Unfold Tab" : "Fold Tab"}
        icon={isCollapsed ? "menu-open" : "menu-closed"}
        onClick={() => {
          toggleCollapsed(item.id);
        }}
      />
      <MenuItem
        text="Fold All Tabs"
        icon="collapse-all"
        onClick={() => {
          foldAll();
        }}
      />
      <MenuItem
        text="Unfold All Tabs"
        icon="expand-all"
        onClick={() => {
          unfoldAll();
        }}
      />

    </Menu>
  );
};
