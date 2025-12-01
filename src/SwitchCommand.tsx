import React, { useState, useEffect, useRef } from "react";
import { MenuItem, Menu, Icon } from "@blueprintjs/core";
import { Omnibar } from "@blueprintjs/select";
import ReactDOM from "react-dom/client";
import { List, arrayMove } from "react-movable";
import type { Tab } from "./type";
import { focusTab, saveAndRefreshTabs, saveTabsToSettings } from "./config";

export const globalSwitchCommandOperator = {
  listeners: [] as ((v: boolean) => void)[],
  isOpen: false,
  open: () => {
    globalSwitchCommandOperator.isOpen = true;
    globalSwitchCommandOperator.listeners.forEach((l) => l(true));
  },
  close: () => {
    globalSwitchCommandOperator.isOpen = false;
    globalSwitchCommandOperator.listeners.forEach((l) => l(false));
  },
  listen: (callback: (v: boolean) => void) => {
    globalSwitchCommandOperator.listeners.push(callback);
    return () => {
      globalSwitchCommandOperator.listeners =
        globalSwitchCommandOperator.listeners.filter((l) => l !== callback);
    };
  },
};

type SwitchCommandProps = {
  tabs: Tab[];
  onTabSelect: (tab: Tab) => void;
  onTabSorted: (tabs: Tab[]) => void;
};

