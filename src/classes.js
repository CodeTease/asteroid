import { Game } from "./game.js";
import { canvas, ctx } from "./ui.js";
import { audioManager } from "./audio.js";

// --- GAME CLASSES ---

export class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height - 40;
        this.size = 15;
        this.speed = 4;
        this.projectileSize = 5;
        this.projectileDamage = 1;
        this.fireRate = 1;
        this.alpha = 1;
        this.allies = [];
        this.lastX = this.x;
        this.vx = 0; // Added for Juggler push effect
        this.isDestroyed = false;
        this.shieldCharges = 0;
        
        this.isStunned = false;
        this.stunTimer = 0;

        // Heat System
        this.heat = 0;
        this.maxHeat = 100;
        this.isOverheated = false;
        this.overheatTimeout = null;
    }

    draw(game) {
        if (this.isDestroyed) return;

        if (this.shieldCharges > 0) {
            ctx.save();
            const shieldRadius = this.size * 2.5;
            const pulse = Math.sin(Date.now() / 150) * 0.2 + 0.5;
            ctx.fillStyle = `rgba(0, 229, 255, ${pulse})`;
            ctx.strokeStyle = `rgba(0, 229, 255, 0.8)`;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00e5ff';

            ctx.beginPath();
            ctx.arc(this.x, this.y + this.size, shieldRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        // Aim Rotation
        if (game && game.isAimUnlocked && game.mousePos) {
             const angle = Math.atan2(game.mousePos.y - this.y, game.mousePos.x - this.x);
             ctx.translate(this.x, this.y);
             ctx.rotate(angle + Math.PI / 2); 
             ctx.translate(-this.x, -this.y);
        }

        // Color changes based on heat
        let engineColor = '0, 229, 255'; // Default Blue
        if (this.isOverheated) engineColor = '255, 69, 0'; // Red
        else if (this.heat > 70) engineColor = '255, 140, 0'; // Orange

        const engineGlow = Math.random() * 0.3 + 0.7;
        ctx.fillStyle = `rgba(${engineColor}, ${engineGlow})`;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.size * 2.2);
        ctx.lineTo(this.x - this.size * 0.6, this.y + this.size * 1.8);
        ctx.lineTo(this.x + this.size * 0.6, this.y + this.size * 1.8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = this.isOverheated ? '#555' : '#cccccc';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.size, this.y + this.size * 2);
        ctx.lineTo(this.x, this.y + this.size * 1.5);
        ctx.lineTo(this.x + this.size, this.y + this.size * 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    update(game, dt) {
        const moveSpeed = this.speed * 60 * dt;
        if ((game.keys['ArrowLeft'] || game.keys['a']) && this.x > this.size) this.x -= moveSpeed;
        if ((game.keys['ArrowRight'] || game.keys['d']) && this.x < canvas.width - this.size) this.x += moveSpeed;

        // Apply Velocity (Juggler Push)
        if (this.vx !== 0) {
            this.x += this.vx * 60 * dt;
            this.vx *= 0.9; // Friction to slow down push
            if (Math.abs(this.vx) < 0.1) this.vx = 0;

            // Boundary checks for push
            if (this.x < this.size) this.x = this.size;
            if (this.x > canvas.width - this.size) this.x = canvas.width - this.size;
        }

        // Heat Decay
        if (!this.isOverheated && this.heat > 0) {
            // Check for Sizzler
            const hasSizzler = game.asteroids.some(a => a.type === 'sizzler');
            // Check for BehemothTurret
            const hasBehemoth = game.asteroids.some(a => a instanceof BehemothTurret);

            let decayRate = 40;
            if (hasSizzler) decayRate = 20;
            if (hasBehemoth) decayRate = 10; // Behemoth significantly reduces cooling

            this.heat -= decayRate * dt; // Decay speed
            if (this.heat < 0) this.heat = 0;
        }
    }

    shoot(game) {
        if (game.isGameOver || game.isPaused || this.isOverheated) return;

        // Heat Build-up
        if (game.isAimUnlocked && !game.isNoHeatMode) {
            // Check for Sizzler
            const hasSizzler = game.asteroids.some(a => a.type === 'sizzler');
             // Check for BehemothTurret
            const hasBehemoth = game.asteroids.some(a => a instanceof BehemothTurret);

            let heatGen = 10;
            if (hasSizzler) heatGen = 12;
            if (hasBehemoth) heatGen = 15; // Behemoth increases heat generation

            this.heat += heatGen;
            if (this.heat >= this.maxHeat) {
                this.heat = this.maxHeat;
                this.isOverheated = true;
                audioManager.playSound('finalbossWarning'); // Re-use sound for jam
                game.updateGameStatus("WEAPON JAMMED!");
                this.overheatTimeout = setTimeout(() => {
                    this.isOverheated = false;
                    this.heat = 0;
                }, 2000); // 2s penalty
            }
        }

        audioManager.playSound('shoot', 0.5);

        // Helper to create bullets
        const createBullet = (originX, originY, source = 'player') => {
            let vx = 0;
            let vy = -8;

            if (game.isAimUnlocked && game.mousePos) {
                const dx = game.mousePos.x - originX;
                const dy = game.mousePos.y - originY;
                const dist = Math.hypot(dx, dy);
                const speed = 10;
                vx = (dx / dist) * speed;
                vy = (dy / dist) * speed;
            }

            if (this.fireRate === 2) {
                if (game.isAimUnlocked) {
                    game.projectiles.push(new Projectile(originX, originY, { size: this.projectileSize, damage: this.projectileDamage, vx: vx + 1, vy: vy, source: source }));
                    game.projectiles.push(new Projectile(originX, originY, { size: this.projectileSize, damage: this.projectileDamage, vx: vx - 1, vy: vy, source: source }));
                } else {
                    game.projectiles.push(new Projectile(originX - 7, originY, { size: this.projectileSize, damage: this.projectileDamage, source: source }));
                    game.projectiles.push(new Projectile(originX + 7, originY, { size: this.projectileSize, damage: this.projectileDamage, source: source }));
                }
            } else {
                game.projectiles.push(new Projectile(originX, originY, { size: this.projectileSize, damage: this.projectileDamage, vx, vy, source: source }));
            }
        };

        // Player shoots
        createBullet(this.x, this.y, 'player');

        // Echo shoots (if exists)
        if (game.echoAlly && !game.echoAlly.isStunned) {
            createBullet(game.echoAlly.x, game.echoAlly.y, 'echo');
        }
        // Second Echo (Permanent Echo Skill)
        if (game.echoAlly2 && !game.echoAlly2.isStunned) {
            createBullet(game.echoAlly2.x, game.echoAlly2.y, 'echo');
        }
    }
}

export class Projectile {
    constructor(x, y, options = {}) {
        this.x = x;
        this.y = y;
        this.size = options.size ?? 5;
        this.damage = options.damage ?? 1;
        this.vx = options.vx ?? 0;
        this.vy = options.vy ?? -8;
        this.color = options.color ?? '#00ffff';
        this.source = options.source ?? 'player'; // 'player', 'echo', 'ai_ally'
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y, this.size, this.size * 2);
        ctx.shadowBlur = 0;
    }

    update(game, dt) {
        const moveFactor = 60 * dt;
        this.x += this.vx * moveFactor;
        this.y += this.vy * moveFactor;
    }
}

export class Asteroid {
    constructor(game, options = {}) {
        this.isBoss = options.isBoss ?? false;
        this.x = options.x ?? Math.random() * canvas.width;
        this.y = options.y ?? -50;
        this.vx = 0;
        this.fireCooldown = 2000;
        this.lastFireTime = Date.now();
        
        // Elite & Linked Properties
        this.isElite = options.isElite ?? false;
        this.partner = options.partner ?? null;
        this.isEnraged = false; // For Linked Enemies
        
        // Seeker specific
        this.initialTargetX = null;

        // Teleporter specific
        this.teleportCooldown = 3000;
        this.lastTeleportTime = Date.now();

        // Orbiter specific
        this.orbitAngle = 0;
        this.orbitRadius = 150;
        this.isOrbiting = false;

        // Weaver specific
        this.baseX = this.x;
        this.weaverTime = 0;

        // Anchor specific
        this.anchorTarget = null;
        this.protectedBy = null;

        if (this.isBoss) {
            this.type = 'boss';
        } else if (options.type) {
            this.type = options.type;
        } else {
            const rand = Math.random();
            if (rand < 0.1) this.type = 'scout';
            else if (rand < 0.2) this.type = 'brute';
            else if (rand < 0.3) this.type = 'shard';
            else if (rand < 0.35) this.type = 'shooter';
            else if (rand < 0.45) this.type = 'splitter';
            else this.type = 'standard';
        }

        let healthMultiplier = game.gameTime >= 200 ? 2 : 1;
        // VOID MODE EXTENDED BUFF (Global x1.5 HP for ALL enemies after Behemoth Defeated)
        if (game.behemothDefeated) {
            healthMultiplier *= 1.5;
        }

        if (this.isElite) {
            healthMultiplier *= 2; // Elite x2 HP
        }

        switch (this.type) {
            case 'boss':
                this.size = 60; this.speed = 0.8; this.health = options.healthOverride ?? (50 * healthMultiplier); this.color = '#ff4500';
                break;
            case 'orbiter': // VOID LEGION
                this.size = 15; this.speed = 3; this.health = 3 * healthMultiplier; this.color = '#ffff00'; // Yellow
                break;
            case 'weaver': // VOID LEGION
                this.size = 20; this.speed = 2; this.health = 2 * healthMultiplier; this.color = '#ff00ff'; // Magenta
                break;
            case 'bulwark': // VOID LEGION
                this.size = 40; this.speed = 0.5; this.health = 10 * healthMultiplier; this.color = '#444'; // Dark Grey
                break;
            case 'sizzler': // NEW VOID LEGION
                this.size = 50; this.speed = 0.5; this.health = 25 * healthMultiplier; this.color = '#ff6600'; // Orange
                break;
            case 'juggler': // NEW VOID LEGION
                this.size = 25; this.speed = 2.5; this.health = 4 * healthMultiplier; this.color = '#00ff00'; // Green
                this.pushRadius = 200;
                break;
            case 'anchor': // NEW VOID LEGION
                this.size = 15; this.speed = 4; this.health = 3 * healthMultiplier; this.color = '#ffffff'; // White
                break;
            case 'tanker': // NEW VOID LEGION
                this.size = 45; this.speed = 1; this.health = 30 * healthMultiplier; this.color = '#8B4513'; // SaddleBrown
                break;
            case 'stunner': // NEW VOID LEGION
                this.size = 30; this.speed = 0.5; this.health = 15 * healthMultiplier; this.color = '#FFFFE0'; // LightYellow
                break;
            // ... (Existing types kept same) ...
            case 'scout': this.size = 12; this.speed = Math.random() * 2 + 2.5; this.health = 1 * healthMultiplier; this.color = '#add8e6'; break;
            case 'brute': this.size = 35; this.speed = Math.random() * 1 + 0.8; this.health = 2 * healthMultiplier; this.color = '#d2b48c'; break;
            case 'shard': this.size = 20; this.speed = Math.random() * 1.5 + 1; this.health = 1 * healthMultiplier; this.color = '#dda0dd'; this.vx = (Math.random() - 0.5) * 2; break;
            case 'shooter': this.size = 25; this.speed = Math.random() * 1 + 1; this.health = 2 * healthMultiplier; this.color = '#9400d3'; break;
            case 'splitter': this.size = 30; this.speed = Math.random() * 1 + 1; this.health = 1 * healthMultiplier; this.color = '#ff8c00'; break;
            case 'seeker': this.size = 18; this.speed = 6; this.health = 1 * healthMultiplier; this.color = '#ff3333'; if (game.player) { const dx = game.player.x - this.x; const dy = game.player.y - this.y; const dist = Math.hypot(dx, dy); this.vx = (dx / dist) * 2; } break;
            case 'teleporter': this.size = 28; this.speed = 0.2; this.health = 3 * healthMultiplier; this.color = '#00ffcc'; this.fireCooldown = 1500; break;
            case 'standard': default: this.size = options.size ?? (Math.random() * 20 + 15); this.speed = Math.random() * 2 + 1; this.health = 1 * healthMultiplier; this.color = '#a9a9a9'; break;
        }

        this.maxHealth = this.health; // Set Max Health

        // --- RANDOMIZED SHAPE GENERATION ---
        this.shape = [];
        // Default random polygon params
        let sides = Math.floor(Math.random() * 3) + 7; // 7-9 sides
        let jaggedness = 0.4; // How much radius varies

        // Customize shapes based on type
        if (['shard', 'shooter', 'seeker', 'weaver'].includes(this.type)) {
            sides = 5 + Math.floor(Math.random() * 2); 
            jaggedness = 0.6; // Spikier
        } else if (this.type === 'bulwark') {
            sides = 4 + Math.floor(Math.random() * 2); // Blocky/Rectangular
            jaggedness = 0.1; // Smooth blocks
        } else if (this.type === 'orbiter') {
            sides = 6; // Hexagon-ish
            jaggedness = 0.2; // Techy
        } else if (this.type === 'sizzler') {
            sides = 4; // Rectangle
            jaggedness = 0.0;
        } else if (this.type === 'juggler') {
            sides = 8;
            jaggedness = 0.3;
        } else if (this.type === 'anchor') {
            sides = 4; // Diamond/Cross
            jaggedness = 0.5;
        } else if (this.type === 'tanker') {
            sides = 8; // Octagon
            jaggedness = 0.1;
        } else if (this.type === 'stunner') {
             sides = 5; // Pentagon
             jaggedness = 0.1;
        }

        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            
            // Radius Logic
            let r = this.size; 
            if (this.type === 'seeker') {
                 // Star shape specific for seeker
                 r = (i % 2 === 0) ? this.size : this.size * 0.4;
            } else if (this.type === 'shard' || this.type === 'shooter') {
                 // Spiky crystal specific logic
                 r = this.size * ((i % 2 === 0 ? 1 : 0.5) * (Math.random() * 0.2 + 0.9)); 
            } else {
                 // General Random Rock Logic
                 // vary radius by +/- jaggedness
                 r = this.size * (1 - jaggedness + Math.random() * jaggedness * 2);
            }

            this.shape.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        }
        // ------------------------------------
    }

    draw(game) {
        ctx.save();
        ctx.fillStyle = this.color;
        
        // Effects
        if (this.type === 'teleporter' && Date.now() - this.lastTeleportTime > this.teleportCooldown - 500) {
             if (Math.floor(Date.now() / 100) % 2 === 0) ctx.globalAlpha = 0.5;
        }

        // ELITE AURA
        if (this.isElite) {
            ctx.shadowColor = '#ffd700'; // Gold/Orange
            ctx.shadowBlur = 20;
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
        }

        // ENRAGED EFFECT (Linked Enemy)
        if (this.isEnraged) {
             ctx.shadowColor = '#ff0000';
             ctx.shadowBlur = 30;
             ctx.fillStyle = '#ff0000'; // Turn red
        }

        ctx.beginPath();
        ctx.moveTo(this.x + this.shape[0].x, this.y + this.shape[0].y);
        for (let i = 1; i < this.shape.length; i++) {
            ctx.lineTo(this.x + this.shape[i].x, this.y + this.shape[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Linked Beam
        if (this.partner && !this.partner.isDead() && game.asteroids.includes(this.partner)) {
             ctx.strokeStyle = '#00ff00'; // Green link
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.moveTo(this.x, this.y);
             ctx.lineTo(this.partner.x, this.partner.y);
             ctx.stroke();
        }

        // Bulwark Shield Drawing
        if (this.type === 'bulwark' && game && game.player) {
            ctx.save();
            const angleToPlayer = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            ctx.translate(this.x, this.y);
            ctx.rotate(angleToPlayer);
            
            ctx.beginPath();
            ctx.arc(0, 0, this.size + 15, -Math.PI/2, Math.PI/2);
            ctx.strokeStyle = '#00e5ff'; // Shield Color
            ctx.lineWidth = 4;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00e5ff';
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
        
        // Anchor Line
        if (this.type === 'anchor' && this.anchorTarget) {
            ctx.save();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.anchorTarget.x, this.anchorTarget.y);
            ctx.stroke();
            ctx.restore();
        }

        // Protected Icon
        if (this.protectedBy) {
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("🛡️", this.x, this.y - this.size - 10);
            ctx.restore();
        }

        // Health Text
        if (this.health > 1) {
            ctx.fillStyle = 'white';
            ctx.font = '14px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(Math.ceil(this.health).toString(), this.x, this.y + 5);
        }
    }

    isDead() {
        return this.health <= 0;
    }

    update(game, dt) {
        const moveFactor = 60 * dt;
        
        // LINKED ENEMY LOGIC (Check Partner)
        if (this.partner) {
             // If partner is dead or removed from game
             if (this.partner.health <= 0 || !game.asteroids.includes(this.partner)) {
                 if (!this.isEnraged) {
                     this.isEnraged = true;
                     this.speed *= 3; // Massive speed boost
                     this.vx = 0; // Go straight down
                     game.updateGameStatus("Enemy Enraged!");
                 }
                 this.partner = null; // Break link
             }
        }

        if (this.isEnraged) {
             // Override standard movement patterns
             this.y += this.speed * moveFactor;
             // Simple seek X if needed, but spec says "lao thẳng xuống đáy" (rush straight down)
             // Let's make it rush down but slightly towards player for lethality
             if (game.player) {
                  const dx = game.player.x - this.x;
                  this.x += (dx > 0 ? 1 : -1) * 0.5 * moveFactor;
             }
             return; // Skip other movement logic
        }

        if (this.type === 'orbiter') {
            if (game.player && !game.player.isDestroyed) {
                const dx = game.player.x - this.x;
                const dy = game.player.y - this.y;
                const dist = Math.hypot(dx, dy);

                if (dist < this.orbitRadius + 50 && dist > this.orbitRadius - 50) {
                    this.isOrbiting = true;
                }

                if (this.isOrbiting) {
                    // Orbit logic
                    this.orbitAngle += 0.05 * moveFactor;
                    this.x = game.player.x + Math.cos(this.orbitAngle) * this.orbitRadius;
                    this.y = game.player.y + Math.sin(this.orbitAngle) * this.orbitRadius;
                } else {
                    // Approach logic
                    this.y += this.speed * moveFactor;
                    // Mild seek
                    this.x += (dx / dist) * this.speed * moveFactor;
                }
            } else {
                this.y += this.speed * moveFactor;
            }

        } else if (this.type === 'weaver') {
            this.weaverTime += 0.05 * moveFactor;
            this.y += this.speed * moveFactor;
            this.x = this.baseX + Math.sin(this.weaverTime) * 100; // Zig Zag

            // Drop Mines
            if (Math.random() < 0.01) {
                game.enemyProjectiles.push(new StaticMine(this.x, this.y));
            }

        } else if (this.type === 'bulwark') {
            this.y += this.speed * moveFactor; // Slow march

        } else if (this.type === 'sizzler') {
            this.y += this.speed * moveFactor; // Straight line, slow

        } else if (this.type === 'juggler') {
            if (game.player && !game.player.isDestroyed) {
                const dx = game.player.x - this.x;
                const dy = game.player.y - this.y;
                const dist = Math.hypot(dx, dy);

                // Movement Logic: Maintain 150px distance
                const targetDist = 150;
                if (dist > targetDist + 10) {
                    this.x += (dx / dist) * this.speed * moveFactor;
                    this.y += (dy / dist) * this.speed * moveFactor;
                } else if (dist < targetDist - 10) {
                    this.x -= (dx / dist) * this.speed * moveFactor;
                    this.y -= (dy / dist) * this.speed * moveFactor;
                } else {
                    // Orbit slightly if at sweet spot
                     this.x += Math.sin(Date.now() / 500) * this.speed * moveFactor;
                }

                // Push Logic
                if (dist < this.pushRadius) {
                    // Draw force field effect
                    ctx.save();
                    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.pushRadius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();

                    // Push player
                    // Direction is random or away. Requirement says: "random direction or push away".
                    // Let's do random for more chaos as per "Juggler" name.
                    if (Math.random() < 0.1) {
                         const pushForce = (Math.random() - 0.5) * 5; // Random left/right push
                         game.player.vx += pushForce;
                    }
                }
            } else {
                 this.y += this.speed * moveFactor;
            }

        } else if (this.type === 'anchor') {
            // Find target if none
            if (!this.anchorTarget || this.anchorTarget.health <= 0 || !game.asteroids.includes(this.anchorTarget)) {
                this.anchorTarget = null;
                // Look for big enemies
                const potentialTargets = game.asteroids.filter(a =>
                    (a.type === 'bulwark' || a.type === 'brute' || a.type === 'sizzler') &&
                    a !== this && !a.protectedBy
                );

                if (potentialTargets.length > 0) {
                    // Pick closest
                    let minD = Infinity;
                    for (const t of potentialTargets) {
                        const d = Math.hypot(this.x - t.x, this.y - t.y);
                        if (d < minD) {
                            minD = d;
                            this.anchorTarget = t;
                        }
                    }
                }
            }

            if (this.anchorTarget) {
                this.anchorTarget.protectedBy = this;
                // Orbit/Follow Logic
                const dx = this.anchorTarget.x - this.x;
                const dy = this.anchorTarget.y - this.y;
                const dist = Math.hypot(dx, dy);
                const desiredDist = this.anchorTarget.size + 40;

                if (dist > desiredDist + 5) {
                    this.x += (dx / dist) * this.speed * 1.5 * moveFactor; // Catch up fast
                    this.y += (dy / dist) * this.speed * 1.5 * moveFactor;
                } else if (dist < desiredDist - 5) {
                    this.x -= (dx / dist) * this.speed * moveFactor;
                    this.y -= (dy / dist) * this.speed * moveFactor;
                } else {
                    // Orbit
                    const angle = Math.atan2(dy, dx) + (0.05 * moveFactor);
                    this.x = this.anchorTarget.x - Math.cos(angle) * desiredDist;
                    this.y = this.anchorTarget.y - Math.sin(angle) * desiredDist;
                }
            } else {
                // No target, just move down
                this.y += this.speed * moveFactor;
            }

        } else if (this.type === 'seeker') {
             if (game.player && !game.player.isDestroyed) {
                 const dx = game.player.x - this.x;
                 const dy = game.player.y - this.y;
                 const dist = Math.hypot(dx, dy);
                 this.x += (dx / dist) * this.speed * moveFactor;
                 this.y += (dy / dist) * this.speed * moveFactor;
             } else {
                 this.y += this.speed * moveFactor;
             }
        } else if (this.type === 'teleporter') {
            this.y += this.speed * moveFactor;
            if (Date.now() - this.lastTeleportTime > this.teleportCooldown) {
                this.x = Math.random() * (canvas.width - 100) + 50;
                this.y = Math.random() * (canvas.height / 2); 
                this.lastTeleportTime = Date.now();
                game.createExplosion(this.x, this.y, this.color, 10);
                audioManager.playSound('enemyShoot', 0.2);
            }
        } else {
            this.y += this.speed * moveFactor;
            this.x += this.vx * moveFactor;
            if (this.x < this.size || this.x > canvas.width - this.size) {
                this.vx *= -1;
            }
        }

        // Shooting logic
        if ((this.type === 'shooter' || this.type === 'teleporter' || this.type === 'orbiter') && game.player && !game.isGameOver && Date.now() - this.lastFireTime > this.fireCooldown) {
            const dx = game.player.x - this.x;
            const dy = game.player.y - this.y;
            const dist = Math.hypot(dx, dy);
            const speed = 4;
            const vx = (dx / dist) * speed;
            const vy = (dy / dist) * speed;
            game.enemyProjectiles.push(new Projectile(this.x, this.y, { vx, vy, color: '#ff69b4', size: 4 }));
            audioManager.playSound('enemyShoot', 0.4);
            this.lastFireTime = Date.now();
        }

        // Stunner Logic
        if (this.type === 'stunner' && !game.isGameOver && Date.now() - this.lastFireTime > 5000) { // Fires every 5s
             // Find target: Random Ally or Player if no allies
             const targets = [...game.player.allies];
             if (game.laserAlly) targets.push(game.laserAlly);
             if (game.echoAlly) targets.push(game.echoAlly);
             if (game.echoAlly2) targets.push(game.echoAlly2);

             if (targets.length > 0) {
                 const target = targets[Math.floor(Math.random() * targets.length)];
                 // Instant hit stun beam (visual effect handled here or in draw?)
                 // Let's create a visual projectile but instant effect
                 target.isStunned = true;
                 target.stunTimer = 5; // 5 seconds

                 // Create Stun Beam Effect
                 game.particles.push(new Particle(this.x, this.y, '#ffff00')); // Simple placeholder

                 // Draw beam (hacky: create a fast temporary projectile or just draw in its draw method?)
                 // Let's create a special projectile that is just visual
                 game.enemyProjectiles.push(new Projectile(this.x, this.y, { vx: 0, vy: 0, color: 'transparent', size: 0 })); // dummy
                 // Actually, let's just use game.createExplosion for visual feedback on target
                 game.createExplosion(target.x, target.y, '#ffff00', 10);
                 game.updateGameStatus("Ally Stunned!");

                 this.lastFireTime = Date.now();
             }
        }
    }
}

export class BehemothTurret extends Asteroid {
    constructor(game) {
        super(game, { isBoss: true });
        this.size = 80;
        this.x = canvas.width / 2;
        this.y = -this.size;
        this.speed = 0.5;
        this.health = 2000;
        this.maxHealth = 2000;
        this.color = '#800000'; // Maroon
        this.type = 'behemoth';

        this.phase = 'enter'; // enter, attack, idle
        this.phaseTimer = 0;
        this.targetY = 100;
        this.gunAngle = 0;
        this.bombCooldown = 5000;
        this.lastBombTime = 0;
    }

    draw(game) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.rect(-this.size, -this.size/2, this.size * 2, this.size);
        ctx.fill();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Guns
        ctx.fillStyle = '#333';
        ctx.fillRect(-this.size - 20, 0, 20, 40); // Left gun
        ctx.fillRect(this.size, 0, 20, 40); // Right gun

        // Heat Aura
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = 'orange';
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Health bar
         const barWidth = 100;
         const barHeight = 10;
         const healthPercent = this.health / this.maxHealth;
         ctx.fillStyle = 'red';
         ctx.fillRect(this.x - barWidth/2, this.y - this.size - 20, barWidth * healthPercent, barHeight);
         ctx.strokeStyle = 'white';
         ctx.strokeRect(this.x - barWidth/2, this.y - this.size - 20, barWidth, barHeight);
    }

    update(game, dt) {
        if (this.phase === 'enter') {
            this.y += this.speed * 60 * dt;
            if (this.y >= this.targetY) {
                this.y = this.targetY;
                this.phase = 'attack';
                this.phaseTimer = 10; // 10s attack
                game.updateGameStatus("Behemoth Turret Active!");
                game.screenShakeDuration = 20;
            }
        } else if (this.phase === 'attack') {
            this.phaseTimer -= dt;

            // Wobble
            this.x += Math.sin(Date.now() / 500) * 0.5;

            // Aimed Shots Logic
            if (game.player && !game.player.isDestroyed) {
                if (Math.floor(Date.now() / 100) % 2 === 0) { // High frequency (approx every 200ms)
                    const speed = 7;

                    // Left Gun Aim
                    const angleL = Math.atan2(game.player.y - (this.y + 20), game.player.x - (this.x - this.size - 10));
                    const vxL = Math.cos(angleL) * speed;
                    const vyL = Math.sin(angleL) * speed;
                    game.enemyProjectiles.push(new Projectile(this.x - this.size - 10, this.y + 20, { vx: vxL, vy: vyL, color: 'orange', size: 6 }));

                    // Right Gun Aim
                    const angleR = Math.atan2(game.player.y - (this.y + 20), game.player.x - (this.x + this.size + 10));
                    const vxR = Math.cos(angleR) * speed;
                    const vyR = Math.sin(angleR) * speed;
                    game.enemyProjectiles.push(new Projectile(this.x + this.size + 10, this.y + 20, { vx: vxR, vy: vyR, color: 'orange', size: 6 }));
                }
            }

            // Bomb Skill
            if (Date.now() - this.lastBombTime > this.bombCooldown) {
                const targetX = Math.random() * (canvas.width - 40) + 20;
                const targetY = Math.random() * (canvas.height - 100) + 100;
                game.enemyProjectiles.push(new BehemothBomb(this.x, this.y, targetX, targetY));
                this.lastBombTime = Date.now();
                game.updateGameStatus("Behemoth Launching Bomb!");
            }

            if (this.phaseTimer <= 0) {
                this.phase = 'idle';
                this.phaseTimer = 15; // 15s idle
            }
        } else if (this.phase === 'idle') {
            this.phaseTimer -= dt;
            // Regen? Or just sit there.
            if (this.phaseTimer <= 0) {
                this.phase = 'attack';
                this.phaseTimer = 10;
            }
        }
    }
}

export class MiniBehemoth extends BehemothTurret {
    constructor(game, x, y) {
        super(game);
        this.x = x;
        this.y = y;
        this.size = 40; // Smaller
        this.health = 800; // Buffed a bit
        this.maxHealth = 800;
        this.isBoss = false; // Not a boss boss, just a summon
        this.type = 'mini_behemoth';
        this.phase = 'attack';
        this.targetY = y;
    }
    // Override update to not do boss phases if needed, or keep simple
    update(game, dt) {
        // Simple wobble and shoot
        this.y = this.targetY + Math.sin(Date.now() / 800) * 10;
        
        // Shoot
        if (Math.random() < 0.05) {
             const target = game.player;
             if (target) {
                 const angle = Math.atan2(target.y - this.y, target.x - this.x);
                 const speed = 5;
                 game.enemyProjectiles.push(new Projectile(this.x, this.y, {
                     vx: Math.cos(angle) * speed,
                     vy: Math.sin(angle) * speed,
                     color: 'orange',
                     size: 5
                 }));
             }
        }
    }
}

export class Monolith extends Asteroid {
    constructor(game) {
        super(game, { isBoss: true });
        this.size = 250;
        this.x = canvas.width / 2;
        this.y = -200;
        this.initialY = 150;
        this.health = 20000;
        this.maxHealth = 20000;
        this.color = '#000000'; // Vantablack
        this.type = 'monolith';
        
        this.coolingNodes = [
            { x: -85, y: 85, hp: 300, active: true },
            { x: 85, y: 85, hp: 300, active: true },
            { x: 0, y: 170, hp: 300, active: true }
        ];
        
        this.state = 'enter'; // enter, idle, attack, stunned
        this.stateTimer = 0;
        this.gravityPressActive = false;
        this.gravityTimer = 0;
    }

    draw(game) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Vantablack Body
        ctx.fillStyle = 'black';
        ctx.shadowColor = '#800080'; // Purple
        ctx.shadowBlur = 30;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        
        // Purple Outline (Vibrating)
        ctx.strokeStyle = `rgba(128, 0, 128, ${0.5 + Math.random() * 0.5})`;
        ctx.lineWidth = 5;
        ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);

        // Cooling Nodes
        this.coolingNodes.forEach(node => {
            if (node.active) {
                ctx.fillStyle = '#00ffff'; // Blue
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(node.x, node.y, 15, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Stunned Effect
        if (this.state === 'stunned') {
             ctx.fillStyle = 'yellow';
             ctx.font = '30px Arial';
             ctx.fillText("⚡ STUNNED ⚡", -100, 0);
        }

        ctx.restore();

        // Gravity Press Visual
        if (this.gravityPressActive) {
             ctx.save();
             const grad = ctx.createLinearGradient(0, this.y + this.size/2, 0, canvas.height);
             grad.addColorStop(0, 'rgba(128, 0, 128, 0.5)');
             grad.addColorStop(1, 'rgba(128, 0, 128, 0)');
             ctx.fillStyle = grad;
             ctx.fillRect(0, this.y + this.size/2, canvas.width, canvas.height);
             ctx.restore();
        }
    }

    update(game, dt) {
        if (this.state === 'enter') {
            this.y += 20 * dt;
            if (this.y >= this.initialY) {
                this.y = this.initialY;
                this.state = 'idle';
                this.stateTimer = 2;
                game.updateGameStatus("MONOLITH DESCENDS!");
                game.screenShakeDuration = 60;
            }
            return;
        }

        if (this.state === 'stunned') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'idle';
                this.stateTimer = 2;
                // Respawn nodes if all dead? Or just recover?
                // Suggests nodes might regenerate or it's a one-time weakness phase. 
                // Let's regenerate them with lower HP to keep mechanic active.
                if (this.coolingNodes.every(n => !n.active)) {
                     this.coolingNodes.forEach(n => { n.active = true; n.hp = 200; });
                }
            }
            return;
        }

        // Logic check for nodes
        // Hit detection for nodes is complex in standard collision. 
        // We will assume player shoots body, and damage distributes or we check node collision manually in Game class.
        // For simplicity: If Monolith takes damage, check if it hit a node area?
        // Actually, let's implement the node hit logic in Game.checkCollisions or here if we pass projectiles.
        // Since Game handles collisions, we'll need to modify Game.js to handle node hits.

        if (this.state === 'idle') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'attack';
                this.stateTimer = 5; // Time between attacks
                this.chooseAttack(game);
            }
        } else if (this.state === 'attack') {
             this.stateTimer -= dt;
             if (this.stateTimer <= 0) {
                 this.state = 'idle';
                 this.stateTimer = 3;
                 this.gravityPressActive = false; // Reset gravity
             }
        }

        // Gravity Press Effect
        if (this.gravityPressActive) {
             if (game.player) {
                 game.player.y += 200 * dt; // Push down
                 if (game.player.y > canvas.height - 40) game.player.y = canvas.height - 40;
             }
             this.gravityTimer -= dt;
             if (this.gravityTimer <= 0) {
                 // SLAM
                 game.takeBarrierDamage(25);
                 game.createExplosion(game.player.x, canvas.height, '#800080', 50);
                 game.updateGameStatus("MONOLITH SLAM! BARRIER CRITICAL!");
                 this.gravityPressActive = false;
             }
        }
    }

    chooseAttack(game) {
        const rand = Math.random();
        if (rand < 0.4) {
            // Legion Gate
            game.updateGameStatus("Legion Gate Opened!");
            for(let i=0; i<3; i++) {
                // Spawn Elites
                const type = ['juggler', 'sizzler', 'tanker'][Math.floor(Math.random()*3)];
                game.asteroids.push(new Asteroid(game, { type, isElite: true, x: Math.random() * canvas.width, y: -50 }));
            }
        } else if (rand < 0.7) {
            // Mini Behemoth
            game.updateGameStatus("Mini-Behemoth Deployed!");
            // Ensure Mini-Behemoth does not spawn overlapping the Monolith itself
            const margin = 50; // safety margin from Monolith edges
            const leftBound = this.x - this.size / 2 - margin;
            const rightBound = this.x + this.size / 2 + margin;
            // pick a safe x that is outside the monolith horizontal bounds
            let spawnX = Math.random() * (canvas.width - 100) + 50;
            let attempts = 0;
            while (spawnX > leftBound && spawnX < rightBound && attempts < 10) {
                spawnX = Math.random() * (canvas.width - 100) + 50;
                attempts++;
            }
            // if still inside after attempts, push it to nearest side
            if (spawnX > leftBound && spawnX < rightBound) {
                if (spawnX < this.x) spawnX = Math.max(50, leftBound - margin);
                else spawnX = Math.min(canvas.width - 50, rightBound + margin);
            }
            game.asteroids.push(new MiniBehemoth(game, spawnX, 200));
        } else {
            // Gravity Press
            game.updateGameStatus("GRAVITY PRESS! BREAK THE NODES!");
            this.gravityPressActive = true;
            this.gravityTimer = 10; // 10s to stop it
        }
    }

    takeDamage(amount, source, hitX, hitY) {
        // Resistances
        let damage = amount;
        if (source === 'ai_ally') return 0; // Immune
        if (source === 'laser_ally') damage *= 0.1; // 90% resist
        if (source === 'player') damage *= 0.5; // 50% resist
        if (source === 'ultimate') {
             // Absorb
             this.health += 100;
             return 0; 
        }

        // Check Node Hit
        // Transform hitX/Y to local space
        const localX = hitX - this.x;
        const localY = hitY - this.y;
        
        let nodeHit = false;
        for (const node of this.coolingNodes) {
            if (node.active) {
                const dist = Math.hypot(localX - node.x, localY - node.y);
                if (dist < 20) {
                    // Critical Hit on Node
                    node.hp -= amount * 5; // Bonus damage to node
                    damage = amount * 2; // Bonus damage to boss
                    nodeHit = true;
                    if (node.hp <= 0) {
                        node.active = false;
                        // Check all nodes
                        if (this.coolingNodes.every(n => !n.active)) {
                             // STUN TRIGGER
                             this.state = 'stunned';
                             this.stateTimer = 5;
                             this.gravityPressActive = false; // Interrupt gravity
                             // Clear Player Heat
                             if (game.player) {
                                 game.player.heat = 0;
                                 game.player.isOverheated = false;
                                 game.updateGameStatus("NODES DESTROYED! HEAT CLEARED! BOSS STUNNED!");
                             }
                        }
                    }
                    break;
                }
            }
        }

        this.health -= damage;
        return damage;
    }
}

