import { canvas, ctx } from "../../ui.js";
import { audioManager } from "../../audio.js";
import { CONFIG } from "../../config.js";
import { Asteroid } from '../basic/asteroid.js';

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
                    game.enemyProjectiles.push(game.projectilePool.get({ x: this.x, y: this.y, vx, vy, color: '#ff69b4', size: 5 }));
                }
                break;
        }
    }
}
