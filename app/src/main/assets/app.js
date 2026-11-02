// app.js: UI Orchestrator, Storage, Codex, Upgrade Lab & Leaderboard Management

class AppStorageManager {
  constructor() {
    this.data = {
      mojoBalance: 0,
      highScore: 0,
      bestWave: 1,
      totalKills: 0,
      upgrades: {
        attack: 0,
        defense: 0,
        speed: 0,
        regen: 0,
        magnet: 0
      },
      discoveredEmojis: {},
      settings: {
        sfx: true,
        crt: true,
        shake: true,
        haptic: true
      }
    };
    this.load();
  }

  load() {
    try {
      const storage = window.SafeStorage || { getItem: () => null, setItem: () => {} };
      let saved = storage.getItem('mojisurvivor_save');
      // If Android SharedPreferences has a backup, synchronize
      if (window.AndroidNostrBridge) {
        const androidSaved = window.AndroidNostrBridge.getSavedGameState();
        if (androidSaved && androidSaved.length > 10) {
          saved = androidSaved;
        }
      }
      if (saved) {
        const parsed = JSON.parse(saved);
        this.data = { ...this.data, ...parsed };
      }
    } catch (_) {}
  }

  save() {
    try {
      const storage = window.SafeStorage || { getItem: () => null, setItem: () => {} };
      const jsonStr = JSON.stringify(this.data);
      storage.setItem('mojisurvivor_save', jsonStr);
      if (window.AndroidNostrBridge) {
        window.AndroidNostrBridge.saveGameState(jsonStr);
      }
    } catch (_) {}
  }

  getUpgrades() {
    return this.data.upgrades;
  }

  getMojo() {
    return this.data.mojoBalance;
  }

  addMojo(amount) {
    this.data.mojoBalance += amount;
    this.save();
    this.updateLobbyStats();
  }

  spendMojo(amount) {
    if (this.data.mojoBalance >= amount) {
      this.data.mojoBalance -= amount;
      this.save();
      this.updateLobbyStats();
      return true;
    }
    return false;
  }

  recordRunResult(result) {
    if (result.score > this.data.highScore) {
      this.data.highScore = result.score;
    }
    if (result.wave > this.data.bestWave) {
      this.data.bestWave = result.wave;
    }
    this.data.totalKills += (result.defeated || 0);
    this.save();
    this.updateLobbyStats();
  }

  recordEmojiDefeated(shortcode, power) {
    if (!this.data.discoveredEmojis[shortcode]) {
      this.data.discoveredEmojis[shortcode] = {
        firstKilled: Date.now(),
        kills: 0,
        powerRating: power
      };
    }
    this.data.discoveredEmojis[shortcode].kills++;
    this.save();
  }

  isEmojiDiscovered(shortcode) {
    return !!this.data.discoveredEmojis[shortcode];
  }

  getSetting(key) {
    return this.data.settings[key] ?? true;
  }

  setSetting(key, val) {
    this.data.settings[key] = val;
    this.save();
  }

  updateLobbyStats() {
    const mojoEl = document.getElementById('lobby-mojo');
    const scoreEl = document.getElementById('lobby-highscore');
    const waveEl = document.getElementById('lobby-bestwave');
    if (mojoEl) mojoEl.innerText = `${this.data.mojoBalance} ⟡`;
    if (scoreEl) scoreEl.innerText = this.data.highScore.toLocaleString();
    if (waveEl) waveEl.innerText = this.data.bestWave;
  }
}

window.AppStorage = new AppStorageManager();