export class GhostAsteroid extends Asteroid {
    constructor(game) {
        super(game, { type: 'standard' }); // Inherit standard stats initially
        this.type = 'ghost';
        this.color = '#333333'; // Darker base
        this.isRevealed = false;
        this.baseSpeed = this.speed;
        this.alpha = 0.1; // Almost invisible
    }

    draw(game) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        if (this.isRevealed) {
             ctx.fillStyle = '#ffffff'; // Ghostly white when revealed
             ctx.shadowColor = '#ffffff';
             ctx.shadowBlur = 10;
        } else {
             ctx.fillStyle = this.color;
        }
        
        ctx.beginPath();
        ctx.moveTo(this.x + this.shape[0].x, this.y + this.shape[0].y);
        for (let i = 1; i < this.shape.length; i++) {
            ctx.lineTo(this.x + this.shape[i].x, this.y + this.shape[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    update(game, dt) {
        // Visibility Logic (Move to update)
        if (!this.isRevealed) {
            let minDistance = Infinity;
            const entities = [game.player, ...game.player.allies];
            if (game.laserAlly) entities.push(game.laserAlly);
            if (game.echoAlly) entities.push(game.echoAlly);
            if (game.echoAlly2) entities.push(game.echoAlly2);
            if (game.vampAlly) entities.push(game.vampAlly);

            entities.forEach(e => {
                if (e && !e.isDestroyed && !e.isRetreating) {
                    const dist = Math.hypot(this.x - e.x, this.y - e.y);
                    if (dist < minDistance) minDistance = dist;
                }
            });

            // Flashlight Radius approx 150
            if (minDistance < 150) {
                this.isRevealed = true;
                this.alpha = 1;
            }
        }

        if (this.isRevealed) {
             // Tăng tốc (Speed up)
             this.y += this.baseSpeed * 2 * 60 * dt;
        } else {
             this.y += this.baseSpeed * 60 * dt;
        }
    }
}

export class FinalBoss extends Asteroid {
    constructor(game) {
        super(game, { isBoss: true });
        this.size = 100;
        this.x = canvas.width / 2;
        this.initialY = 120;
        this.y = -this.size; // Start off-screen
        this.isEntering = true;
        this.speed = 1.5;
        this.vx = this.speed;
        this.maxHealth = 1000 * (game.gameTime >= 200 ? 2 : 1);
        this.health = this.maxHealth;
        this.color = '#8b0000';
        this.currentAttack = 'summonMinions';
        this.attackCooldown = 3000;
        this.lastAttackTime = Date.now();
        this.dashTarget = null;
        this.isWarning = false;
        this.warningTime = 0;
        this.isDefeated = false;
        this.isReturning = false;
    }

    draw() {
        if (this.isWarning && this.dashTarget) {
            ctx.save();
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'red';
            const radius = 40;
            const pulse = Math.abs(Math.sin(Date.now() / 100));
            ctx.globalAlpha = pulse;
            ctx.beginPath();
            ctx.arc(this.dashTarget.x, this.dashTarget.y, radius, 0, Math.PI * 2);
            ctx.moveTo(this.dashTarget.x - radius, this.dashTarget.y);
            ctx.lineTo(this.dashTarget.x + radius, this.dashTarget.y);
            ctx.moveTo(this.dashTarget.x, this.dashTarget.y - radius);
            ctx.lineTo(this.dashTarget.x, this.dashTarget.y + radius);
            ctx.stroke();
            ctx.restore();
        }
        super.draw(null); // Boss doesn't need game ref for shield
    }

    update(game, dt) {
        const moveFactor = 60 * dt;
        // Entrance Animation
        if (this.isEntering) {
            this.y += 5 * moveFactor; // Entrance speed
            if (this.y >= this.initialY) {
                this.y = this.initialY;
                this.isEntering = false;
                game.screenShakeDuration = 20;
                game.screenShakeIntensity = 8;
                audioManager.playSound('finalbossBegin');
            }
            return; // Skip other logic during entrance
        }

        // Movement
        if (this.isReturning) {
            const dy = this.initialY - this.y;
            if (Math.abs(dy) < 5) {
                this.y = this.initialY;
                this.isReturning = false;
            } else {
                this.y += (dy / Math.abs(dy)) * 5 * moveFactor; // Move back at a constant speed
            }
            this.x += this.vx * moveFactor;
            if (this.x < this.size || this.x > canvas.width - this.size) this.vx *= -1;

        } else if (!this.dashTarget) { // Normal patrol
            this.x += this.vx * moveFactor;
            if (this.x < this.size || this.x > canvas.width - this.size) {
                this.vx *= -1;
            }
        } else { // Dashing
            if (this.isWarning && Date.now() - this.warningTime > 1200) {
                this.isWarning = false;
            } else if (!this.isWarning) {
                const dx = this.dashTarget.x - this.x;
                const dy = this.dashTarget.y - this.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 20) {
                    this.dashTarget = null;
                    this.isReturning = true; // Start returning after dash
                    this.vx = this.speed * (Math.random() < 0.5 ? 1 : -1);
                } else {
                    this.x += (dx / dist) * 20 * moveFactor; // Fast dash speed
                    this.y += (dy / dist) * 20 * moveFactor;
                }
            }
        }

        // Attack logic
        if (Date.now() - this.lastAttackTime > this.attackCooldown && !this.dashTarget && !this.isReturning) {
            this.chooseAndPerformAttack(game);
            this.lastAttackTime = Date.now();
        }
    }

    chooseAndPerformAttack(game) {
        const rand = Math.random();
        if (rand < 0.5) { // 50% chance
            this.performAttack(game, 'summonMinions');
            this.attackCooldown = 4000;
        } else if (rand < 0.75) { // 25% chance
            this.performAttack(game, 'dash');
            this.attackCooldown = 5000;
        } else if (rand < 0.9) { // 15% chance
            this.performAttack(game, 'summonCommanders');
            this.attackCooldown = 8000;
        } else { // 5% chance
            this.performAttack(game, 'barrage');
            this.attackCooldown = 6000;
        }
    }

    performAttack(game, attack) {
        switch (attack) {
            case 'summonMinions':
                game.updateGameStatus('Boss summoning minions!');
                for (let i = 0; i < 5; i++) {
                    game.asteroids.push(new Asteroid(game, { x: this.x + (Math.random() - 0.5) * 100, y: this.y }));
                }
                break;
            case 'summonCommanders':
                game.updateGameStatus('Boss summoning commanders!');
                game.asteroids.push(new Asteroid(game, { isBoss: true, x: this.x - 100, y: this.y, healthOverride: 50 }));
                game.asteroids.push(new Asteroid(game, { isBoss: true, x: this.x + 100, y: this.y, healthOverride: 50 }));
                break;
            case 'dash':
                game.updateGameStatus('Boss incoming charge!');
                this.dashTarget = {
                    x: game.player.x + (Math.random() - 0.5) * 150,
                    y: game.player.y - (Math.random() * 100 + 50)
                };
                this.isWarning = true;
                this.warningTime = Date.now();
                break;
            case 'barrage':
                game.updateGameStatus('Boss firing barrage!');
                audioManager.playSound('enemyShoot', 0.8);
                for (let i = 0; i < 30; i++) {
                    const angle = Math.random() * Math.PI; // Shoot downwards in a 180 degree arc
                    const speed = Math.random() * 2 + 3;
                    const vx = Math.cos(angle) * speed;
                    const vy = Math.sin(angle) * speed;
                    game.enemyProjectiles.push(new Projectile(this.x, this.y, { vx, vy, color: '#ff69b4', size: 5 }));
                }
                break;
        }
    }
}

export class AIAlly extends Player {
    constructor(side) {
        super();
        this.side = side;
        this.size *= 0.7;
        this.speed = 1;
        this.projectileSize = 4;
        this.projectileDamage = 1;
        this.fireCooldown = 500;
        this.lastFireTime = 0;
        this.y = canvas.height - 40;
        this.x = side === 'left' ? canvas.width / 4 : canvas.width * 3 / 4;
        this.isRetreating = false;
    }
    draw() {
        if (this.y < -this.size * 2) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.isStunned ? '#555' : '#007bff'; // Grey when stunned
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.size, this.y + this.size * 2);
        ctx.lineTo(this.x + this.size, this.y + this.size * 2);
        ctx.closePath();
        ctx.fill();

        if (this.isStunned) {
             ctx.fillStyle = 'yellow';
             ctx.font = '12px Arial';
             ctx.fillText("⚡", this.x - 4, this.y - 10);
        }
        ctx.restore();
    }
    update(game, dt) {
        if (this.isRetreating) {
            this.y -= this.speed * 60 * dt;
            return;
        }

        if (this.isStunned) {
            this.stunTimer -= dt;
            if (this.stunTimer <= 0) this.isStunned = false;
            return;
        }

        const patrolCenterX = this.side === 'left' ? canvas.width / 4 : canvas.width * 3 / 4;
        const patrolRange = canvas.width / 5;
        this.x = patrolCenterX + Math.sin(Date.now() / 800) * (patrolRange / 2);
        this.y = canvas.height - 40;
        const fireCooldowns = [500, 450, 400, 350, 320, 300];
        this.fireCooldown = fireCooldowns[game.allyUpgrades.fireRateLevel];
        if (!game.isGameOver && Date.now() - this.lastFireTime > this.fireCooldown) {
            let bestTarget = null;
            
            // PRIORITY TARGETING FOR AI ALLY
            // Mini-Behemoth > Elite/Linked (Legion Gate) > Monolith > Others
            
            const miniBehemoth = game.asteroids.find(a => a.type === 'mini_behemoth');
            if (miniBehemoth) {
                bestTarget = miniBehemoth;
            }

            if (!bestTarget) {
                // Elite or Linked (Enraged) - High priority
                const highPriority = game.asteroids.find(a => a.isElite || a.isEnraged);
                if (highPriority) {
                    bestTarget = highPriority;
                }
            }

            if (!bestTarget && game.isFinalBossActive && game.finalBoss) {
                 bestTarget = game.finalBoss;
            } 
            
            if (!bestTarget && game.isBossActive) {
                bestTarget = game.asteroids.find(a => a.isBoss) ?? null;
            } 
            
            if (!bestTarget) {
                let minDistance = Infinity;
                for (const asteroid of game.asteroids) {
                    const isOnCorrectSide = (this.side === 'left' && asteroid.x < canvas.width / 2) ||
                        (this.side === 'right' && asteroid.x >= canvas.width / 2);
                    if (isOnCorrectSide) {
                        const distance = Math.hypot(this.x - asteroid.x, this.y - asteroid.y);
                        if (distance < minDistance) {
                            minDistance = distance;
                            bestTarget = asteroid;
                        }
                    }
                }
            }
            if (bestTarget) {
                this.shootAt(game, bestTarget);
            }
            this.lastFireTime = Date.now();
        }
    }
    shootAt(game, target) {
        audioManager.playSound('shoot', 0.2);
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);
        const baseSpeed = 8;
        const speed = game.allyUpgrades.hasFasterProjectiles ? baseSpeed * 1.5 : baseSpeed;
        const projectileOptions = { size: this.projectileSize, damage: this.projectileDamage, source: 'ai_ally' };
        if (game.allyUpgrades.hasDoubleShot) {
            const angle = Math.atan2(dy, dx);
            const spread = Math.PI / 18;
            const vx1 = Math.cos(angle - spread) * speed;
            const vy1 = Math.sin(angle - spread) * speed;
            const vx2 = Math.cos(angle + spread) * speed;
            const vy2 = Math.sin(angle + spread) * speed;
            game.projectiles.push(new Projectile(this.x, this.y, { ...projectileOptions, vx: vx1, vy: vy1 }));
            game.projectiles.push(new Projectile(this.x, this.y, { ...projectileOptions, vx: vx2, vy: vy2 }));
        } else {
            const vx = (dx / dist) * speed;
            const vy = (dy / dist) * speed;
            game.projectiles.push(new Projectile(this.x, this.y, { ...projectileOptions, vx, vy }));
        }
    }
}

