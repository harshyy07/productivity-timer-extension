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
    const { timerActive, warningCount } = await chrome.storage.session.get();
    if (!timerActive) return;
    
    if (warningCount === 0) {
      await chrome.storage.session.set({ warningCount: 1 });
      notifyPopup({ type: 'WARNING' });
    } else {
      await chrome.storage.session.set({ timerActive: false, sessionDestroyed: true });
      notifyPopup({ type: 'DESTROYED' });
      chrome.alarms.clear('focusTimer');
    }
  }
});

async function checkTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const { timerActive, warningCount } = await chrome.storage.session.get();
    const { allowlist = [] } = await chrome.storage.local.get('allowlist');

    if (!timerActive || isAllowed(tab.url, allowlist)) {
      if (timerActive) {
        notifyPopup({ type: 'STOP_WARNING' });
        chrome.tabs.sendMessage(tabId, { type: 'STOP_FLASH' }).catch(() => {});
      }
      return;
    }

    if (warningCount === 0) {
      await chrome.storage.session.set({ warningCount: 1 });
      notifyPopup({ type: 'WARNING' });
      chrome.tabs.sendMessage(tabId, { type: 'START_FLASH' }).catch(() => {});
    } else {
      await chrome.storage.session.set({ timerActive: false, sessionDestroyed: true });
      notifyPopup({ type: 'DESTROYED' });
      chrome.tabs.sendMessage(tabId, { type: 'START_FLASH' }).catch(() => {});
      chrome.alarms.clear('focusTimer');
    }
  } catch (err) {
    console.error('Error checking tab:', err);
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
    await chrome.storage.session.set({ timerActive: false });
    notifyPopup({ type: 'COMPLETE' });
  }
});

// Use chrome.runtime.sendMessage to communicate with popup
function notifyPopup(payload) {
  chrome.runtime.sendMessage(payload).catch(() => {}); // popup may be closed
}
