import React from "react";
import ReactDOM from "react-dom";
import "./style.less";

export default function Extension() {
  return (
    <div className="extension-template">
      <h1>Hello Roam</h1>
    </div>
  );
}

export function initExtension() {
  console.log("init extension");
}
