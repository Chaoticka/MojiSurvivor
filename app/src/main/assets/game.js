// game.js: nostr MojiSurvivor 60 FPS HTML5 Canvas Engine

class MojiSurvivorGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    this.running = false;
    this.paused = false;
    this.lastTime = 0;

    // Viewport & Arena Bounds
    this.arenaWidth = 1600;
    this.arenaHeight = 2200;
    this.camera = { x: 0, y: 0 };

    // Player State
    this.player = null;

    // Game Entities
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.gems = [];
    this.powerups = [];
    this.particles = [];
    this.ambientMists = [];
    this.shockwaves = [];

    // Wave & Boss State
    this.wave = 1;
    this.waveTimer = 0;
    this.waveDuration = 30; // 30s per wave
    this.bossActive = false;
    this.currentBoss = null;
    this.score = 0;
    this.enemiesDefeated = 0;
    this.bossesDefeated = 0;
    this.mojoEarned = 0;
    this.timeSurvived = 0;

    // Spawning timers
    this.spawnTimer = 0;
    this.powerupSpawnTimer = 0;

    // Touch & Drag Controls (NO VISIBLE JOYSTICK)
    this.touchActive = false;
    this.touchAnchor = { x: 0, y: 0 };
    this.touchCurrent = { x: 0, y: 0 };
    this.moveVector = { x: 0, y: 0 };

    // Screen Shake & Effects
    this.shakeDuration = 0;
    this.shakeIntensity = 0;

    // Bindings
    this.loop = this.loop.bind(this);
    this.setupInputs();
    this.initAmbientParticles();
  }

  initAmbientParticles() {
    this.ambientMists = [];
    for (let i = 0; i < 40; i++) {
      this.ambientMists.push({
        x: Math.random() * this.arenaWidth,
        y: Math.random() * this.arenaHeight,
        radius: 20 + Math.random() * 40,
        alpha: 0.05 + Math.random() * 0.1,
        speedY: -0.2 - Math.random() * 0.3,
        speedX: (Math.random() - 0.5) * 0.2
      });
    }
  }

  setupInputs() {
    const handleTouchStart = (e) => {
      if (!this.running || this.paused) return;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      this.touchActive = true;
      this.touchAnchor = { x, y };
      this.touchCurrent = { x, y };
      this.moveVector = { x: 0, y: 0 };
    };

    const handleTouchMove = (e) => {
      if (!this.touchActive || !this.running || this.paused) return;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      this.touchCurrent = { x, y };
      const dx = x - this.touchAnchor.x;
      const dy = y - this.touchAnchor.y;
      const dist = Math.hypot(dx, dy);

      const maxRadius = 60;
      if (dist > 5) {
        const clampedDist = Math.min(dist, maxRadius);
        this.moveVector = {
          x: (dx / dist) * (clampedDist / maxRadius),
          y: (dy / dist) * (clampedDist / maxRadius)
        };
      } else {
        this.moveVector = { x: 0, y: 0 };
      }

      // Smooth anchor drift for continuous drag navigation
      if (dist > maxRadius) {
        this.touchAnchor.x = x - (dx / dist) * maxRadius;
        this.touchAnchor.y = y - (dy / dist) * maxRadius;
      }
    };

    const handleTouchEnd = () => {
      this.touchActive = false;
      this.moveVector = { x: 0, y: 0 };
    };

    this.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', handleTouchEnd);
    this.canvas.addEventListener('touchcancel', handleTouchEnd);

    // Mouse fallback for desktop testing
    let mouseDown = false;
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.running || this.paused) return;
      mouseDown = true;
      const rect = this.canvas.getBoundingClientRect();
      this.touchActive = true;
      this.touchAnchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      this.touchCurrent = { ...this.touchAnchor };
      this.moveVector = { x: 0, y: 0 };
    });
    window.addEventListener('mousemove', (e) => {
      if (!mouseDown || !this.running || this.paused) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - this.touchAnchor.x;
      const dy = y - this.touchAnchor.y;
      const dist = Math.hypot(dx, dy);
      const maxRadius = 60;
      if (dist > 5) {
        const clampedDist = Math.min(dist, maxRadius);
        this.moveVector = {
          x: (dx / dist) * (clampedDist / maxRadius),
          y: (dy / dist) * (clampedDist / maxRadius)
        };
      } else {
        this.moveVector = { x: 0, y: 0 };
      }
    });
    window.addEventListener('mouseup', () => {
      mouseDown = false;
      this.touchActive = false;
      this.moveVector = { x: 0, y: 0 };
    });
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.parentElement.clientWidth;
    const height = this.canvas.parentElement.clientHeight;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';

    this.ctx.scale(dpr, dpr);
    this.viewWidth = width;
    this.viewHeight = height;
  }

  startNewGame() {
    this.resize();
    window.RetroAudio.init();

    // Load permanent stats from Upgrade Lab
    const labUpgrades = window.AppStorage ? window.AppStorage.getUpgrades() : {};
    const attackLevel = labUpgrades.attack || 0;
    const defenseLevel = labUpgrades.defense || 0;
    const speedLevel = labUpgrades.speed || 0;
    const regenLevel = labUpgrades.regen || 0;
    const magnetLevel = labUpgrades.magnet || 0;

    const baseMaxHp = 100 + defenseLevel * 15;
    const baseSpeed = 4.0 + speedLevel * 0.4;
    const baseAttackMult = 1.0 + attackLevel * 0.12;
    const baseDefenseMult = Math.max(0.4, 1.0 - defenseLevel * 0.08);
    const baseMagnetRadius = 90 + magnetLevel * 25;
    const baseRegenRate = regenLevel * 0.5; // hp per second

    this.player = {
      x: this.arenaWidth / 2,
      y: this.arenaHeight / 2,
      radius: 18,
      hp: baseMaxHp,
      maxHp: baseMaxHp,
      speed: baseSpeed,
      attackMult: baseAttackMult,
      defenseMult: baseDefenseMult,
      magnetRadius: baseMagnetRadius,
      regenRate: baseRegenRate,
      level: 1,
      exp: 0,
      expNext: 35,
      // Active Weapons & Equipment
      weapons: [
        { id: 'lightning_zap', name: 'Lightning Zap', level: 1, timer: 0, cooldown: 1.1, damage: 25, range: 280 }
      ],
      // Temporary Power-up Buffs
      buffs: {
        speed: { active: false, timer: 0, mult: 1.7 },
        shield: { active: false, hitsLeft: 0, timer: 0 },
        damage: { active: false, timer: 0, mult: 2.0 },
        magnet: { active: false, timer: 0 }
      },
      avatarImg: null,
      facingAngle: 0
    };

    // Pre-create player avatar image
    const pImg = new Image();
    pImg.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><circle cx='20' cy='20' r='18' fill='%23FF1493'/><text x='20' y='26' font-size='20' text-anchor='middle' fill='%23FFFFFF' font-family='sans-serif'>⚡</text></svg>";
    this.player.avatarImg = pImg;

    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.gems = [];
    this.powerups = [];
    this.particles = [];
    this.shockwaves = [];

    this.wave = 1;
    this.waveTimer = 0;
    this.score = 0;
    this.enemiesDefeated = 0;
    this.bossesDefeated = 0;
    this.mojoEarned = 0;
    this.timeSurvived = 0;
    this.bossActive = false;
    this.currentBoss = null;

    this.running = true;
    this.paused = false;
    this.lastTime = performance.now();

    this.updateHUD();
    requestAnimationFrame(this.loop);
  }

  loop(currentTime) {
    if (!this.running) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (!this.paused) {
      this.update(dt);
    }

    this.render();
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    this.timeSurvived += dt;
    this.waveTimer += dt;

    // Screen shake update
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
    }

    // Player Movement
    let currentSpeed = this.player.speed;
    if (this.player.buffs.speed.active) {
      currentSpeed *= this.player.buffs.speed.mult;
    }

    if (this.moveVector.x !== 0 || this.moveVector.y !== 0) {
      this.player.x += this.moveVector.x * currentSpeed;
      this.player.y += this.moveVector.y * currentSpeed;
      this.player.facingAngle = Math.atan2(this.moveVector.y, this.moveVector.x);

      // Speed particle trail
      if (Math.random() < (this.player.buffs.speed.active ? 0.7 : 0.25)) {
        this.particles.push({
          x: this.player.x + (Math.random() - 0.5) * 10,
          y: this.player.y + (Math.random() - 0.5) * 10,
          vx: -this.moveVector.x * 2,
          vy: -this.moveVector.y * 2,
          color: this.player.buffs.speed.active ? '#00FFFF' : '#FF1493',
          radius: 3,
          life: 0.25,
          maxLife: 0.25
        });
      }
    }

    // Keep Player inside arena boundary
    this.player.x = Math.max(30, Math.min(this.arenaWidth - 30, this.player.x));
    this.player.y = Math.max(30, Math.min(this.arenaHeight - 30, this.player.y));

    // Health Regeneration
    if (this.player.regenRate > 0 && this.player.hp < this.player.maxHp) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.regenRate * dt);
    }

    // Update Temporary Buffs
    Object.keys(this.player.buffs).forEach(key => {
      const buff = this.player.buffs[key];
      if (buff.active) {
        buff.timer -= dt;
        if (buff.timer <= 0) {
          buff.active = false;
        }
      }
    });

    // Camera follow player smoothly
    const targetCamX = this.player.x - this.viewWidth / 2;
    const targetCamY = this.player.y - this.viewHeight / 2;
    this.camera.x += (targetCamX - this.camera.x) * 0.15;
    this.camera.y += (targetCamY - this.camera.y) * 0.15;

    // Clamp camera within arena
    this.camera.x = Math.max(0, Math.min(this.arenaWidth - this.viewWidth, this.camera.x));
    this.camera.y = Math.max(0, Math.min(this.arenaHeight - this.viewHeight, this.camera.y));

    // Update Weapons & Fire Auto-Attacks
    this.updateWeapons(dt);

    // Update Projectiles
    this.updateProjectiles(dt);

    // Wave Progression & Boss Spawning (Wave 5, 10, 15...)
    if (this.waveTimer >= this.waveDuration && !this.bossActive) {
      this.wave++;
      this.waveTimer = 0;
      this.showToast(`WAVE ${this.wave} BEGINS`);
      
      // Spawn Boss every 5 waves
      if (this.wave % 5 === 0) {
        this.spawnBoss();
      }
    }

    // Spawn regular enemies
    this.spawnTimer += dt;
    const spawnInterval = Math.max(0.4, 1.8 - this.wave * 0.1);
    if (this.spawnTimer >= spawnInterval && this.enemies.length < (25 + this.wave * 6)) {
      this.spawnTimer = 0;
      this.spawnEnemy();
    }

    // Spawn Temporary Power-up Crates randomly
    this.powerupSpawnTimer += dt;
    if (this.powerupSpawnTimer >= 18 && this.powerups.length < 3) {
      this.powerupSpawnTimer = 0;
      this.spawnPowerup();
    }

    // Update Enemies
    this.updateEnemies(dt);

    // Update Pickups (Gems & Mojo coins)
    this.updatePickups(dt);

    // Update Particles & Shockwaves
    this.updateVisualEffects(dt);

    // Sync HUD
    this.updateHUD();
  }

  updateWeapons(dt) {
    let damageMultiplier = this.player.attackMult;
    let rateMultiplier = 1.0;
    if (this.player.buffs.damage.active) {
      damageMultiplier *= this.player.buffs.damage.mult;
      rateMultiplier = 1.5;
    }

    this.player.weapons.forEach(weapon => {
      weapon.timer += dt * rateMultiplier;
      if (weapon.timer >= weapon.cooldown) {
        weapon.timer = 0;
        this.fireWeapon(weapon, damageMultiplier);
      }
    });
  }

  fireWeapon(weapon, damageMult) {
    if (this.enemies.length === 0) return;

    if (weapon.id.startsWith('lightning_zap')) {
      // Find nearest enemies
      const sorted = [...this.enemies].sort((a, b) => {
        const distA = Math.hypot(a.x - this.player.x, a.y - this.player.y);
        const distB = Math.hypot(b.x - this.player.x, b.y - this.player.y);
        return distA - distB;
      });

      const targetsCount = Math.min(weapon.level, sorted.length);
      for (let i = 0; i < targetsCount; i++) {
        const target = sorted[i];
        if (Math.hypot(target.x - this.player.x, target.y - this.player.y) <= weapon.range) {
          this.applyDamageToEnemy(target, weapon.damage * damageMult);
          window.RetroAudio.playShoot('zap');

          // Lightning beam effect
          this.particles.push({
            type: 'lightning',
            x1: this.player.x,
            y1: this.player.y,
            x2: target.x,
            y2: target.y,
            life: 0.12,
            maxLife: 0.12,
            color: '#FF1493'
          });
        }
      }
    } else if (weapon.id.startsWith('garlic_aura')) {
      // Holy Garlic Aura radial burst
      const auraRadius = 80 + weapon.level * 20;
      this.enemies.forEach(enemy => {
        if (Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y) <= auraRadius) {
          this.applyDamageToEnemy(enemy, (weapon.damage * 0.4) * damageMult);
        }
      });
      // Aura ripple visual
      this.shockwaves.push({
        x: this.player.x,
        y: this.player.y,
        radius: 10,
        maxRadius: auraRadius,
        color: '#FFB6D9',
        alpha: 0.6,
        life: 0.25,
        maxLife: 0.25
      });
    } else if (weapon.id.startsWith('orbiting_shield')) {
      // Orbiting energy blades
      const shieldCount = weapon.level + 1;
      const now = performance.now() / 600;
      for (let i = 0; i < shieldCount; i++) {
        const angle = now + (i * Math.PI * 2) / shieldCount;
        const shieldDist = 65;
        const sx = this.player.x + Math.cos(angle) * shieldDist;
        const sy = this.player.y + Math.sin(angle) * shieldDist;

        this.enemies.forEach(enemy => {
          if (Math.hypot(enemy.x - sx, enemy.y - sy) <= 22) {
            this.applyDamageToEnemy(enemy, weapon.damage * damageMult * 0.3);
          }
        });
      }
    } else if (weapon.id.startsWith('fire_dart')) {
      // Direct high-velocity piercing bolts
      const target = this.getClosestEnemy();
      if (target) {
        const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
        this.projectiles.push({
          x: this.player.x,
          y: this.player.y,
          vx: Math.cos(angle) * 450,
          vy: Math.sin(angle) * 450,
          radius: 6,
          color: '#FF9800',
          damage: weapon.damage * damageMult,
          pierce: weapon.level,
          life: 1.5
        });
        window.RetroAudio.playShoot('dart');
      }
    } else if (weapon.id.startsWith('plasma_wave')) {
      // Expanding Nova Shockwave
      this.shockwaves.push({
        x: this.player.x,
        y: this.player.y,
        radius: 20,
        maxRadius: 240 + weapon.level * 40,
        color: '#00F0FF',
        alpha: 0.8,
        life: 0.45,
        maxLife: 0.45,
        damage: weapon.damage * damageMult
      });
      window.RetroAudio.playShoot('nova');
    }
  }

  getClosestEnemy() {
    if (this.enemies.length === 0) return null;
    let closest = null;
    let minDist = Infinity;
    this.enemies.forEach(e => {
      const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (dist < minDist) {
        minDist = dist;
        closest = e;
      }
    });
    return closest;
  }

  updateProjectiles(dt) {
    // Player Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      // Check collision with enemies
      for (let j = 0; j < this.enemies.length; j++) {
        const enemy = this.enemies[j];
        if (Math.hypot(enemy.x - p.x, enemy.y - p.y) <= enemy.radius + p.radius) {
          this.applyDamageToEnemy(enemy, p.damage);
          p.pierce--;
          if (p.pierce <= 0) break;
        }
      }

      if (p.life <= 0 || p.pierce <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    // Enemy Projectiles (from Orbiting Snipers & Bosses)
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const ep = this.enemyProjectiles[i];
      ep.x += ep.vx * dt;
      ep.y += ep.vy * dt;
      ep.life -= dt;

      // Check hit with player
      if (Math.hypot(this.player.x - ep.x, this.player.y - ep.y) <= this.player.radius + ep.radius) {
        this.hitPlayer(ep.damage);
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      if (ep.life <= 0) {
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  spawnEnemy() {
    const emojiData = window.NostrClient.getRandomEmoji();
    // Spawn around camera perimeter
    const margin = 50;
    let x, y;
    const side = Math.floor(Math.random() * 4);

    if (side === 0) { // Top
      x = this.camera.x + Math.random() * this.viewWidth;
      y = this.camera.y - margin;
    } else if (side === 1) { // Bottom
      x = this.camera.x + Math.random() * this.viewWidth;
      y = this.camera.y + this.viewHeight + margin;
    } else if (side === 2) { // Left
      x = this.camera.x - margin;
      y = this.camera.y + Math.random() * this.viewHeight;
    } else { // Right
      x = this.camera.x + this.viewWidth + margin;
      y = this.camera.y + Math.random() * this.viewHeight;
    }

    // Scale stats with current wave
    const waveMult = 1.0 + (this.wave - 1) * 0.18;
    const hp = Math.floor(emojiData.hp * waveMult);
    const speed = emojiData.speed * (0.95 + Math.random() * 0.1);
    const damage = Math.floor(emojiData.damage * (1.0 + this.wave * 0.1));

    const enemy = {
      x,
      y,
      radius: emojiData.behaviorType === 2 ? 26 : 18, // Brute is bigger
      hp,
      maxHp: hp,
      speed,
      damage,
      behaviorType: emojiData.behaviorType,
      shortcode: emojiData.shortcode,
      url: emojiData.url,
      powerRating: emojiData.powerRating,
      tier: emojiData.tier,
      expValue: emojiData.expValue,
      mojoValue: emojiData.mojoValue,
      img: window.NostrClient.loadImage(emojiData.url),
      timer: Math.random() * Math.PI,
      isBoss: false
    };

    this.enemies.push(enemy);
  }

  spawnBoss() {
    this.bossActive = true;
    window.RetroAudio.playBossSiren();
    this.triggerScreenShake(0.8, 12);

    const emojiData = window.NostrClient.getRandomEmoji();
    const bossHp = 2200 + this.wave * 800;

    const boss = {
      x: this.player.x + (Math.random() > 0.5 ? 250 : -250),
      y: this.player.y + (Math.random() > 0.5 ? 250 : -250),
      radius: 46,
      hp: bossHp,
      maxHp: bossHp,
      speed: 1.6,
      damage: 28,
      behaviorType: 99, // Boss
      shortcode: 'APEX_' + emojiData.shortcode.toUpperCase(),
      url: emojiData.url,
      powerRating: 500,
      tier: 'APEX TITAN',
      expValue: 50,
      mojoValue: 40,
      img: window.NostrClient.loadImage(emojiData.url),
      timer: 0,
      phase: 1,
      laserAngle: 0,
      isBoss: true
    };

    this.currentBoss = boss;
    this.enemies.push(boss);

    const banner = document.getElementById('boss-alert-banner');
    if (banner) {
      banner.classList.remove('hidden');
      document.getElementById('boss-name-label').innerText = `APEX TITAN: :${emojiData.shortcode}:`;
    }
  }

  spawnPowerup() {
    const types = ['SPEED', 'SHIELD', 'DAMAGE', 'MAGNET'];
    const chosen = types[Math.floor(Math.random() * types.length)];
    const x = this.camera.x + 60 + Math.random() * (this.viewWidth - 120);
    const y = this.camera.y + 60 + Math.random() * (this.viewHeight - 120);

    const icons = {
      SPEED: '⚡',
      SHIELD: '🛡️',
      DAMAGE: '🔥',
      MAGNET: '🧲'
    };

    this.powerups.push({
      type: chosen,
      x,
      y,
      radius: 16,
      icon: icons[chosen],
      life: 25, // disappears after 25s
      timer: 0
    });
  }

  updateEnemies(dt) {
    const px = this.player.x;
    const py = this.player.y;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.timer += dt;

      const dx = px - e.x;
      const dy = py - e.y;
      const dist = Math.hypot(dx, dy);

      if (e.isBoss) {
        // Multi-phase Boss Behaviors
        e.laserAngle += dt * 1.8;
        e.x += (dx / dist) * e.speed;
        e.y += (dy / dist) * e.speed;

        // Periodic shockwaves
        if (Math.floor(e.timer * 2) % 6 === 0 && Math.random() < 0.05) {
          this.shockwaves.push({
            x: e.x,
            y: e.y,
            radius: 20,
            maxRadius: 180,
            color: '#FF0055',
            alpha: 0.8,
            life: 0.5,
            maxLife: 0.5,
            enemyDamage: 20
          });
        }

        // Fire tracking bullet ring
        if (e.timer > 3.0) {
          e.timer = 0;
          for (let b = 0; b < 8; b++) {
            const bAngle = (b * Math.PI * 2) / 8 + e.laserAngle;
            this.enemyProjectiles.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(bAngle) * 180,
              vy: Math.sin(bAngle) * 180,
              radius: 6,
              damage: 18,
              color: '#FF1493',
              life: 3.5
            });
          }
        }
      } else if (e.behaviorType === 0) {
        // SWARMER: Direct charge
        if (dist > 5) {
          e.x += (dx / dist) * e.speed;
          e.y += (dy / dist) * e.speed;
        }
      } else if (e.behaviorType === 1) {
        // ZIGZAG: Sine-wave wobble
        const baseAngle = Math.atan2(dy, dx);
        const wobble = Math.sin(e.timer * 6) * 0.85;
        const finalAngle = baseAngle + wobble;
        e.x += Math.cos(finalAngle) * e.speed * 1.25;
        e.y += Math.sin(finalAngle) * e.speed * 1.25;
      } else if (e.behaviorType === 2) {
        // STOMPER BRUTE: Heavy slow, periodic ground shockwave
        if (dist > 5) {
          e.x += (dx / dist) * (e.speed * 0.7);
          e.y += (dy / dist) * (e.speed * 0.7);
        }
        if (Math.sin(e.timer * 2.5) > 0.98 && dist < 140) {
          this.shockwaves.push({
            x: e.x,
            y: e.y,
            radius: 10,
            maxRadius: 85,
            color: '#FF0055',
            alpha: 0.6,
            life: 0.35,
            maxLife: 0.35,
            enemyDamage: 14
          });
        }
      } else if (e.behaviorType === 3) {
        // ORBITING SNIPER: Circles at distance, shoots tracking darts
        const targetDistance = 200;
        if (dist > targetDistance + 20) {
          e.x += (dx / dist) * e.speed;
          e.y += (dy / dist) * e.speed;
        } else if (dist < targetDistance - 20) {
          e.x -= (dx / dist) * e.speed;
          e.y -= (dy / dist) * e.speed;
        } else {
          // Orbit
          const orbitAngle = Math.atan2(dy, dx) + Math.PI / 2;
          e.x += Math.cos(orbitAngle) * e.speed;
          e.y += Math.sin(orbitAngle) * e.speed;
        }

        // Fire bullet
        if (e.timer > 2.8) {
          e.timer = 0;
          const fireAngle = Math.atan2(py - e.y, px - e.x);
          this.enemyProjectiles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(fireAngle) * 210,
            vy: Math.sin(fireAngle) * 210,
            radius: 4,
            damage: e.damage,
            color: '#FF1493',
            life: 2.5
          });
        }
      }

      // Check contact damage with player
      if (dist <= e.radius + this.player.radius) {
        this.hitPlayer(e.damage * dt);
      }
    }
  }

  applyDamageToEnemy(enemy, damage) {
    enemy.hp -= damage;
    this.createDamageNumber(enemy.x, enemy.y, Math.round(damage));

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  }

  killEnemy(enemy) {
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
    }

    this.enemiesDefeated++;
    // Score weighted by enemy power rating!
    this.score += enemy.powerRating * 10;

    // Drop EXP gem
    this.gems.push({
      x: enemy.x,
      y: enemy.y,
      value: enemy.expValue,
      type: 'exp',
      radius: 6,
      color: '#00FF88'
    });

    // Drop Mojo Coin based on value
    if (enemy.mojoValue > 0 || Math.random() < 0.4) {
      this.gems.push({
        x: enemy.x + (Math.random() - 0.5) * 14,
        y: enemy.y + (Math.random() - 0.5) * 14,
        value: enemy.mojoValue || 1,
        type: 'mojo',
        radius: 8,
        color: '#FF1493'
      });
    }

    // Log to discovered Codex
    if (window.AppStorage) {
      window.AppStorage.recordEmojiDefeated(enemy.shortcode, enemy.powerRating);
    }

    if (enemy.isBoss) {
      this.bossActive = false;
      this.currentBoss = null;
      this.bossesDefeated++;
      const banner = document.getElementById('boss-alert-banner');
      if (banner) banner.classList.add('hidden');
      this.showToast('APEX TITAN DEFEATED! +10000 PTS');
      this.score += 10000;
    }

    // Death explosion particles
    for (let p = 0; p < (enemy.isBoss ? 35 : 12); p++) {
      this.particles.push({
        x: enemy.x,
        y: enemy.y,
        vx: (Math.random() - 0.5) * 160,
        vy: (Math.random() - 0.5) * 160,
        color: enemy.isBoss ? '#FF1493' : '#FFB6D9',
        radius: Math.random() * 4 + 2,
        life: 0.4,
        maxLife: 0.4
      });
    }
  }

  hitPlayer(rawDamage) {
    // If shield power-up is active, absorb hit
    if (this.player.buffs.shield.active) {
      this.player.buffs.shield.hitsLeft--;
      this.triggerScreenShake(0.1, 4);
      if (this.player.buffs.shield.hitsLeft <= 0) {
        this.player.buffs.shield.active = false;
      }
      return;
    }

    const effectiveDamage = Math.max(1, rawDamage * this.player.defenseMult);
    this.player.hp -= effectiveDamage;
    window.RetroAudio.playHit();
    this.triggerScreenShake(0.15, 6);

    // Haptic feedback via Android bridge
    if (window.AndroidNostrBridge) {
      try { window.AndroidNostrBridge.vibrate(40); } catch (_) {}
    }

    if (this.player.hp <= 0) {
      this.gameOver();
    }
  }

  updatePickups(dt) {
    const px = this.player.x;
    const py = this.player.y;
    let magnetDist = this.player.magnetRadius;

    // Super Magnet buff pulls all items instantly
    if (this.player.buffs.magnet.active) {
      magnetDist = 3000;
    }

    // Gems & Coins
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      const dist = Math.hypot(px - g.x, py - g.y);

      if (dist < magnetDist) {
        const pullSpeed = 400 + (1 - dist / magnetDist) * 350;
        g.x += ((px - g.x) / dist) * pullSpeed * dt;
        g.y += ((py - g.y) / dist) * pullSpeed * dt;
      }

      if (dist < this.player.radius + g.radius) {
        if (g.type === 'exp') {
          this.addExp(g.value);
        } else if (g.type === 'mojo') {
          this.mojoEarned += g.value;
          window.RetroAudio.playPickup();
        }
        this.gems.splice(i, 1);
      }
    }

    // Power-up Crates
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.life -= dt;
      p.timer += dt;

      if (Math.hypot(px - p.x, py - p.y) <= this.player.radius + p.radius) {
        this.activatePowerup(p.type);
        this.powerups.splice(i, 1);
        continue;
      }

      if (p.life <= 0) {
        this.powerups.splice(i, 1);
      }
    }
  }

  activatePowerup(type) {
    window.RetroAudio.playPowerup();
    this.showToast(`POWER-UP: ${type}!`);

    if (type === 'SPEED') {
      this.player.buffs.speed.active = true;
      this.player.buffs.speed.timer = 8.0;
    } else if (type === 'SHIELD') {
      this.player.buffs.shield.active = true;
      this.player.buffs.shield.hitsLeft = 3;
      this.player.buffs.shield.timer = 12.0;
    } else if (type === 'DAMAGE') {
      this.player.buffs.damage.active = true;
      this.player.buffs.damage.timer = 10.0;
    } else if (type === 'MAGNET') {
      this.player.buffs.magnet.active = true;
      this.player.buffs.magnet.timer = 4.0;
    }
  }

  addExp(amount) {
    this.player.exp += amount;
    window.RetroAudio.playPickup();

    if (this.player.exp >= this.player.expNext) {
      this.player.exp -= this.player.expNext;
      this.player.level++;
      this.player.expNext = Math.floor(this.player.expNext * 1.35 + 20);
      this.triggerLevelUp();
    }
  }

  triggerLevelUp() {
    this.paused = true;
    window.RetroAudio.playLevelUp();
    this.showUpgradeModal();
  }

  showUpgradeModal() {
    const modal = document.getElementById('level-up-modal');
    const container = document.getElementById('upgrade-cards-container');
    if (!modal || !container) return;

    container.innerHTML = '';

    // Generate 3 choices (weapons / spells with auto-merge)
    const weaponPool = [
      { id: 'lightning_zap', name: 'Lightning Zap', icon: '⚡', desc: 'Fires auto-targeting neon sparks at nearest enemies.', baseDmg: 30 },
      { id: 'garlic_aura', name: 'Holy Garlic Aura', icon: '🧄', desc: 'Constant holy ring burning all nearby enemies.', baseDmg: 18 },
      { id: 'orbiting_shield', name: 'Orbiting Shields', icon: '🛡️', desc: 'Spinning energy blades shredding attackers.', baseDmg: 22 },
      { id: 'fire_dart', name: 'Fire Darts', icon: '🎯', desc: 'Armor-piercing high-velocity projectile.', baseDmg: 45 },
      { id: 'plasma_wave', name: 'Plasma Nova', icon: '💥', desc: 'Periodic radial shockwave obliterating swarms.', baseDmg: 60 }
    ];

    // Pick 3 random
    const shuffled = [...weaponPool].sort(() => 0.5 - Math.random()).slice(0, 3);

    shuffled.forEach(w => {
      const existing = this.player.weapons.find(pw => pw.id === w.id);
      const isMerge = !!existing;
      const nextLevel = isMerge ? existing.level + 1 : 1;

      const card = document.createElement('div');
      card.className = 'upgrade-card-item';
      card.onclick = () => {
        this.selectUpgrade(w, isMerge);
        modal.classList.add('hidden');
        this.paused = false;
      };

      card.innerHTML = `
        <div class="upgrade-card-icon">${w.icon}</div>
        <div class="upgrade-card-details">
          <div class="upgrade-card-title-row">
            <span class="upgrade-card-name">${w.name}</span>
            <span class="upgrade-card-lvl">${isMerge ? `EVOLVE LVL ${nextLevel}` : 'NEW SPELL'}</span>
          </div>
          <p class="upgrade-card-desc">${isMerge ? `Merge duplicate to upgrade power and fire rate!` : w.desc}</p>
        </div>
      `;
      container.appendChild(card);
    });

    modal.classList.remove('hidden');
  }

  selectUpgrade(w, isMerge) {
    if (isMerge) {
      const existing = this.player.weapons.find(pw => pw.id === w.id);
      existing.level++;
      existing.damage = Math.floor(existing.damage * 1.35);
      existing.cooldown = Math.max(0.3, existing.cooldown * 0.88);
      this.showToast(`${w.name} MERGED TO LVL ${existing.level}!`);
    } else {
      this.player.weapons.push({
        id: w.id,
        name: w.name,
        level: 1,
        timer: 0,
        cooldown: w.id === 'plasma_wave' ? 2.5 : 1.2,
        damage: w.baseDmg,
        range: 300
      });
      this.showToast(`ACQUIRED ${w.name}!`);
    }
  }

  updateVisualEffects(dt) {
    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.vx) p.x += p.vx * dt;
      if (p.vy) p.y += p.vy * dt;
    }

    // Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      sw.radius += (sw.maxRadius - sw.radius) * (dt / sw.maxLife);

      if (sw.enemyDamage && sw.life > 0.1) {
        const dist = Math.hypot(this.player.x - sw.x, this.player.y - sw.y);
        if (Math.abs(dist - sw.radius) < 18) {
          this.hitPlayer(sw.enemyDamage * dt * 2);
        }
      }

      if (sw.damage && sw.life > 0.1) {
        this.enemies.forEach(e => {
          const dist = Math.hypot(e.x - sw.x, e.y - sw.y);
          if (Math.abs(dist - sw.radius) < 22) {
            this.applyDamageToEnemy(e, sw.damage * dt * 3);
          }
        });
      }

      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
      }
    }

    // Ambient Mist
    this.ambientMists.forEach(m => {
      m.y += m.speedY;
      m.x += m.speedX;
      if (m.y < 0) m.y = this.arenaHeight;
      if (m.x < 0) m.x = this.arenaWidth;
      if (m.x > this.arenaWidth) m.x = 0;
    });
  }

  createDamageNumber(x, y, amount) {
    this.particles.push({
      type: 'text',
      text: String(amount),
      x: x + (Math.random() - 0.5) * 12,
      y: y - 10,
      vy: -35,
      color: '#FFFFFF',
      life: 0.5,
      maxLife: 0.5
    });
  }

  triggerScreenShake(duration, intensity) {
    if (!window.AppStorage || window.AppStorage.getSetting('shake')) {
      this.shakeDuration = duration;
      this.shakeIntensity = intensity;
    }
  }

  showToast(text) {
    const toast = document.getElementById('game-toast');
    if (!toast) return;
    toast.innerText = text;
    toast.classList.add('visible');
    toast.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.add('hidden'), 250);
    }, 1800);
  }

  gameOver() {
    this.running = false;
    window.RetroAudio.playGameOver();

    // Persist earned Mojo
    if (window.AppStorage) {
      window.AppStorage.addMojo(this.mojoEarned);
      window.AppStorage.recordRunResult({
        score: this.score,
        wave: this.wave,
        defeated: this.enemiesDefeated,
        timeSurvived: Math.floor(this.timeSurvived)
      });
    }

    // Display Game Over Summary
    const modal = document.getElementById('game-over-modal');
    if (modal) {
      document.getElementById('summary-time').innerText = this.formatTime(this.timeSurvived);
      document.getElementById('summary-wave').innerText = this.wave;
      document.getElementById('summary-defeated').innerText = this.enemiesDefeated;
      document.getElementById('summary-score').innerText = this.score.toLocaleString();
      document.getElementById('summary-mojo').innerText = `+${this.mojoEarned} ⟡`;

      const pubBtn = document.getElementById('btn-publish-receipt');
      if (pubBtn) {
        pubBtn.disabled = false;
        pubBtn.innerText = '⚡ SIGN & BROADCAST TO RELAYS';
      }
      document.getElementById('pub-receipt-status').innerText = 'Ready to Sign';
      document.getElementById('pub-receipt-status').className = 'badge';

      modal.classList.remove('hidden');
    }
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  updateHUD() {
    document.getElementById('hud-hp-fill').style.width = `${Math.max(0, (this.player.hp / this.player.maxHp) * 100)}%`;
    document.getElementById('hud-hp-text').innerText = `${Math.round(this.player.hp)} / ${this.player.maxHp}`;
    document.getElementById('hud-exp-fill').style.width = `${(this.player.exp / this.player.expNext) * 100}%`;
    document.getElementById('hud-exp-text').innerText = `LVL ${this.player.level} (${this.player.exp} / ${this.player.expNext})`;
    document.getElementById('hud-wave').innerText = this.wave;
    document.getElementById('hud-score').innerText = this.score.toLocaleString();
    document.getElementById('hud-mojo').innerText = `${this.mojoEarned} ⟡`;

    // Boss bar if active
    if (this.bossActive && this.currentBoss) {
      const bossHpPct = Math.max(0, (this.currentBoss.hp / this.currentBoss.maxHp) * 100);
      const bossHpFill = document.getElementById('boss-hp-fill');
      if (bossHpFill) bossHpFill.style.width = `${bossHpPct}%`;
    }

    // Active power-up pills dock
    const dock = document.getElementById('powerup-timers');
    if (dock) {
      let dockHtml = '';
      if (this.player.buffs.speed.active) {
        dockHtml += `<div class="powerup-pill-hud">⚡ SPEED (${Math.ceil(this.player.buffs.speed.timer)}s)</div>`;
      }
      if (this.player.buffs.shield.active) {
        dockHtml += `<div class="powerup-pill-hud">🛡️ SHIELD (${this.player.buffs.shield.hitsLeft} Hits)</div>`;
      }
      if (this.player.buffs.damage.active) {
        dockHtml += `<div class="powerup-pill-hud">🔥 FURY (${Math.ceil(this.player.buffs.damage.timer)}s)</div>`;
      }
      if (this.player.buffs.magnet.active) {
        dockHtml += `<div class="powerup-pill-hud">🧲 VACUUM (${Math.ceil(this.player.buffs.magnet.timer)}s)</div>`;
      }
      dock.innerHTML = dockHtml;
    }
  }

  // -------------------------------------------------------------
  // RENDERING ENGINE (GOTHIC RETRO CYBERPUNK CANVAS)
  // -------------------------------------------------------------
  render() {
    const ctx = this.ctx;
    ctx.save();

    // Clear background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

    // Apply Screen Shake
    if (this.shakeDuration > 0) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(shakeX, shakeY);
    }

    // Camera Translation
    ctx.translate(-this.camera.x, -this.camera.y);

    // 1. Draw Gothic Cyberpunk Floor (Stone Pavers, Seams, Pink Grates, Sigil)
    this.renderGothicArenaFloor(ctx);

    // 2. Draw Pickups (Gems, Mojo Coins, Power-up Crates)
    this.renderPickups(ctx);

    // 3. Draw Shockwaves
    this.renderShockwaves(ctx);

    // 4. Draw Enemies (Hashed Emojis)
    this.renderEnemies(ctx);

    // 5. Draw Projectiles
    this.renderProjectiles(ctx);

    // 6. Draw Player (Avatar, Shields, Aura)
    this.renderPlayer(ctx);

    // 7. Draw Visual Particles & Floating Damage Texts
    this.renderParticles(ctx);

    ctx.restore();
  }

  renderGothicArenaFloor(ctx) {
    const tileSize = 80;
    const startX = Math.floor(this.camera.x / tileSize) * tileSize;
    const startY = Math.floor(this.camera.y / tileSize) * tileSize;
    const endX = this.camera.x + this.viewWidth + tileSize;
    const endY = this.camera.y + this.viewHeight + tileSize;

    // Dark Stone Pavers Grid
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 1.5;

    for (let x = startX; x <= endX; x += tileSize) {
      for (let y = startY; y <= endY; y += tileSize) {
        // Subtle brick shading
        const shadeIndex = ((x / tileSize) + (y / tileSize)) % 3;
        ctx.fillStyle = shadeIndex === 0 ? '#0B0B0E' : shadeIndex === 1 ? '#111111' : '#0D0E12';
        ctx.fillRect(x, y, tileSize, tileSize);
        ctx.strokeRect(x, y, tileSize, tileSize);

        // Every 5th tile has a glowing Deep Pink floor drainage grate
        if ((x / tileSize) % 5 === 0 && (y / tileSize) % 5 === 0) {
          const pulse = (Math.sin(performance.now() / 600 + (x + y) * 0.01) + 1) * 0.5;
          ctx.fillStyle = '#1A1A1A';
          ctx.fillRect(x + 14, y + 14, tileSize - 28, tileSize - 28);

          // Glowing neon grates
          ctx.fillStyle = `rgba(255, 20, 147, ${0.4 + pulse * 0.5})`;
          for (let g = 0; g < 4; g++) {
            ctx.fillRect(x + 18, y + 20 + g * 10, tileSize - 36, 4);
          }
        }
      }
    }

    // Central Gothic Star-Cross Runic Sigil
    const centerX = this.arenaWidth / 2;
    const centerY = this.arenaHeight / 2;
    ctx.save();
    ctx.translate(centerX, centerY);

    // Medallion circle
    ctx.strokeStyle = '#5B0633';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 160, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#FF1493';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 140, 0, Math.PI * 2);
    ctx.stroke();

    // 4-Pointed Gothic Cross
    ctx.fillStyle = 'rgba(91, 6, 51, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, -130);
    ctx.lineTo(25, -25);
    ctx.lineTo(130, 0);
    ctx.lineTo(25, 25);
    ctx.lineTo(0, 130);
    ctx.lineTo(-25, 25);
    ctx.lineTo(-130, 0);
    ctx.lineTo(-25, -25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Arena Perimeter Cyber-Borders
    ctx.strokeStyle = '#FF1493';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, this.arenaWidth - 20, this.arenaHeight - 20);

    // Ambient Rising Pink Mist
    ctx.save();
    this.ambientMists.forEach(m => {
      ctx.fillStyle = `rgba(255, 20, 147, ${m.alpha})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  renderPickups(ctx) {
    // EXP Gems & Mojo Coins
    this.gems.forEach(g => {
      ctx.save();
      if (g.type === 'exp') {
        ctx.fillStyle = '#00FF88';
        ctx.beginPath();
        // Diamond shaped gem
        ctx.moveTo(g.x, g.y - g.radius);
        ctx.lineTo(g.x + g.radius, g.y);
        ctx.lineTo(g.x, g.y + g.radius);
        ctx.lineTo(g.x - g.radius, g.y);
        ctx.closePath();
        ctx.fill();
      } else {
        // Mojo coin with glowing ⟡ symbol
        ctx.fillStyle = '#FF1493';
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⟡', g.x, g.y);
      }
      ctx.restore();
    });

    // Temporary Power-up Crates
    this.powerups.forEach(p => {
      ctx.save();
      const pulse = (Math.sin(p.timer * 6) + 1) * 0.5;

      // Glow circle
      ctx.fillStyle = `rgba(255, 20, 147, ${0.3 + pulse * 0.4})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 8, 0, Math.PI * 2);
      ctx.fill();

      // Crate box
      ctx.fillStyle = '#1A1A1A';
      ctx.strokeStyle = '#FF1493';
      ctx.lineWidth = 2;
      ctx.fillRect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
      ctx.strokeRect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);

      // Icon
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.icon, p.x, p.y);

      ctx.restore();
    });
  }

  renderShockwaves(ctx) {
    this.shockwaves.forEach(sw => {
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = sw.alpha * (sw.life / sw.maxLife);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  renderEnemies(ctx) {
    this.enemies.forEach(e => {
      ctx.save();

      if (e.isBoss) {
        // Boss Aura & Multi-ring glow
        ctx.strokeStyle = '#FF1493';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius + 6, 0, Math.PI * 2);
        ctx.stroke();

        // Laser beam if firing
        ctx.strokeStyle = 'rgba(255, 0, 85, 0.6)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(e.laserAngle) * 300, e.y + Math.sin(e.laserAngle) * 300);
        ctx.stroke();
      }

      // Draw Emoji Image or Fallback Circle
      if (e.img && e.img.complete && e.img.naturalWidth > 0) {
        ctx.drawImage(e.img, e.x - e.radius, e.y - e.radius, e.radius * 2, e.radius * 2);
      } else {
        // Stylized procedural fallback
        ctx.fillStyle = e.tier === 'APEX' ? '#FF1493' : '#673AB7';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.shortcode.substring(0, 2).toUpperCase(), e.x, e.y);
      }

      // Health bar for damaged enemies
      if (e.hp < e.maxHp && !e.isBoss) {
        const barW = e.radius * 2;
        const barH = 3;
        ctx.fillStyle = '#000000';
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 6, barW, barH);
        ctx.fillStyle = '#FF1493';
        ctx.fillRect(e.x - e.radius, e.y - e.radius - 6, (e.hp / e.maxHp) * barW, barH);
      }

      ctx.restore();
    });
  }

  renderProjectiles(ctx) {
    // Player Projectiles
    this.projectiles.forEach(p => {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Enemy Projectiles
    this.enemyProjectiles.forEach(ep => {
      ctx.save();
      ctx.fillStyle = ep.color;
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, ep.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  renderPlayer(ctx) {
    const p = this.player;
    ctx.save();

    // 1. Holy Garlic Aura visual field
    const garlicWeapon = p.weapons.find(w => w.id.startsWith('garlic_aura'));
    if (garlicWeapon) {
      const radius = 80 + garlicWeapon.level * 20;
      ctx.fillStyle = 'rgba(255, 182, 217, 0.08)';
      ctx.strokeStyle = 'rgba(255, 20, 147, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 2. Orbiting Shields visual blades
    const shieldWeapon = p.weapons.find(w => w.id.startsWith('orbiting_shield'));
    if (shieldWeapon) {
      const shieldCount = shieldWeapon.level + 1;
      const now = performance.now() / 600;
      for (let i = 0; i < shieldCount; i++) {
        const angle = now + (i * Math.PI * 2) / shieldCount;
        const sx = p.x + Math.cos(angle) * 65;
        const sy = p.y + Math.sin(angle) * 65;

        ctx.fillStyle = '#00F0FF';
        ctx.beginPath();
        ctx.arc(sx, sy, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Aegis Shield Power-up Bubble
    if (p.buffs.shield.active) {
      ctx.strokeStyle = '#00FF88';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Overclock Fury Damage Glow
    if (p.buffs.damage.active) {
      ctx.strokeStyle = '#FF4500';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 5. Player Core Avatar (Round with Pink Neon Ring)
    ctx.strokeStyle = '#FF1493';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.stroke();

    if (p.avatarImg && p.avatarImg.complete) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(p.avatarImg, p.x - p.radius + 2, p.y - p.radius + 2, (p.radius - 2) * 2, (p.radius - 2) * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', p.x, p.y);
    }

    ctx.restore();
  }

  renderParticles(ctx) {
    this.particles.forEach(p => {
      ctx.save();
      if (p.type === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.type === 'lightning') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        // Jagged line
        const midX = (p.x1 + p.x2) / 2 + (Math.random() - 0.5) * 24;
        const midY = (p.y1 + p.y2) / 2 + (Math.random() - 0.5) * 24;
        ctx.lineTo(midX, midY);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }
}

window.MojiSurvivorGame = MojiSurvivorGame;
