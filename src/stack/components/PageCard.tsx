import React, { useContext, useEffect, useRef } from "react";
import {
  Button,
  Icon,
  ContextMenu,
  Popover,
  PopoverInteractionKind,
  Position,
} from "@blueprintjs/core";
import { StackContext } from "../Context";
import { PageItem } from "../types";
import { CONSTANTS } from "../constants";
import { focusOnPageTab, focusTab, removeTab } from "../../config";
import { StackPageMenu } from "./StackPageMenu";

type PageCardProps = {
  item: PageItem;
  index: number;
  total: number;
};

export const PageCard = ({ item, index, total }: PageCardProps) => {
  const context = useContext(StackContext);
  if (!context) {
    throw new Error("PageCard must be used within StackProvider");
  }

  const {
    focusPage,
    focusPageByUid,
    focusedIndex,
    pageWidth,
    isCollapsed,
    toggleCollapsed,
  } = context;
  const isObstructed = index < total - 1;
  const isFocused = focusedIndex === index;

  const contentRef = useRef<HTMLDivElement>(null);
  const collapsed = isCollapsed(item.id);
  useEffect(() => {
    setTimeout(async () => {
      await window.roamAlphaAPI.ui.components.unmountNode({
        el: contentRef.current,
      });
      if (collapsed) {
        return;
      }
      if (item.blockUid !== item.id) {
        window.roamAlphaAPI.ui.components.renderBlock({
          el: contentRef.current,
          uid: item.blockUid,
          "zoom-path?": true,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));

        return;
      }
      window.roamAlphaAPI.ui.components.renderPage({
        el: contentRef.current,
        uid: item.id,
      });
    }, 50);
  }, [item.id, item.blockUid, collapsed]);

  // --- 1. 基础折叠点 ---
  // 页面 sticky 吸附的时刻
  const dynamicFoldOffsets = (idx: number) => {
    return context.stack.slice(0, idx).reduce((sum, p) => {
      const w = isCollapsed(p.id) ? CONSTANTS.SPINE_WIDTH : pageWidth;
      return sum + (w - CONSTANTS.SPINE_WIDTH);
    }, 0);
  };
  const foldStart = dynamicFoldOffsets(index);

  // --- 2. 标题触发点 (关键修改) ---
  // foldStart 是页面刚刚 sticky 住的时刻 (此时可见宽度 = 650px)
  // 我们加上 TITLE_TRIGGER_OFFSET (550px)，表示右边页面已经盖过来 550px 了
  // 此时可见宽度 = 100px。从这一刻开始，标题才允许出现。
  const cardWidth = collapsed ? CONSTANTS.SPINE_WIDTH : pageWidth;
  const titleTriggerPoint = foldStart + (cardWidth - CONSTANTS.TITLE_SHOW_AT);

  // --- 3. 阴影触发点 ---
  // 当我(index)开始覆盖前一页(index-1)时
  const overlapStart = dynamicFoldOffsets(Math.max(index - 1, 0));

  return (
    <div
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const zoomsClass = ["rm-zoom-item", "rm-zoom-item-content"];
        if (zoomsClass.some((cls) => target.classList.contains(cls))) {
          const zoomItem = target.closest(".rm-zoom-item");
          if (zoomItem) {
            const children = zoomItem.parentElement.children;
            const index = Array.from(children).indexOf(zoomItem);
            console.log({ index }, "  = zoom ");
            if (index === 0) {
              focusOnPageTab(item.id);
              return;
            }
          }
        }
        focusPage(index);
      }}
      className={`roam-stack-card ${
        collapsed ? "roam-stack-card-collapsed" : ""
      }`}
      style={
        {
          // 传递给 CSS
          "--title-trigger": `${titleTriggerPoint}`,
          "--overlap-start": `${overlapStart}`,
          // --- 核心 A: 标题透明度 ---
          // 范围：从 (可见宽度100px) 到 (可见宽度50px/完全折叠)
          // 距离差是 50px (SPINE_WIDTH ~ 100px)
          // 计算：(当前滚动 - 触发点) / 50
          //   "--title-opacity": `clamp(0, (var(--scroll-x) - var(--title-trigger)) / 50, 1)`,
          // --- 核心 B: 阴影透明度 ---
          // 一旦开始重叠，30px 内阴影显现
          "--shadow-opacity":
            index === 0
              ? "0"
              : `clamp(0, (var(--scroll-x) - var(--overlap-start)) / 30, 1)`,
          width: `${cardWidth}px`,
          // 你的老朋友 sticky left
          left: `${index * CONSTANTS.SPINE_WIDTH}px`,
          //   zIndex: index,
          cursor: isObstructed ? "pointer" : "default",
          // 左侧外阴影 (覆盖在前一页上的阴影)
          boxShadow: collapsed
            ? "none"
            : `
          -10px 0 20px -5px rgba(0,0,0, calc(0.3 * var(--shadow-opacity))),
          -30px 0 50px -10px rgba(0,0,0, calc(0.1 * var(--shadow-opacity)))
        `,
        } as React.CSSProperties & {
          "--title-trigger": string;
          "--overlap-start": string;
          "--title-opacity": string;
          "--shadow-opacity": string;
        }
      }
    >
      <div
        className={`roam-stack-card-content ${
          isFocused ? "roam-stack-card-focused" : ""
        }`}
      >
        {/* 垂直脊 */}
        <div
          className="roam-stack-card-spine"
          style={{
            width: `${CONSTANTS.SPINE_WIDTH}px`,
            lineHeight: `${CONSTANTS.SPINE_WIDTH}px`,
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            toggleCollapsed(item.id);
          }}
        >
          {/* 关闭按钮和 Pin 按钮 - 始终可见 */}
          <div
            className="roam-stack-card-spine-buttons"
          >
            {item.pin ? (
              <Button
                minimal
                intent={item.pin ? "primary" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  const { togglePin } = context;
                  togglePin(item.id);
                }}
              >
                <Icon icon="pin" color={item.pin ? undefined : "#ABB3BF"} />
              </Button>
            ) : (
              <Button
                icon="cross"
                minimal
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(item.id);
                }}
              ></Button>
            )}
          </div>

          <div
            className="roam-stack-card-title"
            onContextMenu={(e) => {
              if (e.button === 2) {
                e.preventDefault();
                e.stopPropagation();
                ContextMenu.show(
                  <StackPageMenu
                    item={item}
                    index={index}
                    total={total}
                    context={context}
                    isCollapsed={collapsed}
                  />,
                  { left: e.clientX, top: e.clientY },
                  () => {}
                );
              }
            }}
          >
            {item.title}
          </div>
          {collapsed && (
            <Popover
              content={<div className="roam-stack-popover-content">Unfold tab</div>}
              interactionKind={PopoverInteractionKind.HOVER}
              position={Position.RIGHT}
              target={
                <Button
                  minimal
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapsed(item.id);
                  }}
                  className="roam-stack-expand-btn"
                >
                  <Icon icon={"menu-open"} />
                </Button>
              }
            />
          )}
        </div>

        {/* 内容 */}
        <div
          className="roam-stack-card-main"
          style={{
            display: "flex",
            width: collapsed ? 0 : Math.max(cardWidth - CONSTANTS.SPINE_WIDTH, 0),
          }}
        >
          <div
            className="roam-stack-card-header"
            style={
              collapsed ? {
              opacity: 0
            } : null}
          >
            <Popover
              content={<div className="roam-stack-popover-content">Fold tab</div>}
              interactionKind={PopoverInteractionKind.HOVER}
              position={Position.BOTTOM}
              target={
                <Button
                  minimal
                  icon="menu-closed"
                  small
                  onClick={() => toggleCollapsed(item.id)}
                />
              }
            />
            <Popover 
              autoFocus={false} 
              content={
                <StackPageMenu
                  item={item}
                  index={index}
                  total={total}
                  context={context}
                  isCollapsed={collapsed}
                />
              }
              position={Position.BOTTOM_RIGHT}
              target={<Button minimal icon="more" small />}
            />
          </div>
          <div
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              const target = e.target as HTMLElement;
              if (target.classList.contains("rm-page-ref")) {
                const linkUid = target
                  .closest("[data-link-uid]")
                  ?.getAttribute("data-link-uid");
                if (linkUid) {
                  focusPageByUid(linkUid);
                }
                return;
              }
              focusTab(item.id);
            }}
            className="roam-stack-card-body"
            ref={contentRef}
          ></div>
        </div>
      </div>
    </div>
  );
};
