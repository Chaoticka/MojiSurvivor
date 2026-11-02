# nostr MojiSurvivor (Android & Nsite Architecture)

A decentralized retro-arcade survivor action game where players battle waves of rogue Nostr custom emojis whose combat stats are cryptographically derived from their SHA-256 hashes. Features an in-game Bestiary / Codex discovery system, collectible and mergeable spell loadouts, wave-5 Apex bosses, immutable signed run receipts for global relay leaderboards, and local-first receipt-backed player stat progression.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> This revision directly resolves all architectural and protocol considerations raised in the design review:
>
> 1. **Immutable Signed Run Receipts for Global Leaderboards**:
>    - Replaces the single static `kind: 30078` addressable event with unique per-run gameplay receipts (`kind: 1` note or unique parameterized `kind: 30078` with `d: mojisurvivor:run:<timestamp>:<run_hash>`).
>    - Preserves full run history across relays without destructive overwrites, allowing multi-relay global high-score indexing and cryptographic verification.
> 2. **Receipt-Based Player Progression**:
>    - Eliminates the arbitrary "+1.5% stat boost upon publishing" exploit.
>    - Progression is local-first and derived strictly from legitimate gameplay receipts: defeated enemy tallies, wave milestones, and collected Mojo coins.
>    - Players start with standard beginner attributes (Attack, Defense, Speed) and spend legitimately earned Mojo in the Upgrade Lab to increase permanent stats.
> 3. **Nostr Emoji Discovery Pipeline & Bestiary Codex**:
>    - Direct querying and parsing of Nostr `kind: 30030` emoji collections, `kind: 10030` user emoji lists, and `emoji` tags across relays (`wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.primal.net`).
>    - Media resilience: lazy-loading with CORS/timeout safeguards, broken-image filtering, and a deterministic offline reserve emoji pool.
>    - **Codex Discovery**: New emojis initially appear as mysterious ("???") combatants. Defeating them records their SHA-256 stats into the player's Codex, revealing their power tier, speed, and attack traits. Points awarded in combat scale proportionally with each emoji's hash-calculated power.
> 4. **Hash-Derived Attributes & Specialized Behaviors**:
>    - Stable SHA-256 hash of the emoji identifier (`shortcode` + `image_url`) determines numerical attributes (HP, Speed, Damage, EXP drop value) and behavioral styles (Zigzag Rusher, Stomping Brute, Orbiting Sniper, Swarm Minion).
>    - **Wave-5 Apex Boss**: Every 5 waves, an empowered Colossal Emoji Titan spawns with multi-phase abilities: rotating beam sweep, minion summoning bursts, and radial shockwaves.
> 5. **Combat Equipment & Spell Merging**:
>    - Active weapons: Lightning Zap, Holy Garlic Aura, Orbiting Shields, Fire Darts, Plasma Wave.
>    - Run inventory supports duplicate weapon acquisition and merging into evolved high-tier forms (e.g., Dual Orbiting Shield -> Supernova Barrier).
> 6. **Controls & Mobile Ergonomics**:
>    - Fullscreen top-down mobile experience with **direct touch-and-drag movement**: touch the unobstructed arena and drag to move, release to stop. No visible virtual joystick, circle, puck, stick base, or fixed control zone; weapons fire automatically.
> 7. **Visual Identity**:
>    - Void Black (`#000000`) and Deep Pink (`#FF1493`), accented with electric amber and retro CRT scanline styling.

---

### 1. Overview & Core Concept

- **What It Does**: `nostr MojiSurvivor` places the player's Nostr persona in an infinite, high-octane arena besieged by custom emojis harvested live from Nostr relays. As players dodge and automatically fire mergeable spells, they uncover the secret strengths of each emoji, earn Mojo coins, and survive escalating waves. At the end of each run, an immutable cryptographic receipt is signed and published to Nostr relays, staking a spot on the decentralized global leaderboard.
- **Target Audience**: Nostr community members, nsite explorers, and survivor-game enthusiasts who appreciate genuine cryptographic integration, fair progression, and retro arcade aesthetics.
- **Key Value**: Delivers genuine Nostr protocol interoperability (NIP-30 emoji discovery, NIP-55/NIP-07 signing, and public relay leaderboards) combined with deep, responsive, 60 FPS survivor mechanics.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Arcade Lobby & Identity**:
   - High-contrast pure black (`#000000`) and deep pink (`#FF1493`) terminal UI.
   - Profile badge shows connected Nostr identity (`npub` / profile avatar) or a guest key.
   - Signer options: Android external signer (Amber via NIP-55 intent) or browser remote signer (`window.nostr`), with instantaneous local keypair fallback.
   - Navigation: **Battle Arena**, **Mojo Upgrade Lab**, **Emoji Bestiary / Codex**, and **Global Leaderboard**.
