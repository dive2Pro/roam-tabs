import React, { useState, useEffect } from "react";
import { MenuItem, Menu } from "@blueprintjs/core";
import { Omnibar } from "@blueprintjs/select";
import { NodeGroup } from "react-move";
import type { Tab } from "./type";
import type { RoamExtensionAPI } from "roam-types";

type SwitchCommandProps = {
  tabs: Tab[];
  API: RoamExtensionAPI;
  onTabSelect: (tab: Tab) => void;
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

export function SwitchCommand({ tabs, API, onTabSelect }: SwitchCommandProps) {
  const [state, setState] = useState({
    open: false,
  });

  useEffect(() => {
    API.ui.commandPalette.addCommand({
      label: "Switch Tab...",
      callback() {
        setState((prev) => ({
          open: !prev.open,
        }));
      },
    });
  }, [API]);

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
    }
  }, [state.open]);

  return (
    <Omnibar
      isOpen={state.open}
      onClose={() => setState({ open: false })}
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
        console.log(item, " select ");
        onTabSelect(item);
        setState({ open: false });
      }}
      itemListRenderer={(itemListProps) => {
        return (
          <Menu>
            <NodeGroup
              data={itemListProps.filteredItems}
              start={(data, index) => {
                return {
                  y: 35,
                  opacity: 0,
                };
              }}
              enter={(data, index) => {
                return {
                  opacity: [1],
                  timing: {
                    duration: 250,
                  },
                };
              }}
              leave={(data, index) => {
                return [
                  {
                    y: [-35],
                    timing: {
                      duration: 250,
                    },
                  },
                  {
                    opacity: [0],
                    timing: {
                      duration: 150,
                    },
                  },
                ];
              }}
              keyAccessor={(data) => data.uid}
            >
              {(nodes) => {
                return (
                  <>
                    {nodes.map((node, index) => {
                      return (
                        <div
                          key={node.key}
                          style={{
                            opacity: node.state.opacity,
                            height: node.state.y,
                          }}
                        >
                          {itemListProps.renderItem(node.data, index)}
                        </div>
                      );
                    })}
                  </>
                );
              }}
            </NodeGroup>
          </Menu>
        );
      }}
    />
  );
}