// App Controller
let gameInstance = null;
function initApp() {
  const canvas = document.getElementById('game-canvas');
  if (canvas && window.MojiSurvivorGame) {
    try {
      gameInstance = new window.MojiSurvivorGame(canvas);
    } catch (e) {
      console.error('Error creating MojiSurvivorGame:', e);
    }
  }

  if (window.AppStorage) {
    window.AppStorage.updateLobbyStats();
  }
  initSettingsUI();
  renderUpgradeLab();
  renderCodex();
  renderLeaderboard();
  checkSignerStatus();

  window.onLeaderboardUpdated = () => {
    renderLeaderboard();
  };
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

function switchTab(viewId) {
  const views = document.querySelectorAll('.game-view');
  views.forEach(v => v.classList.remove('active'));

  const target = document.getElementById(`view-${viewId}`);
  if (target) {
    target.classList.add('active');
  }

  const header = document.getElementById('main-header');
  if (header) {
    // Hide header during active arena battle
    if (viewId === 'arena') {
      header.classList.add('hidden');
    } else {
      header.classList.remove('hidden');
    }
  }

  if (viewId === 'lab') {
    renderUpgradeLab();
  } else if (viewId === 'codex') {
    renderCodex();
  } else if (viewId === 'leaderboard') {
    renderLeaderboard();
  }
}

function startGame() {
  switchTab('arena');
  setTimeout(() => {
    gameInstance.startNewGame();
  }, 100);
}

function togglePause() {
  if (!gameInstance || !gameInstance.running) return;
  gameInstance.paused = !gameInstance.paused;
  const modal = document.getElementById('pause-modal');
  if (modal) {
    if (gameInstance.paused) {
      document.getElementById('pause-run-stats').innerHTML = `
        <p>Current Wave: <strong>${gameInstance.wave}</strong></p>
        <p>Score: <strong>${gameInstance.score.toLocaleString()}</strong></p>
        <p>Enemies Defeated: <strong>${gameInstance.enemiesDefeated}</strong></p>
        <p>Mojo Earned: <strong>${gameInstance.mojoEarned} ⟡</strong></p>
      `;
      modal.classList.remove('hidden');
    } else {
      modal.classList.add('hidden');
    }
  }
}

function abandonRun() {
  const modal = document.getElementById('pause-modal');
  if (modal) modal.classList.add('hidden');
  if (gameInstance) {
    gameInstance.gameOver();
  }
}

function closeGameOverAndReturn() {
  const modal = document.getElementById('game-over-modal');
  if (modal) modal.classList.add('hidden');
  switchTab('lobby');
}

async function publishRunReceipt() {
  const pubBtn = document.getElementById('btn-publish-receipt');
  const statusBadge = document.getElementById('pub-receipt-status');
  if (pubBtn) pubBtn.disabled = true;

  if (statusBadge) {
    statusBadge.innerText = 'Signing...';
    statusBadge.className = 'badge';
  }

  const runData = {
    score: gameInstance.score,
    wave: gameInstance.wave,
    defeated: gameInstance.enemiesDefeated,
    bossesDefeated: gameInstance.bossesDefeated,
    timeSurvived: gameInstance.timeSurvived,
    mojoEarned: gameInstance.mojoEarned,
    weaponsSummary: gameInstance.player.weapons.map(w => `${w.id}_lvl${w.level}`).join(',')
  };

  try {
    const result = await window.NostrClient.createAndPublishRunReceipt(runData);
    if (result.success) {
      if (statusBadge) {
        statusBadge.innerText = 'Broadcast Confirmed!';
        statusBadge.className = 'badge success';
      }
      if (pubBtn) {
        pubBtn.innerText = '✓ SCORE PUBLISHED TO RELAYS';
      }
      setTimeout(() => {
        closeGameOverAndReturn();
        switchTab('leaderboard');
      }, 1200);
    }
  } catch (err) {
    if (statusBadge) {
      statusBadge.innerText = 'Publish Failed';
    }
    if (pubBtn) pubBtn.disabled = false;
  }
}

// -------------------------------------------------------------
// UPGRADE LAB LOGIC
// -------------------------------------------------------------
const LAB_CATEGORIES = [
  { id: 'attack', name: 'Cybernetic Claws (Attack)', icon: '⚔️', desc: '+12% Base spell damage per tier.', maxTier: 5, basePrice: 15 },
  { id: 'defense', name: 'Nanotech Plating (Defense)', icon: '🛡️', desc: '+15 Max HP and -8% incoming damage.', maxTier: 5, basePrice: 15 },
  { id: 'speed', name: 'Hyper Thrusters (Speed)', icon: '⚡', desc: '+10% Movement speed and dodging agility.', maxTier: 5, basePrice: 20 },
  { id: 'regen', name: 'Bio-Repair Nanites (Regen)', icon: '💖', desc: 'Restores +0.5 HP per second continuously.', maxTier: 5, basePrice: 25 },
  { id: 'magnet', name: 'Quantum Core (Magnet Radius)', icon: '🧲', desc: '+25px Pick-up suction range for gems and Mojo.', maxTier: 5, basePrice: 10 }
];

function renderUpgradeLab() {
  const container = document.getElementById('upgrades-list-container');
  const balanceEl = document.getElementById('lab-mojo-balance');
  if (!container) return;

  const currentMojo = window.AppStorage.getMojo();
  if (balanceEl) balanceEl.innerText = `${currentMojo} ⟡`;

  const upgrades = window.AppStorage.getUpgrades();
  container.innerHTML = '';

  LAB_CATEGORIES.forEach(cat => {
    const currentTier = upgrades[cat.id] || 0;
    const isMax = currentTier >= cat.maxTier;
    const price = Math.floor(cat.basePrice * Math.pow(1.6, currentTier));

    const row = document.createElement('div');
    row.className = 'upgrade-row';

    let meterHtml = '';
    for (let p = 1; p <= cat.maxTier; p++) {
      meterHtml += `<div class="meter-pip ${p <= currentTier ? 'filled' : ''}"></div>`;
    }

    row.innerHTML = `
      <div class="upgrade-row-icon">${cat.icon}</div>
      <div class="upgrade-row-info">
        <h4>${cat.name}</h4>
        <p>${cat.desc}</p>
        <div class="upgrade-meter">${meterHtml}</div>
      </div>
      <div>
        ${isMax ? '<button class="btn-buy-upgrade disabled">MAX</button>' :
          `<button class="btn-buy-upgrade ${currentMojo < price ? 'disabled' : ''}" onclick="buyUpgrade('${cat.id}', ${price})">
            ${price} ⟡
          </button>`
        }
      </div>
    `;
    container.appendChild(row);
  });
}

function buyUpgrade(id, price) {
  if (window.AppStorage.spendMojo(price)) {
    const upgrades = window.AppStorage.getUpgrades();
    upgrades[id] = (upgrades[id] || 0) + 1;
    window.AppStorage.save();
    window.RetroAudio.playLevelUp();
    renderUpgradeLab();
  }
}

// -------------------------------------------------------------
// EMOJI CODEX (LOCAL DISCOVERED & GLOBAL CODEX)
// -------------------------------------------------------------
function switchCodexTab(tab) {
  currentCodexTab = tab;
  document.getElementById('tab-codex-local').className = `tab-pill ${tab === 'local' ? 'active' : ''}`;
  document.getElementById('tab-codex-global').className = `tab-pill ${tab === 'global' ? 'active' : ''}`;
  renderCodex();
}

function renderCodex() {
  const container = document.getElementById('codex-grid-container');
  const counterEl = document.getElementById('codex-counter');
  const searchInput = document.getElementById('codex-search');
  if (!container) return;

  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const allEmojis = Array.from(window.NostrClient.discoveredEmojis.values());

  container.innerHTML = '';
  let discoveredCount = 0;

  allEmojis.forEach(em => {
    const isDiscovered = window.AppStorage.isEmojiDiscovered(em.shortcode);
    if (isDiscovered) discoveredCount++;

    // In local tab, undiscovered are hidden or displayed with ???
    if (query && !em.shortcode.toLowerCase().includes(query) && !em.hash.includes(query)) {
      return;
    }

    const card = document.createElement('div');
    const showDetails = currentCodexTab === 'global' || isDiscovered;

    card.className = `codex-card ${showDetails ? 'discovered' : 'undiscovered'}`;
    card.innerHTML = `
      <img class="codex-emoji-thumb" src="${em.url}" alt="${em.shortcode}">
      <span class="codex-name">${showDetails ? `:${em.shortcode}:` : '???'}</span>
      <span class="codex-tier-badge">${showDetails ? em.tier : 'UNKNOWN'}</span>
      <div class="codex-stats-row">
        <span>HP: ${showDetails ? em.hp : '??'}</span>
        <span>SPD: ${showDetails ? em.speed.toFixed(1) : '??'}</span>
        <span>ATK: ${showDetails ? em.damage : '??'}</span>
      </div>
      <div class="codex-stats-row">
        <span>TYPE: ${showDetails ? em.behaviorName : '???'}</span>
        <span>PWR: ${showDetails ? em.powerRating : '???'}</span>
      </div>
    `;
    container.appendChild(card);
  });

  if (counterEl) {
    counterEl.innerText = `Discovered: ${discoveredCount} / ${allEmojis.length}`;
  }
}

function filterCodex() {
  renderCodex();
}

// -------------------------------------------------------------
// LEADERBOARDS
// -------------------------------------------------------------
function renderLeaderboard() {
  const tbody = document.getElementById('leaderboard-tbody');
  if (!tbody) return;

  const runs = window.NostrClient.leaderboardRuns;
  tbody.innerHTML = '';

  if (runs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color:#B8B8B8;">Querying Nostr relays for high scores...</td></tr>`;
    return;
  }

  runs.slice(0, 50).forEach((run, idx) => {
    const tr = document.createElement('tr');
    const isMe = run.pubkey === window.NostrClient.pubkey;

    tr.innerHTML = `
      <td class="table-rank">#${idx + 1}</td>
      <td>
        <div class="player-cell">
          <img class="player-thumb" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><circle cx='10' cy='10' r='9' fill='%23FF1493'/></svg>">
          <span>${isMe ? 'YOU' : window.MojiCrypto.hexToNpub(run.pubkey).substring(0, 11) + '...'}</span>
        </div>
      </td>
      <td class="text-pink"><strong>${run.score.toLocaleString()}</strong></td>
      <td>Wave ${run.wave}</td>
      <td>${run.defeated}</td>
      <td><span class="badge success">✓ ${run.sig.substring(0, 8)}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function refreshLeaderboard() {
  window.NostrClient.connectRelays();
  renderLeaderboard();
}

// -------------------------------------------------------------
// SETTINGS & SIGNER
// -------------------------------------------------------------
function initSettingsUI() {
  const sfxToggle = document.getElementById('toggle-sfx');
  const crtToggle = document.getElementById('toggle-crt');
  const shakeToggle = document.getElementById('toggle-shake');
  const hapticToggle = document.getElementById('toggle-haptic');

  if (sfxToggle) sfxToggle.checked = window.AppStorage.getSetting('sfx');
  if (crtToggle) crtToggle.checked = window.AppStorage.getSetting('crt');
  if (shakeToggle) shakeToggle.checked = window.AppStorage.getSetting('shake');
  if (hapticToggle) hapticToggle.checked = window.AppStorage.getSetting('haptic');

  const crtOverlay = document.getElementById('crt-overlay');
  if (crtOverlay) {
    crtOverlay.style.display = window.AppStorage.getSetting('crt') ? 'block' : 'none';
  }

  // Populate Relays list
  const relayContainer = document.getElementById('settings-relays-list');
  if (relayContainer) {
    relayContainer.innerHTML = window.NostrClient.relays.map(r => `
      <div style="font-family:monospace; font-size:11px; padding:4px 0; color:#B8B8B8;">
        ⚡ ${r}
      </div>
    `).join('');
  }
}

function toggleSetting(key) {
  const toggle = document.getElementById(`toggle-${key}`);
  if (!toggle) return;
  window.AppStorage.setSetting(key, toggle.checked);

  if (key === 'crt') {
    const crtOverlay = document.getElementById('crt-overlay');
    if (crtOverlay) crtOverlay.style.display = toggle.checked ? 'block' : 'none';
  } else if (key === 'sfx') {
    window.RetroAudio.enabled = toggle.checked;
  }
}

function checkSignerStatus() {
  const isAmber = window.NostrClient.isAndroidBridgeAvailable() && window.AndroidNostrBridge.isAmberInstalled();
  const badge = document.getElementById('header-signer-badge');
  const statusLight = document.getElementById('signer-status-light');
  const signerType = document.getElementById('settings-signer-type');
  const pubkeyDisplay = document.getElementById('settings-pubkey-display');

  const npub = window.MojiCrypto.hexToNpub(window.NostrClient.pubkey);
  if (pubkeyDisplay) pubkeyDisplay.innerText = npub;

  if (isAmber && window.NostrClient.signerType === 'amber') {
    if (badge) badge.innerText = 'Amber NIP-55';
    if (statusLight) statusLight.style.background = '#00FF88';
    if (signerType) signerType.innerText = 'Connected via Amber Signer';
  } else {
    if (badge) badge.innerText = 'Guest Key';
    if (statusLight) statusLight.style.background = '#FF1493';
    if (signerType) signerType.innerText = 'Local Guest Key';
  }
}

function connectAmberSigner() {
  if (!window.NostrClient.isAndroidBridgeAvailable()) {
    alert('External Amber signer is supported on Android devices. Using local keypair for Web/Emulator.');
    return;
  }
  window.NostrClient.requestAmberPublicKey((res) => {
    if (res.status === 'success' && res.pubkey) {
      window.NostrClient.pubkey = res.pubkey;
      window.NostrClient.signerType = 'amber';
      localStorage.setItem('mojisurvivor_pubkey', res.pubkey);
      checkSignerStatus();
      alert('Connected to Amber Nostr Signer!');
    } else {
      alert('Amber connection cancelled or failed. Falling back to local key.');
    }
  });
}

function generateNewGuestKey() {
  localStorage.removeItem('mojisurvivor_privkey');
  localStorage.removeItem('mojisurvivor_pubkey');
  window.NostrClient.initKeys();
  window.NostrClient.signerType = 'guest';
  checkSignerStatus();
  alert('New Guest Nostr Key generated!');
}

function openProfileModal() {
  switchTab('settings');
}