export class LaserAlly extends Player {
    constructor() {
        super();
        this.size *= 2; 
        this.x = canvas.width / 2;
        this.y = canvas.height - 70;
        this.isRetreating = false;
        this.isFiring = false;
        this.laserTarget = null;
        this.fireDuration = 10000; 
        this.lastFireStopTime = 0;
        this.cooldownDuration = 15000; 
        this.laserDamage = 20; 
    }
    draw() {
        if (this.y < -this.size * 2) return;
        const now = Date.now();
        const isOnCooldown = now - this.lastFireStopTime < this.cooldownDuration;

        if (this.isStunned) {
             ctx.save();
             ctx.fillStyle = '#555';
             ctx.beginPath();
             ctx.moveTo(this.x, this.y);
             ctx.lineTo(this.x - this.size, this.y + this.size * 2);
             ctx.lineTo(this.x + this.size, this.y + this.size * 2);
             ctx.closePath();
             ctx.fill();
             ctx.fillStyle = 'yellow';
             ctx.font = '20px Arial';
             ctx.fillText("⚡", this.x - 7, this.y + 20);
             ctx.restore();
             return;
        }

        if (isOnCooldown && !this.isFiring) {
            ctx.save();
            const cooldownProgress = (now - this.lastFireStopTime) / this.cooldownDuration;
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(this.x, this.y - this.size * 0.5, this.size * 0.8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = '#00e5ff';
            ctx.beginPath();
            ctx.arc(this.x, this.y - this.size * 0.5, this.size * 0.8, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * cooldownProgress));
            ctx.stroke();
            ctx.restore();
        }
        if (this.isFiring && this.laserTarget) {
            ctx.save();
            const laserWidth = Math.sin(Date.now() / 50) * 2 + 4;
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = laserWidth;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff4500';
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.laserTarget.x, this.laserTarget.y);
            ctx.stroke();
            ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = '#ffcc00'; 
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.size, this.y + this.size * 2);
        ctx.lineTo(this.x + this.size, this.y + this.size * 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y + this.size * 0.8, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    update(game, dt) {
        if (this.isRetreating) {
            this.y -= 1 * 60 * dt;
            if (this.isFiring) {
                audioManager.stopLoopingSound('laseringSound');
                this.isFiring = false;
            }
            return;
        }

        if (this.isStunned) {
            this.stunTimer -= dt;
            if (this.isFiring) {
                audioManager.stopLoopingSound('laseringSound');
                this.isFiring = false;
            }
            if (this.stunTimer <= 0) this.isStunned = false;
            return;
        }

        this.x = canvas.width / 2;
        const now = Date.now();
        const isOnCooldown = now - this.lastFireStopTime < this.cooldownDuration;
        let wasFiring = this.isFiring;
        if (this.isFiring) {
            if (now - (this.lastFireStopTime + this.cooldownDuration) > this.fireDuration) {
                this.isFiring = false;
                this.laserTarget = null;
                this.lastFireStopTime = now;
            }
        } else if (!isOnCooldown) {
            this.isFiring = true;
            this.lastFireStopTime = now - this.cooldownDuration;
        }
        if (this.isFiring && !wasFiring) {
            audioManager.playLoopingSound('laseringSound', 0.6);
        } else if (!this.isFiring && wasFiring) {
            audioManager.stopLoopingSound('laseringSound');
        }
        if (this.isFiring) {
            let bestTarget = null;

            // PRIORITY TARGETING FOR LASER ALLY
            // Mini-Behemoth > Stunner > Legion Gate (Elite) > Monolith
            
            const miniBehemoth = game.asteroids.find(a => a.type === 'mini_behemoth');
            if (miniBehemoth) {
                bestTarget = miniBehemoth;
            }

            if (!bestTarget) {
                const stunners = game.asteroids.filter(a => a.type === 'stunner');
                if (stunners.length > 0) {
                     // Pick closest stunner
                    let minDistance = Infinity;
                    for (const stunner of stunners) {
                        const distance = Math.hypot(this.x - stunner.x, this.y - stunner.y);
                        if (distance < minDistance) {
                            minDistance = distance;
                            bestTarget = stunner;
                        }
                    }
                }
            }
            
            if (!bestTarget) {
                // Elite (Legion Gate)
                const elites = game.asteroids.filter(a => a.isElite);
                if (elites.length > 0) {
                    // Closest elite
                    let minDistance = Infinity;
                    for (const elite of elites) {
                        const distance = Math.hypot(this.x - elite.x, this.y - elite.y);
                        if (distance < minDistance) {
                            minDistance = distance;
                            bestTarget = elite;
                        }
                    }
                }
            }

            if (!bestTarget) {
                if (game.isFinalBossActive && game.finalBoss) {
                    bestTarget = game.finalBoss;
                } else if (game.isBossActive) {
                    // Target mini-bosses (like BehemothTurret)
                    bestTarget = game.asteroids.find(a => a.isBoss);
                }

                if (!bestTarget) {
                    let minDistance = Infinity;
                    for (const asteroid of game.asteroids) {
                        const distance = Math.hypot(this.x - asteroid.x, this.y - asteroid.y);
                        if (distance < minDistance) {
                            minDistance = distance;
                            bestTarget = asteroid;
                        }
                    }
                }
            }

            if (bestTarget) {
                this.laserTarget = { x: bestTarget.x, y: bestTarget.y };

                // Damage Logic
                // Tanker takes 50% damage from Laser Ally
                let damageMultiplier = 1;
                if (bestTarget.type === 'tanker') damageMultiplier = 0.5;

                // Void Mode Global Buff: x2 Damage (Starts at 100s+ Void Time - Standard Void Mode, unrelated to Behemoth defeat)
                if (game.finalBossDefeated && game.getVoidTime() >= 100) damageMultiplier *= 2;

                bestTarget.health -= this.laserDamage * dt * damageMultiplier;
            } else {
                this.laserTarget = null;
            }
        }
    }
    applyUpgrades(game) {
        const damageLevels = [20, 25, 32, 40, 50, 65]; 
        const cooldownLevels = [15000, 14000, 13000, 11500, 10000, 8000];
        this.laserDamage = damageLevels[game.allyUpgrades.laserDamageLevel];
        this.cooldownDuration = cooldownLevels[game.allyUpgrades.laserCooldownLevel];
    }
}

export class EchoAlly {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height - 100; // Start higher
        this.size = 15;
        this.floatTimer = 0; // For sine wave animation
        this.isStunned = false;
        this.stunTimer = 0;
    }

