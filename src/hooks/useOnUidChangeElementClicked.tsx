import { useEffect } from "react";
import { extension_helper } from "../helper";
import { takeQueuedSearchNavigation } from "../roamSearchHotkeys";
import {
  consumeQueuedRouteIntent,
  expireQueuedRouteIntentSoon,
} from "../routeIntent";
import { useEvent } from "./useEvent";

export type RouteSyncMeta = {
  ensureMainWindow?: boolean;
  fromSearchSelection?: boolean;
  fromTabSwitch?: boolean;
  forceOpenInNewTab?: boolean;
  targetTabId?: string;
  targetUid?: string;
  source:
    | "currententrychange"
    | "hashchange"
    | "navigate"
    | "popstate"
    | "unknown";
};

let listeners: ((uid?: string, meta?: RouteSyncMeta) => void)[] = [];
export function useOnUidWillChange(
  callback: (uid?: string, meta?: RouteSyncMeta) => void
) {
  const cb = useEvent(callback);
  // console.log("useOnUidWillChange: ", cb);
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
  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  let lastSyncedUrl = "";
  let pendingDestinationUrl = "";
  let pendingMeta: RouteSyncMeta = { source: "unknown" };
  let syncRetryCount = 0;
  const maxSyncRetries = 20;

  const notifyListeners = (uid?: string, meta?: RouteSyncMeta) => {
    listeners.forEach((callback) => {
      callback(uid, meta);
    });
  };

  const getUidFromUrl = (url: string) => {
    const hash = new URL(url, window.location.origin).hash;
    const escapedGraphName = window.roamAlphaAPI.graph.name.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    const regex = new RegExp(`/${escapedGraphName}/page/([^/?#]+)`);
    const result = regex.exec(hash);
    return result?.[1] ? decodeURIComponent(result[1]) : undefined;
  };

  const syncTabs = (url: string, meta: RouteSyncMeta = { source: "unknown" }) => {
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = undefined;
    }
    pendingDestinationUrl = "";
    pendingMeta = { source: "unknown" };
    syncRetryCount = 0;
    const searchNavigation = takeQueuedSearchNavigation();
    if (url === lastSyncedUrl) {
      expireQueuedRouteIntentSoon();
      return;
    }
    lastSyncedUrl = url;
    const nextUid = getUidFromUrl(url);
    notifyListeners(nextUid, {
      ...meta,
      ...searchNavigation,
      ...consumeQueuedRouteIntent(nextUid),
    });
  };

  const scheduleCommittedRouteSync = (
    expectedUrl?: string,
    meta: RouteSyncMeta = { source: "unknown" }
  ) => {
    if (expectedUrl) {
      pendingDestinationUrl = expectedUrl;
    }
    pendingMeta = meta;
    if (syncTimer) {
      clearTimeout(syncTimer);
    }

    const waitForCommittedLocation = () => {
      const currentUrl = window.location.href;
      if (
        pendingDestinationUrl &&
        currentUrl !== pendingDestinationUrl &&
        syncRetryCount < maxSyncRetries
      ) {
        syncRetryCount += 1;
        syncTimer = setTimeout(
          waitForCommittedLocation,
          syncRetryCount < 5 ? 0 : 25
        );
        return;
      }
      syncTabs(currentUrl, pendingMeta);
    };

    syncTimer = setTimeout(waitForCommittedLocation, 0);
  };

  const clearTransientPortals = () => {
    const portals = document.querySelectorAll(".bp3-portal");
    portals.forEach((portal) => {
      if (portal.querySelector(".roam-lift-toast")) {
        return;
      }
      portal.remove();
    });
  };

  const onRouteChange = () => {
    clearTransientPortals();
    syncTabs(window.location.href, { source: "hashchange" });
  };

  const onNavigate = (e: {
    destination?: { url?: string };
    navigationType?: string;
  }) => {
    const meta: RouteSyncMeta = {
      source: "navigate",
      ensureMainWindow: e.navigationType === "traverse",
    };
    if (e.navigationType === "traverse") {
      scheduleCommittedRouteSync(e.destination?.url, meta);
      return;
    }
    syncTabs(e.destination?.url || window.location.href, meta);
  };

  const onPopstate = () => {
    syncTabs(window.location.href, {
      source: "popstate",
      ensureMainWindow: true,
    });
  };

  const onCurrentEntryChange = () => {
    syncTabs(
      window.location.href,
      pendingMeta.source === "unknown"
        ? { source: "currententrychange" }
        : pendingMeta
    );
  };

  window.addEventListener("hashchange", onRouteChange);
  window.addEventListener("popstate", onPopstate);
  window.navigation?.addEventListener("navigate", onNavigate);
  window.navigation?.addEventListener("currententrychange", onCurrentEntryChange);
  extension_helper.on_uninstall(() => {
    window.removeEventListener("hashchange", onRouteChange);
    window.removeEventListener("popstate", onPopstate);
    if (syncTimer) {
      clearTimeout(syncTimer);
    }
    window.navigation?.removeEventListener("navigate", onNavigate);
    window.navigation?.removeEventListener(
      "currententrychange",
      onCurrentEntryChange
    );
  });
}

observeElementClicked();
