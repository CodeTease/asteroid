import { canvas, ctx } from "../../ui.js";
import { audioManager } from "../../audio.js";
import { CONFIG } from "../../config.js";
import { StaticMine } from "./static-mine.js";

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

        let healthMultiplier = game.gameTime >= CONFIG.ENEMIES.BASE_MULTIPLIER_TIME_THRESHOLD ? 2 : 1;
        // VOID MODE EXTENDED BUFF (Global x1.5 HP for ALL enemies after Behemoth Defeated)
        if (game.behemothDefeated) {
            healthMultiplier *= CONFIG.ENEMIES.VOID_MODE_HP_MULTIPLIER;
        }

        if (this.isElite) {
            healthMultiplier *= CONFIG.ENEMIES.ELITE_HP_MULTIPLIER; // Elite x2 HP
        }

        const stats = CONFIG.ENEMIES.STATS[this.type] || CONFIG.ENEMIES.STATS.standard;

        // Apply Stats from Config (preserving existing logic for overrides and some randomness)
        // If specific logic is needed per type (like custom movement code), it remains in update() or here.
        
        if (this.type === 'boss') {
            this.size = stats.size;
            this.speed = stats.speed;
            this.health = options.healthOverride ?? (stats.hp * healthMultiplier);
            this.color = stats.color;
        } else if (this.type === 'standard') {
             this.size = options.size ?? (Math.random() * 20 + 15);
             this.speed = Math.random() * 2 + 1;
             this.health = stats.hp * healthMultiplier;
             this.color = stats.color;
        } else if (['scout', 'brute', 'shard', 'shooter', 'splitter', 'seeker'].includes(this.type)) {
             // Retain randomness for standard enemies
             this.size = stats.size;
             this.health = stats.hp * healthMultiplier;
             this.color = stats.color;
             
             if (this.type === 'scout') this.speed = Math.random() * 2 + 2.5;
             else if (this.type === 'brute') this.speed = Math.random() * 1 + 0.8;
             else if (this.type === 'shard') { this.speed = Math.random() * 1.5 + 1; this.vx = (Math.random() - 0.5) * 2; }
             else if (this.type === 'shooter') this.speed = Math.random() * 1 + 1;
             else if (this.type === 'splitter') this.speed = Math.random() * 1 + 1;
             else if (this.type === 'seeker') {
                  this.speed = stats.speed; 
                  if (game.player) { 
                      const dx = game.player.x - this.x; const dy = game.player.y - this.y; const dist = Math.hypot(dx, dy); this.vx = (dx / dist) * 2; 
                  }
             }
        } else {
             // Void Legion & Others - Use Config directly
             this.size = stats.size;
             this.speed = stats.speed;
             this.health = stats.hp * healthMultiplier;
             this.color = stats.color;
             
             if (this.type === 'teleporter') this.fireCooldown = 1500;
             if (this.type === 'juggler') this.pushRadius = 200;
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
             // Let's make it rush down but slightly towards player for lethality
             if (game.player) {
                  const dx = game.player.x - this.x;
                  this.x += (dx > 0 ? 1 : -1) * 0.5 * moveFactor;
             }
             return; // Skip other movement logic
        }

        if (game.isAbyssMode) {
             let target = null;
             if (game.player && !game.player.isDestroyed) {
                 const dx = game.player.x - this.x;
                 const dy = game.player.y - this.y;
                 const distToPlayer = Math.hypot(dx, dy);
                 if (distToPlayer <= CONFIG.ABYSS.AGGRO_RADIUS) {
                     target = game.player;
                 }
             }
             if (!target && game.mothership && game.mothership.health > 0) {
                 target = game.mothership;
             }
             
             if (target) {
                 const dx = target.x - this.x;
                 const dy = target.y - this.y;
                 const dist = Math.hypot(dx, dy);
                 if (dist > 0) {
                     // Mild avoidance of each other could be added later, for now just rush
                     this.x += (dx / dist) * this.speed * moveFactor;
                     this.y += (dy / dist) * this.speed * moveFactor;
                 }
             }
        } else {
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
        }

        // Shooting logic
        if ((this.type === 'shooter' || this.type === 'teleporter' || this.type === 'orbiter') && game.player && !game.isGameOver && Date.now() - this.lastFireTime > this.fireCooldown) {
            const dx = game.player.x - this.x;
            const dy = game.player.y - this.y;
            const dist = Math.hypot(dx, dy);
            const speed = 4;
            const vx = (dx / dist) * speed;
            const vy = (dy / dist) * speed;
            // Use Pool (note: enemyProjectiles logic in Game needs to handle release too, but typically they share the pool if generic)
            // Wait, we used 'projectilePool' in Game for PLAYER projectiles mostly? 
            // Game.projectilePool is generic. We can use it for enemies too if we ensure release.
            // But game.enemyProjectiles is a separate array.
            
            game.enemyProjectiles.push(game.projectilePool.get({ x: this.x, y: this.y, vx, vy, color: '#ff69b4', size: 4 }));
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
                 game.particles.push(game.particlePool.get({ x: this.x, y: this.y, color: '#ffff00' })); 

                 // Draw beam (hacky: create a fast temporary projectile or just draw in its draw method?)
                 // Let's create a special projectile that is just visual
                 game.enemyProjectiles.push(game.projectilePool.get({ x: this.x, y: this.y, vx: 0, vy: 0, color: 'transparent', size: 0 })); // dummy
                 // Actually, let's just use game.createExplosion for visual feedback on target
                 game.createExplosion(target.x, target.y, '#ffff00', 10);
                 game.updateGameStatus("Ally Stunned!");

                 this.lastFireTime = Date.now();
             }
        }
    }
}