    draw(game) {
        if (!game.player || game.player.isDestroyed) return;

        ctx.save();
        ctx.globalAlpha = 0.4; // Ghostly transparent
        if (this.isStunned) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#555'; // Grey when stunned
        } else {
            // Use player's rotation logic for the ghost
            if (game && game.isAimUnlocked && game.mousePos) {
                 const angle = Math.atan2(game.mousePos.y - this.y, game.mousePos.x - this.x);
                 ctx.translate(this.x, this.y);
                 ctx.rotate(angle + Math.PI / 2);
                 ctx.translate(-this.x, -this.y);
            }
            ctx.fillStyle = '#00ffff'; // Cyan Ghost
        }

        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.size * 2.2);
        ctx.lineTo(this.x - this.size * 0.6, this.y + this.size * 1.8);
        ctx.lineTo(this.x + this.size * 0.6, this.y + this.size * 1.8);
        ctx.closePath();
        ctx.fill();

        if (!this.isStunned) ctx.fillStyle = '#aaddff';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.size, this.y + this.size * 2);
        ctx.lineTo(this.x, this.y + this.size * 1.5);
        ctx.lineTo(this.x + this.size, this.y + this.size * 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    update(game, dt) {
        if (this.isStunned) {
             this.stunTimer -= dt;
             if (this.stunTimer <= 0) this.isStunned = false;
        }

        if (game.player && !game.player.isDestroyed) {
            this.floatTimer += dt;
            
            // GHOSTLY DRIFT LOGIC
            // Side to side movement (30px wide sine wave)
            const floatX = Math.sin(this.floatTimer * 2) * 30; 
            // Slight up and down hover (10px height)
            const floatY = Math.sin(this.floatTimer * 4) * 10; 

            // Target is ABOVE player now (-60px)
            const targetX = game.player.x + floatX;
            const targetY = game.player.y - 60 + floatY; 
            
            // Smoothly move towards target (Lower lerp factor = more drift/delay)
            this.x += (targetX - this.x) * 3 * dt;
            this.y += (targetY - this.y) * 3 * dt;
        }
    }
}

