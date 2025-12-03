import React, {
  useRef,
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { Tab } from "../type";
import {
  Button,
  Icon,
  ContextMenu,
  Menu,
  MenuItem,
  MenuDivider,
  Popover,
  PopoverInteractionKind,
  Position,
} from "@blueprintjs/core";
import {
  focusOnPageTab,
  focusTab,
  getStackPageWidth,
  isAutoOpenNewTab,
  removeTab,
  saveAndRefreshTabs,
  setCollapsedUids,
} from "../config";
import { copyToClipboard } from "../helper";

import { useOnUidWillChange } from "../hooks/useOnUidChangeElementClicked";
// import { removeTab } from "../extension";

/* ===========================================================================
 * 1. 类型定义
 * =========================================================================== */
type PageItem = {
  id: string;
  title: string;
  blockUid: string;
  pin: boolean;
};

type StackContextType = {
  stack: PageItem[];
  focusPage: (index: number) => void;
  focusPageByUid: (uid: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  focusedIndex: number | null;
  hintRef: React.RefObject<HTMLDivElement>;
  //   宽度相关
  pageWidth: number;
  foldOffset: number;
  titleTriggerOffset: number;
  togglePin: (uid: string) => void;
  removeOtherTabs: (uid: string) => void;
  removeToTheRightTabs: (index: number) => void;
  openInSidebar: (uid: string) => void;
  isCollapsed: (uid: string) => boolean;
  toggleCollapsed: (uid: string) => void;
  collapsedNonce: number;
  foldAll: () => void;
  unfoldAll: () => void;
};

/* ===========================================================================
 * 2. 布局常量
 * =========================================================================== */
const CONSTANTS = {
  SPINE_WIDTH: 50, // 脊宽度
  TITLE_SHOW_AT: 100, // 🔥 核心配置：当未被遮盖范围剩 100px 时，标题才开始出现
};

// 单个页面完全折叠需要的位移量 (650 - 50 = 600)
// const FOLD_OFFSET = () => CONSTANTS.SPINE_WIDTH;

// 标题触发的相对偏移量 (650 - 100 = 550)
// // 意味着：页面被盖住了 550px，只剩 100px 时，标题动画开始
// const TITLE_TRIGGER_OFFSET = () =>
//   CONSTANTS.PAGE_WIDTH() - CONSTANTS.TITLE_SHOW_AT;

/* ===========================================================================
 * 3. 模拟数据
 * =========================================================================== */

/* ===========================================================================
 * 4. 核心逻辑 (Context)
 * =========================================================================== */
const StackContext = createContext<StackContextType | undefined>(undefined);

type StackProviderProps = {
  children: ReactNode;
  tabs: PageItem[];
  active: string;
  pageWidth: number;
  onTogglePin: (uid: string) => void;
  onRemoveOtherTabs: (uid: string) => void;
  onRemoveToTheRightTabs: (index: number) => void;
  onOpenInSidebar: (uid: string) => void;
  initialCollapsedUids?: string[];
};

const StackProvider = ({
  children,
  tabs,
  active,
  pageWidth,
  onTogglePin,
  onRemoveOtherTabs,
  onRemoveToTheRightTabs,
  onOpenInSidebar,
  initialCollapsedUids,
}: StackProviderProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const stack = tabs;
  const foldOffset = pageWidth - CONSTANTS.SPINE_WIDTH;
  const activeIndex = stack.findIndex((p) => p.id === active);
  //   const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const focusedIndex = activeIndex;
  const [collapsedSet, setCollapsedSet] = useState<Set<string>>(
    new Set(initialCollapsedUids || [])
  );
  const [collapsedNonce, setCollapsedNonce] = useState(0);

  const isCollapsed = (uid: string) => collapsedSet.has(uid);


  const foldAll = () => {
    const all = new Set(stack.map((p) => p.id));
    setCollapsedSet(all);
    setCollapsedUids(Array.from(all));
    setCollapsedNonce((n) => n + 1);
  };

  const unfoldAll = () => {
    setCollapsedSet(new Set());
    setCollapsedUids([]);
    setCollapsedNonce((n) => n + 1);
  };
  /**
   * 核心算法：智能滚动到指定索引
   * 目标：让该页面的左边缘，刚好紧贴着前面所有页面的"脊"
   * 优化：如果页面已经在视口内完美展示且未被遮挡，则跳过滚动
   */
  const scrollToPageIndex = (index: number) => {
    const container = containerRef.current;
    if (!container) return;

    // 智能判断：如果页面已经在视口内完美展示，则跳过滚动
    const pageNode = container.children[index] as HTMLElement | undefined;
    if (pageNode) {
      const conRect = container.getBoundingClientRect();
      const pageRect = pageNode.getBoundingClientRect();

      // 判断可见性 (左右都在视口内，允许 5px 的容差)
      const isVisibleInViewport =
        pageRect.left >= conRect.left - 5 &&
        pageRect.right <= conRect.right + 5;

      // 判断遮挡 (下一个页面的左边缘是否压在当前页面的右边缘内)
      let isCovered = false;
      const nextNode = container.children[index + 1] as HTMLElement | undefined;
      if (nextNode) {
        const nextRect = nextNode.getBoundingClientRect();
        // 如果重叠超过 10px 视为遮挡
        if (nextRect.left < pageRect.right - 10) {
          isCovered = true;
        }
      }

      if (isVisibleInViewport && !isCovered) {
        // 页面已经完美展示，跳过滚动
        return;
      }
    }

    // 动态计算：考虑主动折叠后的可视宽度
    // 目标滚动位置 = 前面各页的 (实际宽度 - 脊宽度) 之和
    const targetScrollLeft = stack
      .slice(0, index)
      .reduce((sum, p) => {
        const w = isCollapsed(p.id) ? CONSTANTS.SPINE_WIDTH : pageWidth;
        return sum + (w - CONSTANTS.SPINE_WIDTH);
      }, 0);

    container.scrollTo({
      left: targetScrollLeft,
      behavior: "smooth",
    });

    // 等待滚动完成后触发聚焦动画
    const triggerFocusAnimation = () => {
      // setFocusedIndex(index);
      // 聚焦状态保持 2.5 秒，让用户看到常驻的 box-shadow 和闪动效果
      setTimeout(() => {
        //   setFocusedIndex(null);
      }, 500);
    };

    // 使用 scrollend 事件（如果支持）或 fallback 到 setTimeout
    if ("onscrollend" in container) {
      container.addEventListener("scrollend", triggerFocusAnimation, {
        once: true,
      });
    } else {
      // Fallback: 估算滚动时间（smooth 滚动通常需要 300-500ms）
      const estimatedScrollTime = 20;
      setTimeout(triggerFocusAnimation, estimatedScrollTime);
    }
  };

  const toggleCollapsed = (uid: string) => {
    const willExpand = collapsedSet.has(uid);

    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      setCollapsedUids(Array.from(next));
      return next;
    });
    setCollapsedNonce((n) => n + 1);

    if (willExpand) {
      const index = stack.findIndex((p) => p.id === uid);
      if (index > -1) {
        setTimeout(() => {
          scrollToPageIndex(index);
        }, 50);
      }
    }
  };

  const focusPage = (index: number) => {
    // 点击脊部时，也使用精确对齐逻辑
    scrollToPageIndex(index);
  };

  // 🔥 核心：更新右侧滑动提示阴影 (不触发 React 渲染)
  const updateHintUI = (max: number, current: number) => {
    if (!hintRef.current) return;

    const remaining = max - current;

    // 如果剩余距离 > 10px，显示阴影提示；否则隐藏
    if (remaining > 10) {
      // 根据剩余距离计算阴影强度，距离越远阴影越明显
      const shadowIntensity = Math.min(remaining / 200, 1); // 最大强度在 200px 时达到
      hintRef.current.style.opacity = `${shadowIntensity}`;
    } else {
      hintRef.current.style.opacity = "0";
    }
  };

  // --- A. 更新最大滚动距离 ---
  const updateScrollMetrics = () => {
    if (containerRef.current) {
      const el = containerRef.current;
      const max = el.scrollWidth - el.clientWidth;
      const current = el.scrollLeft;

      // 更新 CSS 变量用于样式计算
      el.style.setProperty("--scroll-max", `${max}`);
      el.style.setProperty("--scroll-x", `${current}`);

      // 🔥 手动触发一次 UI 更新，确保初始状态正确
      updateHintUI(max, current);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const el = e.currentTarget;
      const current = el.scrollLeft;
      const max = el.scrollWidth - el.clientWidth;

      // 1. 更新 CSS 变量 (用于页面内部阴影/标题等)
      el.style.setProperty("--scroll-x", `${current}`);

      // 2. 🔥 更新右侧滑动提示阴影
      updateHintUI(max, current);
    }
  };

  // 监听容器尺寸变化
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    updateScrollMetrics();
    const observer = new ResizeObserver(updateScrollMetrics);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Stack 变化后更新
  useEffect(() => {
    setTimeout(updateScrollMetrics, 100);
  }, [stack.length]);

  // 主动折叠状态变化后更新滚动/尺寸指标
  useEffect(() => {
    setTimeout(updateScrollMetrics, 0);
  }, [collapsedSet]);

  useEffect(() => {
    scrollToPageIndex(activeIndex);
  }, [activeIndex]);

  return (
    <StackContext.Provider
      value={{
        stack,
        focusPage,
        containerRef,
        handleScroll,
        focusedIndex,
        hintRef,
        pageWidth: pageWidth,
        foldOffset: pageWidth - CONSTANTS.SPINE_WIDTH,
        titleTriggerOffset: pageWidth - CONSTANTS.TITLE_SHOW_AT,
        focusPageByUid: (uid: string) => {
          const index = stack.findIndex((p) => p.id === uid);
          if (index > -1) {
            focusPage(index);
          }
        },
        togglePin: (uid: string) => {
          onTogglePin(uid);
        },
        removeOtherTabs: (uid: string) => {
          onRemoveOtherTabs(uid);
        },
        removeToTheRightTabs: (index: number) => {
          onRemoveToTheRightTabs(index);
        },
        openInSidebar: (uid: string) => {
          onOpenInSidebar(uid);
        },
        isCollapsed,
        toggleCollapsed,
        collapsedNonce,
        foldAll,
        unfoldAll,
      }}
    >
      {children}
    </StackContext.Provider>
  );
};

