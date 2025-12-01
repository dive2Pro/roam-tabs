import { useEffect, useMemo } from "react";
import { extension_helper } from "../helper";
import { useEvent } from "./useEvent";

let listeners: ((uid?: string) => void)[] = [];
export function useOnUidWillChange(callback: (uid?: string) => void) {
  const cb = useEvent(callback);
  console.log("useOnUidWillChange: ", cb);
  useEffect(() => {
    listeners.push(cb);
    return () => {
      listeners = listeners.filter((l) => l !== cb);
    };
  }, []);
}

declare global {
  interface Window {
    navigation: {
      addEventListener: (
        type: string,
        listener: (event: {
          destination: {
            url: string;
          };
          preventDefault: () => void;
        }) => void
      ) => void;
      removeEventListener: (
        type: string,
        listener: (event: {
          destination: {
            url: string;
          };
          preventDefault: () => void;
        }) => void
      ) => void;
    };
  }
}

function observeElementClicked() {
  const onRouteChange = (e: HashChangeEvent) => {
    // 清除页面上所有的 portal
    const portals = document.querySelectorAll(".bp3-portal");
    portals.forEach((portal) => {
      portal.remove();
    });
  };

  window.addEventListener("hashchange", onRouteChange);
  const onNavigate = (e: any) => {
    const url = new URL(e.destination.url);
    const hash = url.hash;
    const regex = new RegExp(`/${window.roamAlphaAPI.graph.name}/page/(.+)`);
    const result = regex.exec(hash);
    console.log("before to: ", e, result, regex, listeners);
    if (result) {
      listeners.forEach((callback) => {
        callback(result[1]);
      });
    } else {
      listeners.forEach((callback) => {
        callback(undefined);
      });
    }
  };
  window.navigation.addEventListener("navigate", onNavigate);
  extension_helper.on_uninstall(() => {
    window.removeEventListener("hashchange", onRouteChange);
    window.navigation.removeEventListener("navigate", onNavigate);
  });
}

observeElementClicked();
