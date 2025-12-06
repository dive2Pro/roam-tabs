import React, { useContext, useEffect, useRef, useState } from "react";
import { StackContext } from "../Context";
import { Tooltip, Position } from "@blueprintjs/core";

export const Minimap = () => {
  const context = useContext(StackContext);
  if (!context) {
    throw new Error("Minimap must be used within StackProvider");
  }
  const { stack, containerRef, pageWidth, collapsedNonce, focusedIndex } =
    context;
  const minimapTrackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartLeftRef = useRef(0);
  const [dragTitle, setDragTitle] = useState("");
  const lastDragIndexRef = useRef(-1);

  // @ts-ignore
  const TooltipAny = Tooltip as any;

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
    setIsDraggingState(true);
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

    // 初始化拖拽标题
    const dims = updateDimensions();
    if (dims) {
      const scrollLeft = currentLeft / dims.scaleRatio;
      const centerScroll = scrollLeft + dims.viewportWidth / 2;
      const pageIndex = Math.floor(centerScroll / pageWidth);
      if (stack[pageIndex]) {
        setDragTitle(stack[pageIndex].title);
        lastDragIndexRef.current = pageIndex;
      }
    }

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
      const newScrollLeft = newThumbLeft / dims.scaleRatio;
      containerRef.current.scrollLeft = newScrollLeft;
      containerRef.current.style.scrollBehavior =
        originalScrollBehavior || "smooth";

      // 3. 更新拖拽标题
      const centerScroll = newScrollLeft + dims.viewportWidth / 2;
      const pageIndex = Math.floor(centerScroll / pageWidth);

      if (pageIndex !== lastDragIndexRef.current) {
        lastDragIndexRef.current = pageIndex;
        const targetPage = stack[pageIndex];
        if (targetPage) {
          setDragTitle(targetPage.title);
        }
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDraggingState(false);
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
  // const totalContentWidth = stack.length * pageWidth;

  return (
    <div
      ref={minimapTrackRef}
      id="roam-stack-indicator"
      className="roam-stack-minimap"
      onMouseDown={handleTrackClick}
    >
      <div style={{ width: "100%", height: "100%", position: "relative" }}>
        {/* Minimap 背景预览 */}
        <div className="roam-stack-minimap-preview">
          {stack.map((item, index) => {
            return (
              <TooltipAny
                key={item.id}
                content={item.title}
                position={Position.TOP}
                hoverOpenDelay={0}
                transitionDuration={100}
                disabled={isDraggingState}
              >
                <div
                  className={`minimap-block ${
                    index === focusedIndex ? "minimap-block-focused" : ""
                  }`}
                />
              </TooltipAny>
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
    </div>
  );
};
