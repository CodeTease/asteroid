import { Game } from "./game.js";
import { canvas, ctx } from "./ui.js";
import { audioManager } from "./audio.js";

// --- GAME CLASSES ---

export class Player {
    x: number; y: number; size: number; speed: number;
    projectileSize: number; projectileDamage: number; fireRate: number;
    alpha: number; allies: AIAlly[]; lastX: number; isDestroyed: boolean;
    shieldCharges: number;

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
    }

    draw() {
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

        const engineGlow = Math.random() * 0.3 + 0.7;
        ctx.fillStyle = `rgba(0, 229, 255, ${engineGlow})`;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.size * 2.2);
        ctx.lineTo(this.x - this.size * 0.6, this.y + this.size * 1.8);
        ctx.lineTo(this.x + this.size * 0.6, this.y + this.size * 1.8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#cccccc';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.size, this.y + this.size * 2);
        ctx.lineTo(this.x, this.y + this.size * 1.5);
        ctx.lineTo(this.x + this.size, this.y + this.size * 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    update(game: Game, dt: number) {
        const moveSpeed = this.speed * 60 * dt;
        if ((game.keys['ArrowLeft'] || game.keys['a']) && this.x > this.size) this.x -= moveSpeed;
        if ((game.keys['ArrowRight'] || game.keys['d']) && this.x < canvas.width - this.size) this.x += moveSpeed;
    }

    shoot(game: Game) {
        if (game.isGameOver || game.isPaused) return;
        audioManager.playSound('shoot', 0.5);
        if (this.fireRate === 2) {
            game.projectiles.push(new Projectile(this.x - 7, this.y, { size: this.projectileSize, damage: this.projectileDamage }));
            game.projectiles.push(new Projectile(this.x + 7, this.y, { size: this.projectileSize, damage: this.projectileDamage }));
        } else {
            game.projectiles.push(new Projectile(this.x, this.y, { size: this.projectileSize, damage: this.projectileDamage }));
        }
    }
}

export class Projectile {
    x: number; y: number; size: number; damage: number;
    vx: number; vy: number; color: string;
    constructor(x: number, y: number, options: { size?: number, damage?: number, vx?: number, vy?: number, color?: string } = {}) {
        this.x = x;
        this.y = y;
        this.size = options.size ?? 5;
        this.damage = options.damage ?? 1;
        this.vx = options.vx ?? 0;
        this.vy = options.vy ?? -8;
        this.color = options.color ?? '#00ffff';
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y, this.size, this.size * 2);
        ctx.shadowBlur = 0;
    }

    update(game: Game, dt: number) {
        const moveFactor = 60 * dt;
        this.x += this.vx * moveFactor;
        this.y += this.vy * moveFactor;
    }
}