export class VampAlly {
    constructor() {
        this.size = 15;
        this.x = canvas.width / 2;
        this.y = canvas.height - 70;
        this.floatTimer = 0;
        this.damage = 1;
        this.isFiring = false;
        this.beamTarget = null;
        this.isRetreating = false;
    }

    draw(game) {
        if (!game.player || game.player.isDestroyed || this.isRetreating) return;

        ctx.save();
        // Visuals: Crimson red drone
        ctx.fillStyle = '#dc143c'; // Crimson
        
        // Hover effect
        const yOffset = Math.sin(this.floatTimer * 3) * 5;
        const xOffset = Math.cos(this.floatTimer * 2) * 30;
        
        const drawX = game.player.x + xOffset - 40; // Left side of player
        const drawY = game.player.y - 40 + yOffset;
        
        this.x = drawX;
        this.y = drawY;

        ctx.translate(drawX, drawY);
        
        // Drone Body
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = 'red';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();

        // Beam
        if (this.isFiring && this.beamTarget) {
            ctx.save();
            ctx.strokeStyle = `rgba(220, 20, 60, ${0.5 + Math.sin(Date.now() / 50) * 0.5})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.beamTarget.x, this.beamTarget.y);
            ctx.stroke();

            // Siphon particles moving back
            const dist = Math.hypot(this.beamTarget.x - this.x, this.beamTarget.y - this.y);
            const particleCount = 3;
            for (let i = 0; i < particleCount; i++) {
                const t = ((Date.now() / 500) + (i / particleCount)) % 1;
                const px = this.beamTarget.x + (this.x - this.beamTarget.x) * t;
                const py = this.beamTarget.y + (this.y - this.beamTarget.y) * t;
                ctx.fillStyle = '#00ff00'; // Green healing energy
                ctx.beginPath();
                ctx.arc(px, py, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    update(game, dt) {
        if (this.isRetreating) return;
        
        this.floatTimer += dt;

        // Auto Attack Logic
        // Target closest enemy
        let bestTarget = null;
        let minDistance = 300; // Range

        for (const asteroid of game.asteroids) {
             const dist = Math.hypot(this.x - asteroid.x, this.y - asteroid.y);
             if (dist < minDistance) {
                 minDistance = dist;
                 bestTarget = asteroid;
             }
        }

        if (bestTarget) {
            this.isFiring = true;
            this.beamTarget = bestTarget;
            // Siphon Damage (Low but constant)
            bestTarget.health -= this.damage * 10 * dt; 
        } else {
            this.isFiring = false;
            this.beamTarget = null;
        }
    }
}

export class Coolant {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 10;
        this.vy = 2;
        this.color = '#00ffff'; // Cyan
    }

    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner detail
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("❄", this.x, this.y + 4);
        
        ctx.restore();
    }

    update(dt) {
        this.y += this.vy * 60 * dt;
    }
}

export class StaticMine {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 8;
        this.timer = 0;
    }
    
    draw() {
        ctx.save();
        ctx.fillStyle = 'red';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'red';
        const scale = 1 + Math.sin(this.timer) * 0.3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    update(dt) {
        this.timer += 5 * dt;
    }
}

export class BehemothBomb {
    constructor(x, y, targetX, targetY) {
        this.x = x;
        this.y = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.size = 20;
        this.speed = 1.5;
        this.color = '#ff4500';
        this.isExploding = false;
        this.explosionRadius = 150;
        this.explodeTimer = 0;
    }

    draw() {
        if (this.isExploding) {
            ctx.save();
            ctx.fillStyle = `rgba(255, 69, 0, ${0.5 + Math.sin(Date.now() / 50) * 0.5})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.explosionRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            ctx.save();
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 20;
            ctx.shadowColor = 'red';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            // Pulse center
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 0.5 * (1 + Math.sin(Date.now() / 100) * 0.3), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    update(game, dt) {
        if (this.isExploding) {
            this.explodeTimer -= dt;
            if (this.explodeTimer <= 0) return true; // Signal to remove

            // Damage check (simple: if player in radius)
            const dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);
            if (dist < this.explosionRadius && !game.player.isDestroyed) {
                // Break shields instantly or kill
                if (game.player.shieldCharges > 0) {
                    game.player.shieldCharges = 0;
                    game.updateGameStatus("SHIELD BROKEN BY BOMB!");
                    game.screenShakeDuration = 20;
                } else {
                    game.handleGameOver("Obliterated by Behemoth Bomb!");
                }
            }
            return false;
        }

        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
            this.isExploding = true;
            this.explodeTimer = 1; // Lasts 1s
            game.screenShakeDuration = 10;
            audioManager.playSound('finalbossExplosion');
        } else {
            this.x += (dx / dist) * this.speed * 60 * dt;
            this.y += (dy / dist) * this.speed * 60 * dt;
        }
        return false;
    }
}

export class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 3 + 1;
        this.vx = Math.random() * 4 - 2;
        this.vy = Math.random() * 4 - 2;
        this.color = color;
        this.maxLife = Math.random() * 40 + 20;
        this.life = this.maxLife;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update(game, dt) {
        const moveFactor = 60 * dt;
        this.x += this.vx * moveFactor;
        this.y += this.vy * moveFactor;
        this.life--;
    }
}