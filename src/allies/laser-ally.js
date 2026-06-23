import { canvas, ctx } from "../ui.js";
import { audioManager } from "../audio.js";
import { CONFIG } from "../config.js";
import { Player } from '../entities/player.js';

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

        // CONFUSION LOGIC
        if (this.isConfused) {
             this.confusedTimer -= dt;
             if (this.confusedTimer <= 0) this.isConfused = false;
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
            
            if (this.isConfused) {
                 // Target a random spot (simulating "useless target")
                 // E.g. a point in empty space or the corner
                 this.laserTarget = { 
                     x: (Math.random() > 0.5 ? 0 : canvas.width), 
                     y: canvas.height / 2 
                 };
                 return; // Skip normal targeting
            }

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