2. **Pre-Run Sync & Offline Grace**:
   - The game checks Nostr relays in the background for `kind: 30030` / `kind: 10030` emoji updates.
   - If offline or on slow relays, the game seamlessly activates the built-in deterministic reserve pool so gameplay never waits.
3. **Survivor Arena Combat**:
   - **Touch-and-drag movement, without a displayed control**: touch the unobstructed arena and drag to move the character; lifting the finger stops movement. Do not render a joystick, thumbstick, base circle, handle, or ghost control. Never require touching a fixed screen region.
   - Weapons fire automatically at nearest/strongest targets.
   - In-run level-up cards allow selecting new weapons or merging duplicate weapons in inventory.
   - Arena drops: XP gems, Mojo coins, and 4 temporary power-up crates:
     - *Speed Boost*: +70% movement speed for 8s with pink neon motion trail.
     - *Aegis Shield*: Absorbs 3 damage instances or lasts 12s.
     - *Overclock Fury*: +100% spell damage and +50% fire rate for 10s.
     - *Super Magnet*: Immediately pulls all orbs and currency from the entire map.
   - Wave-5 Boss Encounter: Screen alert, sirens, and spawn of a colossal Apex Boss with a segmented health bar.
4. **Post-Run Receipt & Upgrades**:
   - Run summary displays survival duration, enemies defeated, score (weighted by emoji power), and Mojo earned.
   - Score receipt is compiled with cryptographic hash tags and signed via the connected signer (or local key), then published to relays.
   - Offline runs are cached locally in a publish queue.
   - Earned Mojo can be spent in the Upgrade Lab on Attack, Defense, Speed, Health Regen, and Magnet Radius.

#### UI Design Notes & Navigation Contract

**Content-first game UI:** The active arena takes over the screen. Do not wrap combat in a website-style hero page, nested card, permanent instruction panel, or a second navigation shell. These notes describe real destinations and behavior, not an additional prototype.

- **Arcade Lobby / Home**: First screen for Play, current Nostr persona / guest identity, saved progression, and access to the four primary game destinations: **Battle Arena**, **Mojo Upgrade Lab**, **Emoji Bestiary / Codex**, and **Global Leaderboard**. A compact Settings entry is also accessible. Do not show a misleading Disconnect option while signed out.
- **Battle Arena**: Immersive edge-to-edge play area. Keep permanent UI minimal: readable player health, level and EXP progress, wave indicator, Mojo count, and a compact Pause/Resume control. Show boss health and temporary power-up countdowns only when relevant. Auto-fire needs no on-screen firing button; **movement needs no joystick graphic or fixed joystick zone**. Use short, contextual notifications for drops, bosses, and leveling rather than permanently displayed how-to-play instructions.
- **Level-Up & Spell Merging**: Briefly pause the simulation and present clear choices for a new weapon, an upgrade, or a duplicate-weapon merge. Show the resulting spell / level before selection; restore the paused run afterwards without losing movement or combat state.
- **Mojo Upgrade Lab**: Display current Attack, Defense, Speed, Health Regen, and Magnet Radius; owned Mojo; each upgrade's price and projected effect; and a distinct confirmation / purchase result. Spent Mojo and unlocked levels persist locally.
- **Emoji Bestiary / Codex**: Separate discovered from undiscovered emoji entries. Undiscovered entries conceal traits (e.g., `???`); discovered entries show the actual Nostr emoji, its combat attributes, hash-derived power rating, and behavior. Include usable states for a missing/broken media URL; do not substitute a generic monster for a known valid emoji.
- **Global Leaderboard**: Show player best and global runs, with clear score/wave context and publication state (queued offline, signing, publishing, confirmed by relay, or failed). Distinguish a signed receipt from a relay-accepted receipt. Relay errors must not erase the local run.
- **Settings & Identity**: Audio, haptics, graphics/performance, and optional motion effects; signer connection/switching; relay configuration; and accessible access to game help. Keep login/signing separate from core offline play where possible.

