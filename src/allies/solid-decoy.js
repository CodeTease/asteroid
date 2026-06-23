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
        // Sync color with boss enraged state
        this.color = (boss && boss.enraged) ? '#FF0000' : 'rgba(0, 255, 255, 0.3)';
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
        // Glitch shake – matches Boss visual
        const shakeX = Math.random() * 4 - 2;
        const shakeY = Math.random() * 4 - 2;

        ctx.save();
        ctx.translate(this.x, this.y);
        // No globalAlpha – fully opaque like Boss
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = (this.boss && this.boss.enraged) ? '#FF0000' : 'cyan';
        
        // Shape matches AfterimageBoss (with glitch offset)
        ctx.beginPath();
        ctx.moveTo(0 + shakeX, -this.size + shakeY);
        ctx.lineTo(this.size + shakeX, 0 + shakeY);
        ctx.lineTo(0 + shakeX, this.size + shakeY);
        ctx.lineTo(-this.size + shakeX, 0 + shakeY);
        ctx.closePath();
        ctx.fill();

        // Inner Eye (matching Boss)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(shakeX, shakeY, 10, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}
