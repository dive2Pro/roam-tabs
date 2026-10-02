type QueuedRouteIntent = {
  fromTabSwitch: boolean;
  targetTabId?: string;
  targetUid?: string;
};

const emptyQueuedRouteIntent = (): QueuedRouteIntent => ({
  fromTabSwitch: false,
});

let queuedIntent: QueuedRouteIntent = emptyQueuedRouteIntent();
let queuedResetTimer: ReturnType<typeof setTimeout> | undefined;

function clearQueuedRouteIntent() {
  queuedIntent = emptyQueuedRouteIntent();
  if (queuedResetTimer) {
    clearTimeout(queuedResetTimer);
    queuedResetTimer = undefined;
  }
}

function armIntentReset() {
  armIntentResetWithDelay(1000);
}

function armIntentResetWithDelay(delayMs: number) {
  if (queuedResetTimer) {
    clearTimeout(queuedResetTimer);
  }
  queuedResetTimer = setTimeout(() => {
    clearQueuedRouteIntent();
  }, delayMs);
}

export function queueTabSwitchNavigation(tabId: string, targetUid?: string) {
  queuedIntent = {
    fromTabSwitch: true,
    targetTabId: tabId,
    targetUid,
  };
  armIntentReset();
}

export function clearQueuedRouteIntentNow() {
  clearQueuedRouteIntent();
}

export function peekQueuedRouteIntent(): QueuedRouteIntent {
  return queuedIntent;
}

export function consumeQueuedRouteIntent(expectedUid?: string): QueuedRouteIntent {
  if (!queuedIntent.fromTabSwitch) {
    return emptyQueuedRouteIntent();
  }

  if (queuedIntent.targetUid) {
    if (!expectedUid) {
      return emptyQueuedRouteIntent();
    }

    if (queuedIntent.targetUid !== expectedUid) {
      expireQueuedRouteIntentSoon();
      return emptyQueuedRouteIntent();
    }
  }

  const intent = queuedIntent;
  clearQueuedRouteIntent();
  return intent;
}

export function expireQueuedRouteIntentSoon(delayMs = 100) {
  if (!queuedIntent.fromTabSwitch) {
    return;
  }
  armIntentResetWithDelay(delayMs);
}