function escapeRegExpChars(text: string) {
  return text.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function highlightText(text: string, query: string) {
  let lastIndex = 0;
  const words = query
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map(escapeRegExpChars);
  if (words.length === 0) {
    return [text];
  }
  const regexp = new RegExp(words.join("|"), "gi");
  const tokens: React.ReactNode[] = [];
  while (true) {
    const match = regexp.exec(text);
    if (!match) {
      break;
    }
    const length = match[0].length;
    const before = text.slice(lastIndex, regexp.lastIndex - length);
    if (before.length > 0) {
      tokens.push(before);
    }
    lastIndex = regexp.lastIndex;
    tokens.push(<strong key={lastIndex}>{match[0]}</strong>);
  }
  const rest = text.slice(lastIndex);
  if (rest.length > 0) {
    tokens.push(rest);
  }
  return tokens;
}

const ElParent = document.body;
const El = "roam-tabs-switch-el";

let el: HTMLElement | null = null;
export function renderSwitchCommand(tabs: Tab[], currentTab?: Tab) {
  if (!el) {
    el = document.createElement("div");
    el.className = El;
    ElParent.appendChild(el);
  }
  ReactDOM.createRoot(el).render(
    <SwitchCommand
      tabs={tabs}
      onTabSorted={(newTabs) => {
        saveAndRefreshTabs(newTabs, currentTab);
      }}
      onTabSelect={(tab) => {
        focusTab(tab.uid);
      }}
    />
  );
}

function SwitchCommand({ tabs, onTabSelect, onTabSorted }: SwitchCommandProps) {
  const [state, setState] = useState({
    open: false,
  });
  useEffect(() => {
    return globalSwitchCommandOperator.listen((v) => {
      setState({ open: v });
    });
  }, []);
  // 用于存储过滤后的项目列表，支持拖拽排序
  const [filteredItems, setFilteredItems] = useState<Tab[]>([]);

  const [container, setContainer] = React.useState<Element | null>(null);
  React.useEffect(() => {
    if (document.querySelector(".roam-tabs-switch-el")) {
      setContainer(document.querySelector(".roam-tabs-switch-el") as Element);
      return;
    }
    const div = document.createElement("div");
    div.className = "roam-tabs-switch-el";
    document.body.appendChild(div);
    setContainer(div);
    return () => {
      div.remove();
    };
  }, []);

  // 当打开时选中 input 文字
  useEffect(() => {
    if (state.open) {
      // 使用 setTimeout 确保 DOM 已经渲染
      setTimeout(() => {
        const input = document.querySelector(
          ".bp3-omnibar input"
        ) as HTMLInputElement;
        if (input) {
          input.select();
        }
      }, 0);
    } else {
      // 关闭时重置过滤列表
      setFilteredItems([]);
    }
  }, [state.open]);

  return (
    <Omnibar
      isOpen={state.open}
      onClose={() => globalSwitchCommandOperator.close()}
      items={tabs}
      itemPredicate={(query, item) => {
        return item.title.toLowerCase().includes(query.toLowerCase());
      }}
      itemRenderer={(item, itemProps) => {
        return (
          <MenuItem
            onClick={itemProps.handleClick}
            {...itemProps.modifiers}
            text={highlightText(item.title, itemProps.query)}
          />
        );
      }}
      onItemSelect={(item) => {
        onTabSelect(item);
        globalSwitchCommandOperator.close();
      }}
      itemListRenderer={(itemListProps) => {
        // 当过滤项变化时，同步更新 filteredItems
        const currentFilteredItems =
          filteredItems.length > 0 &&
          filteredItems.every((item) =>
            itemListProps.filteredItems.some((f) => f.uid === item.uid)
          )
            ? filteredItems
            : itemListProps.filteredItems;

        return (
          <List
            container={container}
            values={currentFilteredItems}
            onChange={({
              oldIndex,
              newIndex,
            }: {
              oldIndex: number;
              newIndex: number;
            }) => {
              console.log({ oldIndex, newIndex, currentFilteredItems });
              const newItems = arrayMove(
                currentFilteredItems,
                oldIndex,
                newIndex
              );
              onTabSorted(newItems);
              setFilteredItems(newItems);
            }}
            renderList={({
              children,
              props,
              isDragged,
            }: {
              children: React.ReactNode;
              props: any;
              isDragged: boolean;
            }) => {
              if (isDragged) {
                container?.classList.add("show");
              } else {
                container?.classList.remove("show");
              }
              return (
                <div
                  {...props}
                  className="bp3-menu"
                  style={{
                    ...props.style,
                    overflowY: "scroll",
                    overflowX: "hidden",
                    maxHeight: 500,
                    cursor: isDragged ? "grabbing" : undefined,
                  }}
                >
                  {children}
                </div>
              );
            }}
            renderItem={({
              value,
              props,
              isDragged,
              isSelected,
            }: {
              value: Tab;
              props: any;
              isDragged: boolean;
              isSelected: boolean;
            }) => (
              <li
                {...props}
                key={props.key}
                style={{
                  ...props.style,
                  cursor: isDragged ? "grabbing" : "grab",
                  // padding: "1.5em",
                  // margin: "0.5em 0em",
                  // listStyleType: "none",
                  // border: "2px solid #CCC",
                  // boxShadow: "3px 3px #AAA",
                  // color: "#333",
                  // borderRadius: "5px",

                  backgroundColor:
                    isDragged || isSelected ? "#f5f5f5" : "transparent",
                  opacity: isDragged ? 0.8 : 1,
                  zIndex: isDragged ? 99 : 1,
                }}
              >
                <div
                  className={
                    "bp3-menu-item" +
                    `${
                      (itemListProps.activeItem as Tab)?.uid === value.uid
                        ? " bp3-active"
                        : ""
                    }`
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "10px 7px",
                  }}
                  onClick={() => {
                    onTabSelect(value);
                    globalSwitchCommandOperator.close();
                  }}
                >
                  <span>{highlightText(value.title, itemListProps.query)}</span>
                  {!itemListProps.query ? (
                    <Icon
                      icon="drag-handle-vertical"
                      data-movable-handle
                      style={{
                        cursor: "grab",
                        opacity: 0.5,
                        marginLeft: "8px",
                        userSelect: "none",
                      }}
                    />
                  ) : null}
                </div>
              </li>
            )}
          />
        );
      }}
    />
  );
}