export class AIAlly extends Player {
    side: 'left' | 'right'; fireCooldown: number; lastFireTime: number; isRetreating: boolean;
    constructor(side: 'left' | 'right') {
        super();
        this.side = side;
        this.size *= 0.7;
        this.speed = 1; // Retreat speed
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

    update(game: Game, dt: number) {
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
            let bestTarget: Asteroid | FinalBoss | null = null;

            if (game.isFinalBossActive && game.finalBoss) {
                const miniBosses = game.asteroids.filter(a => a.isBoss && a !== game.finalBoss);
                if (miniBosses.length > 0) {
                    bestTarget = miniBosses[0];
                } else {
                    bestTarget = game.finalBoss;
                }
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

    shootAt(game: Game, target: Asteroid | FinalBoss) {
        audioManager.playSound('shoot', 0.2);
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);
        const baseSpeed = 8;
        const speed = game.allyUpgrades.hasFasterProjectiles ? baseSpeed * 1.5 : baseSpeed;
        const projectileOptions: { size: number, damage: number, vx?: number, vy?: number } = { size: this.projectileSize, damage: this.projectileDamage };

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
    isRetreating: boolean; isFiring: boolean;
    laserTarget: { x: number, y: number } | null;
    lastFireStopTime: number; fireDuration: number; cooldownDuration: number;
    laserDamage: number; // Now represents Damage Per Second

    constructor() {
        super();
        this.size *= 2; // Much larger
        this.x = canvas.width / 2;
        this.y = canvas.height - 70;
        this.isRetreating = false;
        this.isFiring = false;
        this.laserTarget = null;
        this.fireDuration = 10000; // 10s
        this.lastFireStopTime = 0;
        this.cooldownDuration = 15000; // 15s
        this.laserDamage = 20; // Initial Damage Per Second
    }

    draw() {
        if (this.y < -this.size * 2) return;

        // Draw Cooldown Indicator
        const now = Date.now();
        const isOnCooldown = now - this.lastFireStopTime < this.cooldownDuration;
        if (isOnCooldown && !this.isFiring) {
            ctx.save();
            const cooldownProgress = (now - this.lastFireStopTime) / this.cooldownDuration;
            const indicatorRadius = this.size * 0.8;
            const indicatorX = this.x;
            const indicatorY = this.y - this.size * 0.5;

            // Background
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(indicatorX, indicatorY, indicatorRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Progress
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(indicatorX, indicatorY, indicatorRadius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * cooldownProgress));
            ctx.stroke();
            ctx.restore();
        }

        // Draw Laser
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

        // Draw Ship
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = '#ffcc00'; // Gold color
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.size, this.y + this.size * 2);
        ctx.lineTo(this.x + this.size, this.y + this.size * 2);
        ctx.closePath();
        ctx.fill();

        // Cockpit
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y + this.size * 0.8, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update(game: Game, dt: number) {
        if (this.isRetreating) {
            this.y -= 1 * 60 * dt;
            if (this.isFiring) {
                audioManager.stopLoopingSound('laseringSound');
                this.isFiring = false;
            }
            return;
        }

        this.x = canvas.width / 2; // Keep it centered

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
            let bestTarget: Asteroid | FinalBoss | null = null;
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

    applyUpgrades(game: Game) {
        const damageLevels = [20, 25, 32, 40, 50, 65]; // Damage Per Second
        const cooldownLevels = [15000, 14000, 13000, 11500, 10000, 8000];
        this.laserDamage = damageLevels[game.allyUpgrades.laserDamageLevel];
        this.cooldownDuration = cooldownLevels[game.allyUpgrades.laserCooldownLevel];
    }
}

export type AsteroidType = 'standard' | 'scout' | 'brute' | 'shard' | 'shooter' | 'splitter' | 'boss';

interface AsteroidOptions {
    isBoss?: boolean;
    type?: AsteroidType;
    x?: number;
    y?: number;
    size?: number;
    healthOverride?: number;
}

export class Asteroid {
    isBoss: boolean; type: AsteroidType; x: number; y: number; vx: number; speed: number;
    size: number; health: number; color: string; shape: { x: number, y: number }[];
    fireCooldown: number; lastFireTime: number;

    constructor(game: Game, options: AsteroidOptions = {}) {
        this.isBoss = options.isBoss ?? false;
        this.x = options.x ?? Math.random() * canvas.width;
        this.y = options.y ?? -50;
        this.vx = 0;
        this.fireCooldown = 2000;
        this.lastFireTime = Date.now();

        if (this.isBoss) {
            this.type = 'boss';
        } else if (options.type) {
            this.type = options.type;
        } else {
            const rand = Math.random();
            if (rand < 0.1) this.type = 'scout';
            else if (rand < 0.2) this.type = 'brute';
            else if (rand < 0.3) this.type = 'shard';
            else if (rand < 0.4) this.type = 'shooter';
            else if (rand < 0.5) this.type = 'splitter';
            else this.type = 'standard';
        }

        const healthMultiplier = game.gameTime >= 200 ? 2 : 1;

        switch (this.type) {
            case 'boss':
                this.size = 60;
                this.speed = 0.8;
                this.health = options.healthOverride ?? (50 * healthMultiplier);
                this.color = '#ff4500';
                break;
            case 'scout':
                this.size = 12;
                this.speed = Math.random() * 2 + 2.5;
                this.health = 1 * healthMultiplier;
                this.color = '#add8e6';
                break;
            case 'brute':
                this.size = 35;
                this.speed = Math.random() * 1 + 0.8;
                this.health = 2 * healthMultiplier;
                this.color = '#d2b48c';
                break;
            case 'shard':
                this.size = 20;
                this.speed = Math.random() * 1.5 + 1;
                this.health = 1 * healthMultiplier;
                this.color = '#dda0dd';
                this.vx = (Math.random() - 0.5) * 2;
                break;
            case 'shooter':
                this.size = 25;
                this.speed = Math.random() * 1 + 1;
                this.health = 2 * healthMultiplier;
                this.color = '#9400d3';
                break;
            case 'splitter':
                this.size = 30;
                this.speed = Math.random() * 1 + 1;
                this.health = 1 * healthMultiplier;
                this.color = '#ff8c00';
                break;
            case 'standard':
            default:
                this.size = options.size ?? (Math.random() * 20 + 15);
                this.speed = Math.random() * 2 + 1;
                this.health = 1 * healthMultiplier;
                this.color = '#a9a9a9';
                break;
        }

        this.shape = [];
        const sides = this.type === 'shard' || this.type === 'shooter' ? 5 : Math.floor(Math.random() * 3) + 7;
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const radius = this.size * (this.type === 'shard' || this.type === 'shooter' ? (i % 2 === 0 ? 1 : 0.5) * (Math.random() * 0.2 + 0.9) : (Math.random() * 0.4 + 0.8));
            this.shape.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
        }
    }

    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
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
        ctx.restore();
        if (this.isBoss || this.type === 'brute' || this.type === 'shooter') {
            ctx.fillStyle = 'white';
            ctx.font = '14px Orbitron';
            ctx.textAlign = 'center';
            ctx.fillText(Math.ceil(this.health).toString(), this.x, this.y + 5);
        }
    }
    update(game: Game, dt: number) {
        const moveFactor = 60 * dt;
        this.y += this.speed * moveFactor;
        this.x += this.vx * moveFactor;
        if (this.x < this.size || this.x > canvas.width - this.size) {
            this.vx *= -1;
        }

        if (this.type === 'shooter' && game.player && !game.isGameOver && Date.now() - this.lastFireTime > this.fireCooldown) {
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

type FinalBossAttack = 'barrage' | 'dash' | 'summonMinions' | 'summonCommanders';

export class FinalBoss extends Asteroid {
    maxHealth: number; currentAttack: FinalBossAttack; attackCooldown: number; lastAttackTime: number;
    dashTarget: { x: number, y: number } | null; isWarning: boolean; warningTime: number;
    isDefeated: boolean; isReturning: boolean; initialY: number; isEntering: boolean;

    constructor(game: Game) {
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
        super.draw();
    }

    update(game: Game, dt: number) {
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

    chooseAndPerformAttack(game: Game) {
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

    performAttack(game: Game, attack: FinalBossAttack) {
        switch (attack) {
            case 'summonMinions':
                game.updateGameStatus('Boss triệu hồi quái!');
                for (let i = 0; i < 5; i++) {
                    game.asteroids.push(new Asteroid(game, { x: this.x + (Math.random() - 0.5) * 100, y: this.y }));
                }
                break;
            case 'summonCommanders':
                game.updateGameStatus('Boss triệu hồi chỉ huy!');
                game.asteroids.push(new Asteroid(game, { isBoss: true, x: this.x - 100, y: this.y, healthOverride: 50 }));
                game.asteroids.push(new Asteroid(game, { isBoss: true, x: this.x + 100, y: this.y, healthOverride: 50 }));
                break;
            case 'dash':
                game.updateGameStatus('Boss sắp lao tới!');
                this.dashTarget = {
                    x: game.player.x + (Math.random() - 0.5) * 150,
                    y: game.player.y - (Math.random() * 100 + 50)
                };
                this.isWarning = true;
                this.warningTime = Date.now();
                break;
            case 'barrage':
                game.updateGameStatus('Boss bắn đạn!');
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
    x: number; y: number; vx: number; vy: number; radius: number;
    color: string; life: number; maxLife: number;
    constructor(x: number, y: number, color: string) {
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

    update(game: Game, dt: number) {
        const moveFactor = 60 * dt;
        this.x += this.vx * moveFactor;
        this.y += this.vy * moveFactor;
        this.life--;
    }
}