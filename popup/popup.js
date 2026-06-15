// popup/popup.js

const houseContainer = document.getElementById('house-container');
const timerDisplay = document.getElementById('timer-display');
const controls = document.getElementById('controls');
const allowlistSection = document.getElementById('allowlist-section');
const statusMessage = document.getElementById('status-message');

const timeLeftEl = document.getElementById('time-left');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');

const durationInput = document.getElementById('duration');
const startBtn = document.getElementById('start-btn');

const allowlistEl = document.getElementById('allowlist');
const newDomainInput = document.getElementById('new-domain');
const addDomainBtn = document.getElementById('add-domain-btn');

let updateInterval;
let svgDoc;

async function init() {
  try {
    // Setup Listeners first so buttons are active even if something fails later
    startBtn.addEventListener('click', startTimer);
    addDomainBtn.addEventListener('click', addDomain);
    newDomainInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addDomain();
    });

    // Load SVG
    const response = await fetch('../assets/house.svg');
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
    const svgText = await response.text();
    houseContainer.innerHTML = svgText;
    svgDoc = houseContainer.querySelector('svg');

    // Load state
    await loadAllowlist();
    await checkTimerState();

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'WARNING') {
        handleWarning();
      } else if (message.type === 'DESTROYED') {
        handleDestroyed();
      } else if (message.type === 'COMPLETE') {
        handleComplete();
      } else if (message.type === 'STOP_WARNING') {
        handleStopWarning();
      }
    });
  } catch (err) {
    statusMessage.classList.remove('hidden');
    statusMessage.textContent = 'Error: ' + (err.message || err.toString());
    statusMessage.className = 'status-message status-danger';
    console.error('Init Error:', err);
  }
}

async function loadAllowlist() {
  const { allowlist = [] } = await chrome.storage.local.get('allowlist');
  renderAllowlist(allowlist);
}

function renderAllowlist(allowlist) {
  allowlistEl.innerHTML = '';
  allowlist.forEach((domain, index) => {
    const li = document.createElement('li');
    li.textContent = domain;
    
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '×';
    deleteBtn.className = 'delete-btn';
    deleteBtn.onclick = async () => {
      allowlist.splice(index, 1);
      await chrome.storage.local.set({ allowlist });
      renderAllowlist(allowlist);
    };
    
    li.appendChild(deleteBtn);
    allowlistEl.appendChild(li);
  });
}

async function addDomain() {
  const domain = newDomainInput.value.trim().toLowerCase();
  if (!domain) return;

  const { allowlist = [] } = await chrome.storage.local.get('allowlist');
  if (!allowlist.includes(domain)) {
    allowlist.push(domain);
    await chrome.storage.local.set({ allowlist });
    renderAllowlist(allowlist);
  }
  newDomainInput.value = '';
}

async function startTimer() {
  const durationMin = parseInt(durationInput.value, 10) || 25;
  const durationMs = durationMin * 60 * 1000;
  const endTime = Date.now() + durationMs;

  await chrome.storage.session.set({
    timerActive: true,
    startTime: Date.now(),
    durationMs,
    endTime,
    warningCount: 0,
    sessionDestroyed: false
  });

  // Also store default duration for next time
  await chrome.storage.local.set({ defaultDuration: durationMin });

  chrome.alarms.create('focusTimer', { delayInMinutes: durationMin });

  // Reset animations
  houseContainer.classList.remove('anim-shake', 'house-warning', 'anim-collapse');
  if (svgDoc) svgDoc.classList.remove('house-success');

  checkTimerState();
}

