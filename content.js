// content.js
let flashInterval = null;
let currentOverlay = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FLASH' || message.type === 'START_FLASH') {
    startFlashScreen(false);
  } else if (message.type === 'START_GRACE_FLASH') {
    startFlashScreen(true);
  } else if (message.type === 'STOP_FLASH' || message.type === 'STOP_GRACE_FLASH') {
    stopFlashScreen();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopFlashScreen();
  }
});

function startFlashScreen(isGrace = false) {
  if (currentOverlay) return; // already flashing

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.backgroundColor = isGrace ? 'rgba(255, 165, 0, 0.3)' : 'rgba(255, 0, 0, 0.4)';
  overlay.style.zIndex = '2147483647'; // Max z-index
  overlay.style.pointerEvents = 'none';
  overlay.style.transition = 'opacity 0.1s ease-in-out';
  overlay.style.opacity = '1';
  
  document.body.appendChild(overlay);
  currentOverlay = overlay;
  
  // Continuous Flash effect
  flashInterval = setInterval(() => {
    overlay.style.opacity = overlay.style.opacity === '1' ? (isGrace ? '0.5' : '0') : '1';
  }, isGrace ? 500 : 100);
}

function stopFlashScreen() {
  if (flashInterval) {
    clearInterval(flashInterval);
    flashInterval = null;
  }
  if (currentOverlay) {
    if (currentOverlay.parentNode) currentOverlay.remove();
    currentOverlay = null;
  }
}
