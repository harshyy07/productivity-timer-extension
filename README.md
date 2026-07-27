# 🏠 HomeBuild Timer

HomeBuild Timer is a gamified productivity Chrome Extension designed to help you stay focused. As you work, a house is built in real-time. If you get distracted and visit non-allowed websites, your house will shake, warn you, and eventually collapse!

---

## 🚀 Features

- **Gamified Focus Timer:** Set a focus duration (in minutes) and watch your house build from foundation to chimney as the timer progresses.
- **Dynamic Building Stages:**
  - 🧱 **0% – 24%**: Foundation is laid.
  - 🧱 **25% – 49%**: Walls are built.
  - 🏠 **50% – 74%**: Roof is added.
  - 🏡 **75% – 100%**: Finishing details (chimney, doors, windows) are completed!
- **Smart Allowlist:** Define domains that are "productive" (e.g., `github.com`, `stackoverflow.com`). All other websites are blocked while the timer is active.
- **Double-Strike Violation System:**
  - **Sliding window(5s):** Leaving the browser or visiting a non-allowed website triggers a 5-second grace period with a flashing amber warning overlay.
  - **Strike 1 (Warning):** If you don't return to an allowed site in time, you receive your first strike. The house shakes violently and a red flash covers the page.
  - **Strike 2 (Failure):** A second violation causes the house to collapse entirely, failing the focus session.
- **Session Stats & History:** Track your productivity progress with a dashboard showing total focus time, completed vs. failed sessions, and recent session history.
- **Seamless Side Panel Integration:** Built using Chrome Extension Manifest V3, the control center resides elegantly inside Chrome's native side panel.

---

## 📁 File Structure

```text
├── assets/
│   └── house.svg             # The layered vector illustration of the building stages
├── background/
│   └── service-worker.js     # Manages timer alarms, tab checks, and grace period logic
├── icons/
│   ├── icon-16.png           # Extension icon (16x16)
│   ├── icon-48.png           # Extension icon (48x48)
│   └── icon-128.png          # Extension icon (128x128)
├── popup/
│   ├── popup.html            # UI skeleton for Chrome side panel
│   ├── popup.css             # Theme styles and CSS animations (shake, collapse, progress)
│   └── popup.js              # Renders live state, controls, stats, and SVG classes
├── content.js                # Injected content script to flash warning screens on bad tabs
├── manifest.json             # Extension manifest (MV3 configuration)
└── README.md                 # Project documentation
```

---

## 🛠️ How it Works under the Hood

1. **State Management:** Uses `chrome.storage.session` for short-lived session states (timer active, start/end times, strikes, grace periods) and `chrome.storage.local` for persistent configurations (allowlist, cumulative user statistics, and history).
2. **Focus Tracking:**
   - Monitors tab activation (`chrome.tabs.onActivated`) and URL updates (`chrome.tabs.onUpdated`).
   - Detects browser focus changes (`chrome.windows.onFocusChanged`) to ensure you don't wander away from the browser.
3. **Interactive Warning System:** When an un-allowed tab becomes active, the background script alerts `content.js` to draw a flashing warning overlay. Returning to an allowed tab stops the flash immediately.
4. **SVG Stage Revealing:** Custom CSS classes (`show-foundation`, `show-walls`, etc.) are dynamically injected into `house.svg` based on the elapsed focus time ratio.

---

## 📥 Installation

Since this extension is not yet published on the Chrome Web Store, you can load it locally:

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the repository folder (the directory containing `manifest.json`).
6. Click the extension icon in the toolbar or open the **Side Panel** to start building!
