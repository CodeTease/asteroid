import { canvas, ctx } from "../../ui.js";
import { audioManager } from "../../audio.js";
import { CONFIG } from "../../config.js";
import { Asteroid } from '../basic/asteroid.js';
import { BehemothBomb } from '../basic/static-mine.js';

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
                    game.enemyProjectiles.push(game.projectilePool.get({ x: this.x - this.size - 10, y: this.y + 20, vx: vxL, vy: vyL, color: 'orange', size: 6 }));

                    // Right Gun Aim
                    const angleR = Math.atan2(game.player.y - (this.y + 20), game.player.x - (this.x + this.size + 10));
                    const vxR = Math.cos(angleR) * speed;
                    const vyR = Math.sin(angleR) * speed;
                    game.enemyProjectiles.push(game.projectilePool.get({ x: this.x + this.size + 10, y: this.y + 20, vx: vxR, vy: vyR, color: 'orange', size: 6 }));
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
                 game.enemyProjectiles.push(game.projectilePool.get({
                     x: this.x, y: this.y,
                     vx: Math.cos(angle) * speed,
                     vy: Math.sin(angle) * speed,
                     color: 'orange',
                     size: 5
                 }));
             }
        }
    }
}