async function checkTimerState() {
  const state = await chrome.storage.session.get();
  const { defaultDuration = 25 } = await chrome.storage.local.get('defaultDuration');
  durationInput.value = defaultDuration;

  clearInterval(updateInterval);

  if (state.sessionDestroyed) {
    showDestroyed();
    return;
  }

  if (state.timerActive) {
    controls.classList.add('hidden');
    allowlistSection.classList.add('hidden');
    timerDisplay.classList.remove('hidden');
    
    // We remove the automatic warningCount check here, 
    // so the UI only shakes when actively receiving WARNING message.
    
    updateTimerDisplay(state);
    updateInterval = setInterval(() => {
      updateTimerDisplay(state);
    }, 1000);
  } else {
    // Idle or complete
    if (state.endTime && Date.now() >= state.endTime && !state.sessionDestroyed) {
      showComplete();
    } else {
      showIdle();
    }
  }
}

function updateTimerDisplay(state) {
  const now = Date.now();
  const remaining = Math.max(0, state.endTime - now);
  const elapsed = state.durationMs - remaining;
  const progress = Math.min(1, Math.max(0, elapsed / state.durationMs));

  // Format time (MM:SS)
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  timeLeftEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  // Progress bar
  const percent = Math.floor(progress * 100);
  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${percent}%`;

  updateHouseStage(progress);

  if (remaining === 0) {
    clearInterval(updateInterval);
  }
}

function updateHouseStage(progress) {
  if (!svgDoc) return;
  
  // Clear classes
  svgDoc.classList.remove('show-foundation', 'show-walls', 'show-roof', 'show-details');

  if (progress >= 0.0) svgDoc.classList.add('show-foundation');
  if (progress >= 0.25) svgDoc.classList.add('show-walls');
  if (progress >= 0.50) svgDoc.classList.add('show-roof');
  if (progress >= 0.75) svgDoc.classList.add('show-details');
}

function showIdle() {
  controls.classList.remove('hidden');
  allowlistSection.classList.remove('hidden');
  timerDisplay.classList.add('hidden');
  statusMessage.classList.add('hidden');
  if (svgDoc) svgDoc.classList.remove('show-foundation', 'show-walls', 'show-roof', 'show-details');
  houseContainer.classList.remove('anim-shake', 'house-warning', 'anim-collapse');
  if (svgDoc) svgDoc.classList.remove('house-success');
}

function showWarningMessage() {
  statusMessage.textContent = '⚠️ Return to your work!';
  statusMessage.className = 'status-message status-warning';
  houseContainer.classList.add('anim-shake', 'house-warning');
}

function handleWarning() {
  playContinuousBuzz();
  showWarningMessage();
}

function handleStopWarning() {
  stopBuzz();
  statusMessage.classList.add('hidden');
  houseContainer.classList.remove('anim-shake', 'house-warning');
}

function handleDestroyed() {
  playContinuousBuzz();
  checkTimerState();
}

function handleComplete() {
  checkTimerState();
}

function showDestroyed() {
  clearInterval(updateInterval);
  controls.classList.remove('hidden');
  allowlistSection.classList.remove('hidden');
  timerDisplay.classList.add('hidden');
  
  statusMessage.textContent = 'Session failed. Try again.';
  statusMessage.className = 'status-message status-danger';
  
  houseContainer.classList.remove('anim-shake', 'house-warning');
  houseContainer.classList.add('anim-collapse');
  
  startBtn.textContent = 'Restart';
}

function showComplete() {
  controls.classList.remove('hidden');
  allowlistSection.classList.remove('hidden');
  timerDisplay.classList.add('hidden');
  
  statusMessage.textContent = 'Focus complete!';
  statusMessage.className = 'status-message status-success';
  
  if (svgDoc) svgDoc.classList.add('house-success');
  
  updateHouseStage(1); // fully built
  startBtn.textContent = 'Start New Session';
}

let currentOscillator = null;

function playContinuousBuzz() {
  if (currentOscillator) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    currentOscillator = oscillator;
  } catch (e) {
    console.error('Audio play failed', e);
  }
}

function stopBuzz() {
  if (currentOscillator) {
    currentOscillator.stop();
    currentOscillator = null;
  }
}

init();