**Touch-and-drag behavior (explicit design correction):**
1. A player can put a finger down within the unobstructed game area and drag; movement responds to that drag without first grabbing a specific virtual object.
2. When the finger is lifted or the touch is cancelled, movement stops. Taps on UI actions (Pause, upgrade choices, etc.) activate those actions rather than moving the player.
3. **No visible virtual joystick** in any state: no circle, ring, thumb pad, translucent knob, floating control center, or permanent reserved corner. Do not render or reposition a joystick when touched.
4. Do not require repeated touch-and-release when the finger naturally drifts during continuous movement. Keep the player within the playable arena; do not interpret a tap as teleportation.

**Runtime & device behavior:**
- Use the same game screen hierarchy and visual identity in Android and the independently hosted nsite, with only platform-specific navigation, storage, and signer adapters differing. The nsite must run as an actual game experience, not merely display a static preview of the Android UI.
- Respect Android system bars and display cutouts, support phone portrait and landscape intentionally, and preserve a reliable Android Back / web Back / Pause / exit pathway. Returning from Amber, switching apps, or resuming an interrupted session must not discard gameplay or an unfinished signing flow.
- Signing availability and failure belong next to the relevant user action; browser extension signing, Android NIP-55 external signing, and NIP-46 remote signing are distinct integrations, not interchangeable names for the same control. The exact NIP-46 nsite pairing flow remains a technical integration detail to specify, not evidence that `window.nostr` alone covers it.
- Provide clear loading, offline, empty, and error states. Keep gameplay usable when relays or images are unavailable; relay sync and publication continue without blocking movement.
- Offer options to reduce screen shake, flashing, vibration, dense particles, and CRT effects. Retain legible HUD text, meaningful button labels, visible focus on non-game screens, and accessible touch targets. Test at narrow phone widths and enlarged text without hiding essential navigation.

#### Visual Palette & Atmosphere
- **Primary Background**: Pure Pitch Black (`#000000`).
- **Signature Accent**: Deep Neon Pink (`#FF1493`).
- **Secondary Highlights**: Cyber Amber (`#FF9900`), Plasma Cyan (`#00F0FF`), and Crisp White (`#FFFFFF`).
- **HUD & UI**: Clean monospace font for hashes and npubs, bold retro arcade typography for damage numbers, and optional CRT scanline shader.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Public Run Receipts vs. Addressable Overwrite**:
  - *Chosen Approach*: Each run generates an immutable signed event with tags (`["p", pubkey]`, `["t", "mojisurvivor"]`, `["score", score]`, `["wave", wave]`, `["defeated", count]`, `["run_hash", hash]`). In an addressable scheme, the `d` tag is parameterized as `mojisurvivor:run:<timestamp>:<hash>`, preventing relay overwrites.
  - *Why*: Solves the serious technical flaw where earlier runs would be overwritten, preserving public leaderboard history and auditable player records.
- **Decision 2: Progression Tied to Legitimate Gameplay Receipts**:
  - *Chosen Approach*: Progression points (Mojo) are minted exclusively from in-game enemy takedowns and boss defeats recorded in the run summary.
  - *Why*: Closes the exploit of spam-publishing empty runs to inflate stats.
- **Decision 3: Two-Tier Emoji Pipeline (Live NIP-30 + Reserve Pool)**:
  - *Chosen Approach*: Query live `kind: 30030` and `kind: 10030` events from relays. Validate image URLs with CORS/image loading timeouts. Fall back gracefully to a curated offline reserve set of community Nostr emojis.
  - *Why*: Eliminates broken textures and ensures 100% playable offline or degraded-network performance.
- **Decision 4: Bestiary / Codex Discovery**:
  - *Chosen Approach*: Emojis start in an "undiscovered" state in the player's Codex. Defeating an emoji logs its SHA-256 stats, reveals its characteristics, and awards power-proportional bounty points.
  - *Why*: Adds depth and rewarding collection lore to the game beyond generic wave-clearing.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Android Native Container                        │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ MainActivity (Edge-to-Edge Compose & Optimized WebView)         │   │
