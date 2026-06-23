import { canvas, ctx } from "../ui.js";
import { audioManager } from "../audio.js";
import { CONFIG } from "../config.js";
import { Player } from '../entities/player.js';

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

        // CONFUSION LOGIC
        if (this.isConfused) {
             this.confusedTimer -= dt;
             if (this.confusedTimer <= 0) this.isConfused = false;
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
            if (this.isConfused) {
                // Shoot Randomly
                this.shootAt(game, null, true);
            } else if (bestTarget) {
                this.shootAt(game, bestTarget);
            }
            this.lastFireTime = Date.now();
        }
    }
    shootAt(game, target, isRandom = false) {
        audioManager.playSound('shoot', 0.2);
        
        let dx, dy, dist;
        
        if (isRandom) {
             const angle = Math.random() * Math.PI * 2;
             dx = Math.cos(angle);
             dy = Math.sin(angle);
             dist = 1;
        } else {
             dx = target.x - this.x;
             dy = target.y - this.y;
             dist = Math.hypot(dx, dy);
        }

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
            game.projectiles.push(game.projectilePool.get({ x: this.x, y: this.y, ...projectileOptions, vx: vx1, vy: vy1 }));
            game.projectiles.push(game.projectilePool.get({ x: this.x, y: this.y, ...projectileOptions, vx: vx2, vy: vy2 }));
        } else {
            const vx = (dx / dist) * speed;
            const vy = (dy / dist) * speed;
            game.projectiles.push(game.projectilePool.get({ x: this.x, y: this.y, ...projectileOptions, vx, vy }));
        }
    }
}
