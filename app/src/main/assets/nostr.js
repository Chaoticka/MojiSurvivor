// nostr.js: Nostr relay client, NIP-30 emoji discovery, and NIP-55 signer bridge

// Curated high-res Nostr community reserve emojis (SVG & WebP)
const NOSTR_RESERVE_EMOJIS = [
  { shortcode: 'pepe_zap', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%234CAF50"/><text x="20" y="27" font-size="20" text-anchor="middle">⚡🐸</text></svg>' },
  { shortcode: 'gm', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23FF9800"/><text x="20" y="27" font-size="18" text-anchor="middle" fill="white" font-weight="bold">GM</text></svg>' },
  { shortcode: 'pleb', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23607D8B"/><text x="20" y="27" font-size="20" text-anchor="middle">🧢</text></svg>' },
  { shortcode: 'bitcoin', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23F7931A"/><text x="20" y="27" font-size="22" text-anchor="middle" fill="white" font-weight="bold">₿</text></svg>' },
  { shortcode: 'nostr_ostrich', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%238A2BE2"/><text x="20" y="27" font-size="20" text-anchor="middle">🦩</text></svg>' },
  { shortcode: 'laser_eyes', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23212121"/><text x="20" y="27" font-size="20" text-anchor="middle">👀⚡</text></svg>' },
  { shortcode: 'hodl', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%2300BCD4"/><text x="20" y="27" font-size="18" text-anchor="middle" fill="white" font-weight="bold">💎</text></svg>' },
  { shortcode: 'zap_cat', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23E91E63"/><text x="20" y="27" font-size="20" text-anchor="middle">🐱⚡</text></svg>' },
  { shortcode: 'cyber_skull', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23111111" stroke="%23FF1493" stroke-width="2"/><text x="20" y="27" font-size="20" text-anchor="middle">💀</text></svg>' },
  { shortcode: 'flame', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23FF5722"/><text x="20" y="27" font-size="20" text-anchor="middle">🔥</text></svg>' },
  { shortcode: 'moon', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%233F51B5"/><text x="20" y="27" font-size="20" text-anchor="middle">🌕</text></svg>' },
  { shortcode: 'rocket', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%239C27B0"/><text x="20" y="27" font-size="20" text-anchor="middle">🚀</text></svg>' },
  { shortcode: 'chad', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23795548"/><text x="20" y="27" font-size="20" text-anchor="middle">🗿</text></svg>' },
  { shortcode: 'alien_cyber', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%2300E676"/><text x="20" y="27" font-size="20" text-anchor="middle">👽</text></svg>' },
  { shortcode: 'matrix_orb', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23000000" stroke="%2300FF88" stroke-width="2"/><text x="20" y="27" font-size="18" text-anchor="middle" fill="%2300FF88">01</text></svg>' },
  { shortcode: 'demon_bug', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23D50000"/><text x="20" y="27" font-size="20" text-anchor="middle">👾</text></svg>' },
  { shortcode: 'lightning_bot', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23FFEB3B"/><text x="20" y="27" font-size="20" text-anchor="middle">🤖⚡</text></svg>' },
  { shortcode: 'purple_ghost', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23673AB7"/><text x="20" y="27" font-size="20" text-anchor="middle">👻</text></svg>' },
  { shortcode: 'cypher_key', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23FF4081"/><text x="20" y="27" font-size="20" text-anchor="middle">🔑</text></svg>' },
  { shortcode: 'satoshi_hat', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23424242"/><text x="20" y="27" font-size="20" text-anchor="middle">🎩</text></svg>' },
  { shortcode: 'toxic_shroom', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23AA00FF"/><text x="20" y="27" font-size="20" text-anchor="middle">🍄</text></svg>' },
  { shortcode: 'pixel_crown', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23FFD700"/><text x="20" y="27" font-size="20" text-anchor="middle">👑</text></svg>' },
  { shortcode: 'ninja_blade', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23263238"/><text x="20" y="27" font-size="20" text-anchor="middle">🥷</text></svg>' },
  { shortcode: 'radioactive', url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="%23FFEA00"/><text x="20" y="27" font-size="20" text-anchor="middle">☢️</text></svg>' }
];

class NostrManager {
  constructor() {
    this.relays = [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net'
    ];
    this.sockets = [];
    this.discoveredEmojis = new Map(); // shortcode -> emoji def with stats
    this.cachedImages = new Map(); // url -> HTMLImageElement
    this.signerType = 'guest'; // 'amber' | 'guest' | 'nip07'
    this.pubkey = '';
    this.privkey = '';
    this.leaderboardRuns = [];
    this.pendingCallbacks = new Map();

    this.initKeys();
    this.setupAmberBridge();
    this.preloadReserveEmojis();
    this.connectRelays();
  }

  initKeys() {
    const storage = window.SafeStorage || { getItem: () => null, setItem: () => {} };
    let savedPriv = storage.getItem('mojisurvivor_privkey');
    let savedPub = storage.getItem('mojisurvivor_pubkey');
    if (!savedPriv) {
      // Generate pseudo-random 32 byte hex
      savedPriv = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      savedPub = (window.MojiCrypto && window.MojiCrypto.sha256Sync) ? window.MojiCrypto.sha256Sync(savedPriv) : savedPriv;
      storage.setItem('mojisurvivor_privkey', savedPriv);
      storage.setItem('mojisurvivor_pubkey', savedPub);
    }
    this.privkey = savedPriv;
    this.pubkey = savedPub || ((window.MojiCrypto && window.MojiCrypto.sha256Sync) ? window.MojiCrypto.sha256Sync(savedPriv) : savedPriv);
  }

  setupAmberBridge() {
    // Listen for Amber results from Android bridge
    window.onAmberResult = (callbackId, resultJson) => {
      try {
        const data = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
        const cb = this.pendingCallbacks.get(callbackId);
        if (cb) {
          this.pendingCallbacks.delete(callbackId);
          cb(data);
        }
      } catch (e) {
        console.error('Amber callback parsing error:', e);
      }
    };
  }

  isAndroidBridgeAvailable() {
    return typeof window.AndroidNostrBridge !== 'undefined';
  }

  requestAmberPublicKey(callback) {
    if (!this.isAndroidBridgeAvailable()) {
      callback({ status: 'error', message: 'Android bridge not available' });
      return;
    }
    const id = 'req_' + Date.now();
    this.pendingCallbacks.set(id, callback);
    try {
      window.AndroidNostrBridge.requestExternalPublicKey(id);
    } catch (e) {
      this.pendingCallbacks.delete(id);
      callback({ status: 'error', message: e.message });
    }
  }

  requestAmberSignEvent(eventObj, callback) {
    if (!this.isAndroidBridgeAvailable()) {
      callback({ status: 'error', message: 'Android bridge not available' });
      return;
    }
    const id = 'sign_' + Date.now();
    this.pendingCallbacks.set(id, callback);
    try {
      const jsonStr = JSON.stringify(eventObj);
      window.AndroidNostrBridge.requestSignEvent(id, jsonStr);
    } catch (e) {
      this.pendingCallbacks.delete(id);
      callback({ status: 'error', message: e.message });
    }
  }

  preloadReserveEmojis() {
    NOSTR_RESERVE_EMOJIS.forEach(item => {
      const stats = window.MojiCrypto.deriveEmojiStats(item.shortcode, item.url);
      this.discoveredEmojis.set(item.shortcode, stats);
      this.loadImage(item.url);
    });
  }

  loadImage(url) {
    if (this.cachedImages.has(url)) {
      return this.cachedImages.get(url);
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    this.cachedImages.set(url, img);
    return img;
  }

  connectRelays() {
    this.relays.forEach(url => {
      try {
        const ws = new WebSocket(url);
        ws.onopen = () => {
          this.subscribeToEmojis(ws);
          this.subscribeToLeaderboard(ws);
        };
        ws.onmessage = (event) => {
          this.handleRelayMessage(event.data);
        };
        ws.onerror = () => {};
        this.sockets.push(ws);
      } catch (_) {}
    });
  }

  subscribeToEmojis(ws) {
    // Query NIP-30 emoji sets (30030) and user lists (10030)
    const subMsg = JSON.stringify([
      "REQ",
      "emojis_sub",
      {
        kinds: [30030, 10030],
        limit: 30
      }
    ]);
    try {
      ws.send(subMsg);
    } catch (_) {}
  }

  subscribeToLeaderboard(ws) {
    // Query verified MojiSurvivor receipts (Kind 30078 with #t=mojisurvivor)
    const subMsg = JSON.stringify([
      "REQ",
      "scores_sub",
      {
        kinds: [30078, 1],
        "#t": ["mojisurvivor"],
        limit: 40
      }
    ]);
    try {
      ws.send(subMsg);
    } catch (_) {}
  }

  handleRelayMessage(msgText) {
    try {
      const msg = JSON.parse(msgText);
      if (msg[0] === 'EVENT') {
        const ev = msg[2];
        if (ev.kind === 30030 || ev.kind === 10030) {
          this.parseEmojiEvent(ev);
        } else if ((ev.kind === 30078 || ev.kind === 1) && ev.tags) {
          this.parseScoreEvent(ev);
        }
      }
    } catch (_) {}
  }

  parseEmojiEvent(ev) {
    if (!ev.tags) return;
    ev.tags.forEach(tag => {
      if (tag[0] === 'emoji' && tag[1] && tag[2]) {
        const shortcode = tag[1].toLowerCase().replace(/[^a-z0-9_]/g, '');
        const url = tag[2];
        if (shortcode && url && !this.discoveredEmojis.has(shortcode)) {
          const stats = window.MojiCrypto.deriveEmojiStats(shortcode, url);
          this.discoveredEmojis.set(shortcode, stats);
          this.loadImage(url);
        }
      }
    });
  }

  parseScoreEvent(ev) {
    let score = 0;
    let wave = 1;
    let defeated = 0;
    let runId = ev.id ? ev.id.substring(0, 8) : 'run';

    ev.tags.forEach(tag => {
      if (tag[0] === 'score') score = parseInt(tag[1], 10) || 0;
      if (tag[0] === 'wave') wave = parseInt(tag[1], 10) || 1;
      if (tag[0] === 'defeated') defeated = parseInt(tag[1], 10) || 0;
      if (tag[0] === 'd' && tag[1]) runId = tag[1].split(':').pop() || runId;
    });

    if (score > 0) {
      const entry = {
        id: ev.id || runId,
        pubkey: ev.pubkey,
        score,
        wave,
        defeated,
        created_at: ev.created_at || Math.floor(Date.now() / 1000),
        sig: ev.sig ? ev.sig.substring(0, 16) + '...' : 'local-valid'
      };

      // Avoid duplicates
      if (!this.leaderboardRuns.some(r => r.id === entry.id)) {
        this.leaderboardRuns.push(entry);
        this.leaderboardRuns.sort((a, b) => b.score - a.score);
        if (window.onLeaderboardUpdated) {
          window.onLeaderboardUpdated();
        }
      }
    }
  }

  async createAndPublishRunReceipt(runData) {
    const timestamp = Math.floor(Date.now() / 1000);
    const runHash = window.MojiCrypto.sha256Sync(`${this.pubkey}:${runData.score}:${timestamp}`).substring(0, 12);
    const dTag = `mojisurvivor:run:${timestamp}:${runHash}`;

    const rawEvent = {
      kind: 30078,
      pubkey: this.pubkey,
      created_at: timestamp,
      tags: [
        ["d", dTag],
        ["t", "mojisurvivor"],
        ["score", String(runData.score)],
        ["wave", String(runData.wave)],
        ["defeated", String(runData.defeated)],
        ["bosses", String(runData.bossesDefeated || 0)],
        ["weapons", runData.weaponsSummary || "standard"],
        ["client", "mojisurvivor-app"]
      ],
      content: JSON.stringify({
        score: runData.score,
        wave: runData.wave,
        defeated: runData.defeated,
        timeSurvived: runData.timeSurvived,
        mojoEarned: runData.mojoEarned
      })
    };

    // Calculate event id
    const serialized = JSON.stringify([
      0,
      rawEvent.pubkey,
      rawEvent.created_at,
      rawEvent.kind,
      rawEvent.tags,
      rawEvent.content
    ]);
    const eventId = window.MojiCrypto.sha256Sync(serialized);
    rawEvent.id = eventId;

    return new Promise((resolve) => {
      if (this.signerType === 'amber') {
        this.requestAmberSignEvent(rawEvent, (res) => {
          if (res.status === 'success') {
            rawEvent.sig = res.signature;
            this.broadcastEvent(rawEvent);
            this.parseScoreEvent(rawEvent);
            resolve({ success: true, event: rawEvent });
          } else {
            // Sign locally as fallback receipt
            rawEvent.sig = window.MojiCrypto.sha256Sync(eventId + this.privkey);
            this.broadcastEvent(rawEvent);
            this.parseScoreEvent(rawEvent);
            resolve({ success: true, event: rawEvent, fallback: true });
          }
        });
      } else {
        // Sign with local ephemeral key
        rawEvent.sig = window.MojiCrypto.sha256Sync(eventId + this.privkey);
        this.broadcastEvent(rawEvent);
        this.parseScoreEvent(rawEvent);
        resolve({ success: true, event: rawEvent });
      }
    });
  }

  broadcastEvent(eventObj) {
    const payload = JSON.stringify(["EVENT", eventObj]);
    this.sockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch (_) {}
      }
    });
  }

  getRandomEmoji() {
    const entries = Array.from(this.discoveredEmojis.values());
    if (entries.length === 0) {
      return NOSTR_RESERVE_EMOJIS[0];
    }
    return entries[Math.floor(Math.random() * entries.length)];
  }
}

window.NostrClient = new NostrManager();
