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
        this.isDestroyed = false;
        this.shieldCharges = 0;
        
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

        // Heat Decay
        if (!this.isOverheated && this.heat > 0) {
            this.heat -= 40 * dt; // Decay speed
            if (this.heat < 0) this.heat = 0;
        }
    }

    shoot(game) {
        if (game.isGameOver || game.isPaused || this.isOverheated) return;

        // Heat Build-up
        if (game.isAimUnlocked) {
            this.heat += 10;
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

        let vx = 0;
        let vy = -8;

        if (game.isAimUnlocked && game.mousePos) {
            const dx = game.mousePos.x - this.x;
            const dy = game.mousePos.y - this.y;
            const dist = Math.hypot(dx, dy);
            const speed = 10;
            vx = (dx / dist) * speed;
            vy = (dy / dist) * speed;
        }

        if (this.fireRate === 2) {
             if (game.isAimUnlocked) {
                 game.projectiles.push(new Projectile(this.x, this.y, { size: this.projectileSize, damage: this.projectileDamage, vx: vx + 1, vy: vy }));
                 game.projectiles.push(new Projectile(this.x, this.y, { size: this.projectileSize, damage: this.projectileDamage, vx: vx - 1, vy: vy }));
             } else {
                game.projectiles.push(new Projectile(this.x - 7, this.y, { size: this.projectileSize, damage: this.projectileDamage }));
                game.projectiles.push(new Projectile(this.x + 7, this.y, { size: this.projectileSize, damage: this.projectileDamage }));
             }
        } else {
            game.projectiles.push(new Projectile(this.x, this.y, { size: this.projectileSize, damage: this.projectileDamage, vx, vy }));
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
        this.isHoming = options.isHoming ?? false;
        this.target = null;
        this.homingSpeed = 14; // Faster
        this.turnRate = 8.0; // SUPER SHARP TURNING (Was 2.0)
        
        // LIFESPAN OPTIMIZATION
        // Only homing missiles expire to prevent lag
        this.lifespan = this.isHoming ? 120 : -1; // ~2 seconds at 60fps
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        
        if (this.isHoming) {
             // Fade out when dying
             if (this.lifespan < 20) ctx.globalAlpha = this.lifespan / 20;
             
             ctx.beginPath();
             ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
             ctx.fill();
             
             // Simple Trail
             ctx.fillStyle = `rgba(229, 0, 255, 0.3)`;
             ctx.beginPath();
             ctx.arc(this.x - this.vx * 0.2, this.y - this.vy * 0.2, this.size * 0.8, 0, Math.PI * 2);
             ctx.fill();
             
             ctx.globalAlpha = 1.0; // Reset
        } else {
            ctx.fillRect(this.x - this.size / 2, this.y, this.size, this.size * 2);
        }
        ctx.shadowBlur = 0;
    }

    update(game, dt) {
        const moveFactor = 60 * dt;
        
        if (this.isHoming) {
            this.lifespan -= moveFactor;

            // Find Target Logic - only if we don't have one or it died
            if (!this.target || this.target.health <= 0) {
                 let minDist = 400; // Only look for targets within range to save perf
                 this.target = null;
                 
                 for (const a of game.asteroids) {
                     if (a.health > 0) {
                        const dist = Math.hypot(this.x - a.x, this.y - a.y);
                        if(dist < minDist) {
                            minDist = dist;
                            this.target = a;
                        }
                     }
                 }
            }
            
            // Homing Logic
            if (this.target) {
                const dx = this.target.x - this.x;
                const dy = this.target.y - this.y;
                const dist = Math.hypot(dx, dy);
                
                if (dist > 0) {
                    const targetVx = (dx / dist) * this.homingSpeed;
                    const targetVy = (dy / dist) * this.homingSpeed;

                    // Much stronger steering
                    this.vx += (targetVx - this.vx) * this.turnRate * dt;
                    this.vy += (targetVy - this.vy) * this.turnRate * dt;

                    // Cap speed strictly
                    const newSpeed = Math.hypot(this.vx, this.vy);
                    if (newSpeed > 0) {
                        this.vx = (this.vx / newSpeed) * this.homingSpeed;
                        this.vy = (this.vy / newSpeed) * this.homingSpeed;
                    }
                }
            }
        }

        this.x += this.vx * moveFactor;
        this.y += this.vy * moveFactor;
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
        ctx.fillStyle = '#007bff';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.size, this.y + this.size * 2);
        ctx.lineTo(this.x + this.size, this.y + this.size * 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    update(game, dt) {
        if (this.isRetreating) {
            this.y -= this.speed * 60 * dt;
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
            if (game.isFinalBossActive && game.finalBoss) {
                 bestTarget = game.finalBoss;
            } else if (game.isBossActive) {
                bestTarget = game.asteroids.find(a => a.isBoss) ?? null;
            } else {
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
        const projectileOptions = { size: this.projectileSize, damage: this.projectileDamage };
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
            if (game.isFinalBossActive && game.finalBoss) {
                bestTarget = game.finalBoss;
            } else {
                let minDistance = Infinity;
                for (const asteroid of game.asteroids) {
                    const distance = Math.hypot(this.x - asteroid.x, this.y - asteroid.y);
                    if (distance < minDistance) {
                        minDistance = distance;
                        bestTarget = asteroid;
                    }
                }
            }
            if (bestTarget) {
                this.laserTarget = { x: bestTarget.x, y: bestTarget.y };
                bestTarget.health -= this.laserDamage * dt;
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

// --- NEW POST-BOSS CLASSES ---

export class PrismAlly {
    constructor(game) {
        this.x = canvas.width / 2;
        this.y = canvas.height - 100;
        this.size = 20;
        this.angle = 0;
        this.pulse = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Dynamic Glow
        const glow = 15 + this.pulse * 10;
        ctx.shadowBlur = glow;
        ctx.shadowColor = '#e500ff';
        ctx.fillStyle = `rgba(229, 0, 255, ${0.5 + this.pulse * 0.5})`;
        ctx.strokeStyle = '#e500ff';
        ctx.lineWidth = 2 + this.pulse * 2;

        // Draw Diamond Shape
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    update(game, dt) {
        this.angle += 0.02;
        if (this.pulse > 0) this.pulse -= 0.1 * 60 * dt;
        if (this.pulse < 0) this.pulse = 0;

        // Follow player loosely
        if(game.player && !game.player.isDestroyed) {
            const targetX = game.player.x + 50; // Fly slightly to the right
            this.x += (targetX - this.x) * 2 * dt;
            this.y = game.player.y - 30;
        }
    }
    
    // Call when hit by player bullet
    onHit() {
        this.pulse = 1;
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

export class Asteroid {
    constructor(game, options = {}) {
        this.isBoss = options.isBoss ?? false;
        this.x = options.x ?? Math.random() * canvas.width;
        this.y = options.y ?? -50;
        this.vx = 0;
        this.fireCooldown = 2000;
        this.lastFireTime = Date.now();
        
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

        const healthMultiplier = game.gameTime >= 200 ? 2 : 1;

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

        this.shape = [];
        const sides = 8;
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            this.shape.push({ x: Math.cos(angle) * this.size, y: Math.sin(angle) * this.size });
        }
    }

    draw(game) {
        ctx.save();
        ctx.fillStyle = this.color;
        
        // Effects
        if (this.type === 'teleporter' && Date.now() - this.lastTeleportTime > this.teleportCooldown - 500) {
             if (Math.floor(Date.now() / 100) % 2 === 0) ctx.globalAlpha = 0.5;
        }

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + this.shape[0].x, this.y + this.shape[0].y);
        for (let i = 1; i < this.shape.length; i++) {
            ctx.lineTo(this.x + this.shape[i].x, this.y + this.shape[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

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
        
        // Health Text
        if (this.health > 1) {
            ctx.fillStyle = 'white';
            ctx.font = '14px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(Math.ceil(this.health).toString(), this.x, this.y + 5);
        }
    }

    update(game, dt) {
        const moveFactor = 60 * dt;
        
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