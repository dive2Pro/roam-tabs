import React, { useContext } from "react";
import { StackContext } from "../Context";
import { PageItem } from "../types";
import { PageCard } from "./PageCard";
import { Minimap } from "./Minimap";

export const Layout = () => {
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