/* ===========================================================================
 * 5. 页面组件
 * =========================================================================== */

const StackPageMenu = ({
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

type PageCardProps = {
  item: PageItem;
  index: number;
  total: number;
};

const PageCard = ({ item, index, total }: PageCardProps) => {
  const context = useContext(StackContext);
  if (!context) {
    throw new Error("PageCard must be used within StackProvider");
  }

  const {
    focusPage,
    focusPageByUid,
    focusedIndex,
    pageWidth,
    foldOffset,
    titleTriggerOffset,
    togglePin,
    removeOtherTabs,
    removeToTheRightTabs,
    openInSidebar,
    isCollapsed,
    toggleCollapsed,
    foldAll,
    unfoldAll,
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
              content={<div className="roam-stack-popover-content">Expand page</div>}
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
                  <Icon icon={"chevron-right"} />
                </Button>
              }
            />
          )}
        </div>

        {/* 内容 */}
        <div
          className="roam-stack-card-main"
          style={{
            display: collapsed ? "none" : "flex",
            width: Math.max(cardWidth - CONSTANTS.SPINE_WIDTH, 0),
          }}
        >
          <div
            className="roam-stack-card-header"
          >
            <Popover
              content={<div className="roam-stack-popover-content">Collapse page</div>}
              interactionKind={PopoverInteractionKind.HOVER}
              position={Position.BOTTOM}
              target={
                <Button
                  minimal
                  icon="chevron-left"
                  small
                  onClick={() => toggleCollapsed(item.id)}
                />
              }
            />
            <Popover
              content={
                <StackPageMenu
                  item={item}
                  index={index}
                  total={total}
                  context={context}
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

/* ===========================================================================
 * 6. Minimap 组件
 * =========================================================================== */
const Minimap = () => {
  const context = useContext(StackContext);
  if (!context) {
    throw new Error("Minimap must be used within StackProvider");
  }
  const { stack, containerRef, pageWidth, collapsedNonce } = context;
  const minimapTrackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartLeftRef = useRef(0);

  // 初始化/Resize 计算
  const updateDimensions = () => {
    const container = containerRef.current;
    if (
      !container ||
      !minimapTrackRef.current ||
      !thumbRef.current ||
      stack.length === 0
    ) {
      return null;
    }

    const viewportWidth = container.clientWidth;
    const contentWidth = container.scrollWidth;
    const minimapWidth = minimapTrackRef.current.clientWidth - 8; // 减去 padding

    if (contentWidth <= viewportWidth) {
      // 不需要滚动，隐藏 minimap
      minimapTrackRef.current.style.display = "none";
      return null;
    }

    minimapTrackRef.current.style.display = "block";

    // 计算内容与 minimap 的比例
    // ratio = Minimap总宽 / 内容总宽
    const scaleRatio = minimapWidth / contentWidth;

    // 计算滑块宽度：视口宽度 * 缩放比例
    const thumbWidth = viewportWidth * scaleRatio;
    thumbRef.current.style.width = `${thumbWidth}px`;

    // 同步当前位置
    const currentScroll = container.scrollLeft;
    const thumbLeft = currentScroll * scaleRatio;
    thumbRef.current.style.transform = `translateX(${thumbLeft}px)`;

    return {
      scaleRatio,
      minimapWidth,
      thumbWidth,
      contentWidth,
      viewportWidth,
    };
  };

  // 1. 视口滚动 -> 联动 Minimap
  const handleViewportScroll = () => {
    // 如果正在拖拽 minimap，不通过 scroll 事件更新 thumb 位置，避免抖动/循环依赖
    if (isDraggingRef.current) return;

    const dims = updateDimensions();
    if (!dims) return;

    const scrollLeft = containerRef.current?.scrollLeft || 0;
    const thumbLeft = scrollLeft * dims.scaleRatio;

    if (thumbRef.current) {
      thumbRef.current.style.transform = `translateX(${thumbLeft}px)`;
    }
  };

  // 2. Minimap 拖拽逻辑 -> 联动视口
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!thumbRef.current || !containerRef.current) return;

    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;

    // 获取当前的 transform X 值
    const style = window.getComputedStyle(thumbRef.current);
    const transform = style.transform;
    let currentLeft = 0;

    if (transform && transform !== "none") {
      const matrix = new DOMMatrix(transform);
      currentLeft = matrix.m41; // 获取 translateX
    }

    dragStartLeftRef.current = currentLeft;

    const handleMouseMove = (e: MouseEvent) => {
      if (
        !isDraggingRef.current ||
        !containerRef.current ||
        !minimapTrackRef.current ||
        !thumbRef.current
      )
        return;

      const dims = updateDimensions();
      if (!dims) return;

      // 计算鼠标移动的差值
      const deltaX = e.clientX - dragStartXRef.current;
      let newThumbLeft = dragStartLeftRef.current + deltaX;

      // 边界限制
      const maxLeft = dims.minimapWidth - dims.thumbWidth;
      if (newThumbLeft < 0) newThumbLeft = 0;
      if (newThumbLeft > maxLeft) newThumbLeft = maxLeft;

      // 1. 更新滑块 UI (使用 transform 性能更好)
      thumbRef.current.style.transform = `translateX(${newThumbLeft}px)`;

      // 2. 更新视口 ScrollLeft
      // Scroll = ThumbLeft / Ratio
      // 临时关闭 smooth 滚动
      const originalScrollBehavior = containerRef.current.style.scrollBehavior;
      containerRef.current.style.scrollBehavior = "auto";
      containerRef.current.scrollLeft = newThumbLeft / dims.scaleRatio;
      containerRef.current.style.scrollBehavior =
        originalScrollBehavior || "smooth";
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // 3. 点击 Minimap 轨道跳转
  const handleTrackClick = (e: React.MouseEvent) => {
    // 如果点击的是滑块本身，忽略（由 MouseDown 处理）
    if (e.target === thumbRef.current) return;

    const dims = updateDimensions();
    if (!dims || !minimapTrackRef.current || !containerRef.current) return;

    const rect = minimapTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left - 6; // 减去 padding

    // 让点击位置成为滑块的中心
    let newThumbLeft = clickX - dims.thumbWidth / 2;

    // 边界限制
    const maxLeft = dims.minimapWidth - dims.thumbWidth;
    if (newThumbLeft < 0) newThumbLeft = 0;
    if (newThumbLeft > maxLeft) newThumbLeft = maxLeft;

    // 更新视口
    containerRef.current.style.scrollBehavior = "smooth"; // 点击跳转时加点平滑效果
    containerRef.current.scrollLeft = newThumbLeft / dims.scaleRatio;

    // 恢复默认滚动行为，以免拖拽时有延迟
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.style.scrollBehavior = "auto";
      }
    }, 300);
  };

  // 监听滚动事件和窗口大小变化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleViewportScroll);
    window.addEventListener("resize", updateDimensions);

    // 初始计算一次
    setTimeout(updateDimensions, 0);

    return () => {
      container.removeEventListener("scroll", handleViewportScroll);
      window.removeEventListener("resize", updateDimensions);
    };
  }, [stack.length, collapsedNonce]);

  if (stack.length === 0) return null;

  // 计算总内容宽度（所有页面的实际宽度）
  const totalContentWidth = stack.length * pageWidth;

  return (
    <div
      ref={minimapTrackRef}
      id="roam-stack-indicator"
      className="roam-stack-minimap"
      onMouseDown={handleTrackClick}
    >
      {/* Minimap 背景预览 */}
      <div className="roam-stack-minimap-preview">
        {stack.map((item) => {
          return (
            <div
              key={item.id}
              className="minimap-block"
            />
          );
        })}
      </div>
      {/* 可拖拽的视口框 (Thumb) */}
      <div
        ref={thumbRef}
        className="minimap-thumb"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

/* ===========================================================================
 * 7. 布局容器
 * =========================================================================== */
const Layout = () => {
  const context = useContext(StackContext);
  if (!context) {
    throw new Error("Layout must be used within StackProvider");
  }
  const { stack, containerRef, handleScroll, hintRef } = context;
  return (
    <div
      className="roam-stack-layout"
    >
      {/* <header
        style={{
          padding: "15px 20px",
          color: "#fff",
          background: "#222",
          fontSize: "14px",
        }}
      >
        <strong>Precision Scroll:</strong>{" "}
        点击任意按钮，目标页面会完美贴合在左侧堆叠区的右边。
      </header> */}

      {/* 
        🔥🔥 右侧滑动提示阴影效果
        当还有内容可以向右滚动时，在右侧边缘显示渐变阴影提示
      */}
      {/* <div
        ref={hintRef}
        className="roam-stack-minimap"
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: "60px", // 阴影渐变宽度
          zIndex: 100,
          pointerEvents: "none", // 不阻挡点击

          // 从右到左的渐变阴影效果
          background:
            "linear-gradient(to left, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.08) 50%, transparent 100%)",

          // 动画属性 (由 JS 切换 opacity)
          transition: "opacity 0.3s ease",
          opacity: 0, // 默认隐藏
        }}
      /> */}
      <Minimap />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="roam-stacks-container roam-stack-layout-container"
        style={
          {
            "--scroll-x": "0",
            "--scroll-max": "0",
          } as React.CSSProperties & {
            "--scroll-x": string;
            "--scroll-max": string;
          }
        }
      >
        {stack.length === 0 && (
          <div
            className="roam-stack-empty-state"
          >
            <div
              className="roam-stack-empty-text"
            >
              No tabs
            </div>
          </div>
        )}
        {stack.map((item: PageItem, index: number) => (
          <PageCard
            key={item.id}
            item={item}
            index={index}
            total={stack.length}
          />
        ))}
      </div>
    </div>
  );
};

// 全局变量跟踪 Ctrl/Cmd 键状态
let ctrlKeyPressed = false;

export const StackApp = (props: {
  tabs: Tab[];
  currentTab: Tab;
  pageWidth: number;
  collapsedUids?: string[];
}) => {
  useOnUidWillChange(async (uid) => {
    if (!uid) {
      // 清空聚焦的页面
      saveAndRefreshTabs(props.tabs, undefined);
      return;
    }

    const pageOrBlockUid = uid;

    if (!pageOrBlockUid) {
      return;
    }
    let pageData = (await window.roamAlphaAPI.data.async.q(
      `[:find [?e ?t]  :where [?b :block/uid "${pageOrBlockUid}"] [?b :block/page ?p]
     [?p :block/uid ?e]
     [?p :node/title ?t]
    ]`
    )) as unknown as null | [string, string];
    let blockUid = pageOrBlockUid;
    if (!pageData) {
      const title = (await window.roamAlphaAPI.data.async.q(
        `[:find ?t . :where [?b :block/uid "${pageOrBlockUid}"] [?b :node/title ?t]
      ]`
      )) as unknown as string;
      pageData = [pageOrBlockUid, title];
    }

    const [pageUid, title] = pageData;
    const existingTabIndex = props.tabs.findIndex((tab) => tab.uid === pageUid);

    // 如果标签页已存在，更新它
    if (existingTabIndex !== -1) {
      const updatedTabs = [...props.tabs];
      updatedTabs[existingTabIndex] = {
        ...updatedTabs[existingTabIndex],
        blockUid,
      };
      saveAndRefreshTabs(updatedTabs, updatedTabs[existingTabIndex]);
      return;
    }

    // 如果当前标签页是 pinned 的，自动创建新标签页（类似于 horizontal 模式）
    const shouldCreateNewTab =
      ctrlKeyPressed || isAutoOpenNewTab() || props.currentTab?.pin;

    // console.log({
    //   shouldCreateNewTab,
    //   ctrlKeyPressed,
    //   isAutoOpenNewTab: isAutoOpenNewTab(),
    //   pin: props.currentTab?.pin,
    // });
    // 标签页不存在，根据 Ctrl/Cmd 键、Auto 模式和 pinned 状态决定行为
    if (shouldCreateNewTab) {
      // 创建新标签页
      const newTab = { uid: pageUid, title, blockUid, pin: false };
      const tabs = [...props.tabs, newTab];
      saveAndRefreshTabs(tabs, newTab);
    } else {
      // 不创建新标签页，根据情况处理
      if (props.tabs.length === 0) {
        // 如果标签列表为空，创建新标签页
        const newTab = { uid: pageUid, title, blockUid, pin: false };
        saveAndRefreshTabs([newTab], newTab);
      } else if (!props.currentTab) {
        // 如果当前没有标签页，创建新标签页并设置为当前标签页
        const newTab = { uid: pageUid, title, blockUid, pin: false };
        const tabs = [...props.tabs, newTab];
        saveAndRefreshTabs(tabs, newTab);
      } else {
        // 否则，更新当前标签页（替换当前标签页的内容）
        const updatedTabs = props.tabs.map((tab) =>
          tab.uid === props.currentTab.uid
            ? { uid: pageUid, title, blockUid, pin: tab.pin }
            : tab
        );
        const updatedCurrentTab = updatedTabs.find(
          (tab) => tab.uid === pageUid
        ) || { uid: pageUid, title, blockUid, pin: false };
        saveAndRefreshTabs(updatedTabs, updatedCurrentTab);
      }
    }
  });
  // 检测 Ctrl/Cmd 键按下
  useEffect(() => {
    const onPointerdown = (e: PointerEvent) => {
      ctrlKeyPressed = e.ctrlKey || e.metaKey;
    };

    document.addEventListener("pointerdown", onPointerdown);
    return () => {
      document.removeEventListener("pointerdown", onPointerdown);
    };
  }, []);

  const togglePin = (uid: string) => {
    const updatedTabs = props.tabs.map((tab) =>
      tab.uid === uid ? { ...tab, pin: !tab.pin } : tab
    );
    const updatedCurrentTab = updatedTabs.find((tab) => tab.uid === uid);
    saveAndRefreshTabs(updatedTabs, updatedCurrentTab || props.currentTab);
  };

  const removeOtherTabs = (uid: string) => {
    const updatedTabs = props.tabs.filter((tab) => tab.pin || tab.uid === uid);
    const updatedCurrentTab = updatedTabs.find((tab) => tab.uid === uid);
    saveAndRefreshTabs(updatedTabs, updatedCurrentTab || props.currentTab);
  };

  const removeToTheRightTabs = (index: number) => {
    const updatedTabs = [
      ...props.tabs.slice(0, index + 1),
      ...props.tabs.slice(index + 1).filter((t) => t.pin),
    ];
    const currentIndex = updatedTabs.findIndex(
      (t) => t.uid === props.currentTab?.uid
    );
    const updatedCurrentTab =
      currentIndex === -1 || currentIndex > index
        ? updatedTabs[index]
        : props.currentTab;
    saveAndRefreshTabs(updatedTabs, updatedCurrentTab);
  };

  const openInSidebar = (uid: string) => {
    window.roamAlphaAPI.ui.rightSidebar.addWindow({
      window: {
        "block-uid": uid,
        type: "outline",
      },
    });
  };

  return (
    <StackProvider
      tabs={props.tabs.map((tab) => ({
        id: tab.uid,
        title: tab.title,
        blockUid: tab.blockUid,
        pin: tab.pin,
      }))}
      active={props.currentTab?.uid}
      pageWidth={props.pageWidth}
      onTogglePin={togglePin}
      onRemoveOtherTabs={removeOtherTabs}
      onRemoveToTheRightTabs={removeToTheRightTabs}
      onOpenInSidebar={openInSidebar}
      initialCollapsedUids={props.collapsedUids}
    >
      <Layout />
    </StackProvider>
  );
};
