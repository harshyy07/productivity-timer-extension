// background/service-worker.js

// Configure side panel to open on extension icon click
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await checkTab(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    // Only check if it's the active tab in its window
    if (tab.active) {
      await checkTab(tabId);
    }
  }
});

// Detect when the user leaves the browser entirely
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    const { timerActive, gracePeriodActive } = await chrome.storage.session.get();
    if (!timerActive) return;
    
    if (gracePeriodActive) {
      // already in grace period
      return;
    }
    
    // Leaving browser entirely triggers grace period too
    await startGracePeriod(null);
  }
});

async function checkTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const { timerActive, gracePeriodActive } = await chrome.storage.session.get();
    const { allowlist = [] } = await chrome.storage.local.get('allowlist');

    if (!timerActive || isAllowed(tab.url, allowlist)) {
      if (timerActive) {
        if (gracePeriodActive) {
          await cancelGracePeriod();
        }
        notifyPopup({ type: 'STOP_WARNING' });
        chrome.tabs.sendMessage(tabId, { type: 'STOP_FLASH' }).catch(() => {});
      }
      return;
    }

    if (gracePeriodActive) {
      return; // Already handling a violation
    }

    await startGracePeriod(tabId);
  } catch (err) {
    console.error('Error checking tab:', err);
  }
}

let currentGraceTimeout = null;

async function startGracePeriod(tabId) {
  await chrome.storage.session.set({ gracePeriodActive: true });
  notifyPopup({ type: 'GRACE_WARNING' });
  if (tabId) chrome.tabs.sendMessage(tabId, { type: 'START_GRACE_FLASH' }).catch(() => {});

  currentGraceTimeout = setTimeout(async () => {
    const { timerActive, gracePeriodActive } = await chrome.storage.session.get();
    if (!timerActive || !gracePeriodActive) return;
    
    const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const { allowlist = [] } = await chrome.storage.local.get('allowlist');
    
    if (!activeTab || !isAllowed(activeTab.url, allowlist)) {
      await triggerStrike(activeTab ? activeTab.id : null);
    }
    
    await chrome.storage.session.set({ gracePeriodActive: false });
    currentGraceTimeout = null;
  }, 5000);
}

async function cancelGracePeriod() {
  if (currentGraceTimeout) {
    clearTimeout(currentGraceTimeout);
    currentGraceTimeout = null;
  }
  await chrome.storage.session.set({ gracePeriodActive: false });
  notifyPopup({ type: 'GRACE_CANCELLED' });
}

async function triggerStrike(tabId) {
  const { warningCount, startTime, durationMs } = await chrome.storage.session.get();
  if (warningCount === 0) {
    await chrome.storage.session.set({ warningCount: 1 });
    notifyPopup({ type: 'WARNING' });
    if (tabId) chrome.tabs.sendMessage(tabId, { type: 'START_FLASH' }).catch(() => {});
  } else {
    await chrome.storage.session.set({ timerActive: false, sessionDestroyed: true });
    notifyPopup({ type: 'DESTROYED' });
    if (tabId) chrome.tabs.sendMessage(tabId, { type: 'START_FLASH' }).catch(() => {});
    chrome.alarms.clear('focusTimer');
    await recordSession(false, startTime, durationMs);
  }
}

function isAllowed(url, allowlist) {
  if (!url) return true; // new tab, extension pages
  
  // Extension pages and settings are allowed
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return true;
  }

  try {
    const hostname = new URL(url).hostname;
    return allowlist.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return true; // if invalid URL, default allow to be safe
  }
}

chrome.alarms.onAlarm.addListener(async ({ name }) => {
  if (name === 'focusTimer') {
    const { startTime, durationMs } = await chrome.storage.session.get();
    await chrome.storage.session.set({ timerActive: false });
    notifyPopup({ type: 'COMPLETE' });
    await recordSession(true, startTime, durationMs);
  }
});

async function recordSession(isComplete, startTime, durationMs) {
  const { stats = { totalFocusTime: 0, sessionsCompleted: 0, sessionsFailed: 0, history: [] } } = await chrome.storage.local.get('stats');
  
  const elapsedMs = isComplete ? durationMs : (Date.now() - startTime);
  
  if (isComplete) {
    stats.sessionsCompleted++;
    stats.totalFocusTime += durationMs;
  } else {
    stats.sessionsFailed++;
  }
  
  stats.history.unshift({
    date: new Date().toISOString(),
    durationMs: isComplete ? durationMs : elapsedMs,
    status: isComplete ? 'completed' : 'failed'
  });
  
  if (stats.history.length > 10) {
    stats.history = stats.history.slice(0, 10);
  }
  
  await chrome.storage.local.set({ stats });
}

// Use chrome.runtime.sendMessage to communicate with popup
function notifyPopup(payload) {
  chrome.runtime.sendMessage(payload).catch(() => {}); // popup may be closed
}
