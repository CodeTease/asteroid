import { canvas, ctx } from "../ui.js";
import { audioManager } from "../audio.js";
import { CONFIG } from "../config.js";
import { Asteroid } from '../enemies/basic/asteroid.js';

export class SolidDecoy extends Asteroid {
    constructor(game, x, y, boss) {
        super(game, { type: 'breacher', isBoss: false });
        this.type = 'solid_decoy';
        this.x = x;
        this.y = y;
        this.boss = boss;
        this.color = 'rgba(0, 255, 255, 0.3)';
        this.size = 40;
        this.health = 30; 
        this.maxHealth = 30;
    }

    update(game, dt) {
        // Die if boss unavailable or shattered
        if (!this.boss || this.boss.health <= 0 || !game.asteroids.includes(this.boss) || this.boss.state === 'shattered' || this.boss.state === 'rewind') {
             this.health = 0;
             game.createExplosion(this.x, this.y, this.color, 10);
             return;
        }

        // Mirror Boss State
        if (this.boss.state === 'dash' || this.boss.state === 'rewind') {
             // Move parallel to boss
             this.x += this.boss.dashVelocity.x * 60 * dt;
             this.y += this.boss.dashVelocity.y * 60 * dt;
        } else if (this.boss.state === 'lock') {
             // Jitter
             this.x += (Math.random() - 0.5) * 5;
             this.y += (Math.random() - 0.5) * 5;
        }

        // Standard Asteroid update (collisions etc)
        // Check bounds?
        if (this.y > canvas.height + 50 || this.x < -50 || this.x > canvas.width + 50) {
             this.health = 0;
        }
    }

    draw(game) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'cyan';
        
        // Shape matches AfterimageBoss
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size, 0);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
    }
}