│   └────────────────────────┬──────────────────────────────▲────────┘   │
│                            │                              │            │
│                            │ Injects JavascriptInterface  │ Intent     │
│                            ▼                              │ Callbacks  │
│   ┌───────────────────────────────────────────────────────┴────────┐   │
│   │ NostrSignerBridge (Android NIP-55 Intent Bridge)               │   │
│   │ - Dispatches intents to Amber (com.greenart7c3.nostrsigner)    │   │
│   │ - Fallback ephemeral local secp256k1 key generation            │   │
│   │ - Exposes standard window.nostr { getPublicKey, signEvent }    │   │
│   └────────────────────────┬──────────────────────────────▲────────┘   │
│                            │                              │            │
│   ┌────────────────────────▼──────────────────────────────┴────────┐   │
│   │ Embedded React + HTML5 Canvas Engine (Local Assets)            │   │
│   │                                                                │   │
│   │ ┌───────────────────────┐   ┌────────────────────────────────┐ │   │
│   │ │ 60 FPS Game Loop      │   │ Nostr Discovery & Relay Client │ │   │
│   │ │ - Touch-Drag Move     │   │ - Parse Kind 30030 / 10030     │ │   │
│   │ │ - Hashed Emoji Stats  │   │ - Fallback Reserve Pool        │ │   │
│   │ │ - Weapon Spell Merging│   │ - Publish Unique Run Receipts  │ │   │
│   │ │ - Wave 5 Apex Bosses  │   │ - Aggregate Relay Leaderboard  │ │   │
│   │ │ - 4 Power-Up Crates   │   └────────────────────────────────┘ │   │
│   │ └───────────────────────┘                                      │   │
│   │                                                                │   │
│   │ ┌───────────────────────┐   ┌────────────────────────────────┐ │   │
│   │ │ Emoji Codex / Bestiary│   │ Local-First Progression        │ │   │
│   │ │ - Power Reveal System │   │ - Receipt-backed Mojo Currency │ │   │
│   │ │ - Threat Rankings     │   │ - Upgrade Lab (Atk/Def/Spd/Mag)│ │   │
│   │ └───────────────────────┘   └────────────────────────────────┘ │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

#### Event Format & Data Schemas

1. **Signed Public Run Receipt (Nostr Event)**:
```json
{
  "kind": 30078,
  "created_at": 1793574000,
  "tags": [
    ["d", "mojisurvivor:run:1793574000:7f8a9b"],
    ["t", "mojisurvivor"],
    ["score", "14820"],
    ["defeated", "312"],
    ["wave", "11"],
    ["bosses", "2"],
    ["weapons", "lightning_zap_lvl3,garlic_aura_lvl2"],
    ["client", "mojisurvivor-android"]
  ],
  "content": "{\"runId\":\"1793574000-7f8a9b\",\"score\":14820,\"wave\":11,\"defeated\":312,\"mojoEarned\":450,\"playerAvatar\":\"https://example.com/avatar.png\"}"
}
```

2. **Procedural SHA-256 Stat Calculation**:
```ts
// Stable hash input: emoji shortcode + clean URL
const hash = sha256(`${shortcode}:${imageUrl}`);
const byte0 = parseInt(hash.substring(0, 2), 16);
const byte1 = parseInt(hash.substring(2, 4), 16);
const byte2 = parseInt(hash.substring(4, 6), 16);
const byte3 = parseInt(hash.substring(6, 8), 16);

// Derived combat traits
const hp = 20 + Math.floor((byte0 / 255) * 80);        // 20 - 100 HP
const speed = 1.0 + (byte1 / 255) * 2.2;               // 1.0 - 3.2 speed
const damage = 5 + Math.floor((byte2 / 255) * 20);     // 5 - 25 damage
const powerRating = Math.floor(hp * 0.5 + speed * 15 + damage * 2);
const behavior = byte3 % 4; // 0: Swarmer, 1: Zigzag, 2: Brute, 3: Sniper
```

3. **Spell Merging Rules**:
- 2x *Lightning Zap* (Lvl 1) -> Lvl 2 *Double Spark*
- 2x *Double Spark* (Lvl 2) -> Lvl 3 *Chain Storm*
- 2x *Holy Garlic* (Lvl 1) -> Lvl 2 *Radiant Ward*
- 2x *Radiant Ward* (Lvl 2) -> Lvl 3 *Solar Cleansing*
- Duplicate weapons collected during level-up automatically merge and evolve.
