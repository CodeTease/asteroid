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
        
        // Sync color with boss enraged state, fully opaque like boss
        this.color = (boss && boss.enraged) ? '#FF0000' : '#00FFFF';
        this.size = 40;
        this._health = 30; 
        this.maxHealth = 30;

        // Custom independent velocity for the Ultimate Split clones
        const speed = (boss && boss.enraged) ? 40 : 25;
        const angle = Math.random() * Math.PI * 2;
        this.dashVelocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
    }

    get health() {
        return this._health;
    }

    set health(value) {
        if (typeof this._health === 'undefined') {
            this._health = value;
            return;
        }
        const damage = this._health - value;
        if (damage > 0 && this.boss && this.boss.health > 0 && value > 0) {
            // Apply 3x damage to the main boss instead of the clone
            this.boss.health -= damage * 3;
            return; // Ignore damage to clone health
        }
        this._health = value;
    }

    update(game, dt) {
        // Die if boss unavailable or shattered
        if (!this.boss || this.boss.health <= 0 || !game.asteroids.includes(this.boss) || this.boss.state === 'shattered' || this.boss.state === 'rewind') {
             this.health = 0;
             game.createExplosion(this.x, this.y, this.color, 10);
             return;
        }

        if (this.boss.hasSplit) {
             // Move independently
             this.x += this.dashVelocity.x * 60 * dt;
             this.y += this.dashVelocity.y * 60 * dt;

             // Bounce off canvas walls independently
             if ((this.x < this.size && this.dashVelocity.x < 0) || (this.x > canvas.width - this.size && this.dashVelocity.x > 0)) {
                 this.dashVelocity.x *= -1;
                 game.createExplosion(this.x, this.y, this.color, 10);
             }
             if ((this.y < this.size && this.dashVelocity.y < 0) || (this.y > canvas.height - this.size && this.dashVelocity.y > 0)) {
                 this.dashVelocity.y *= -1;
                 game.createExplosion(this.x, this.y, this.color, 10);
             }
        } else {
             // Mirror Boss State (Old movement logic)
             if (this.boss.state === 'dash' || this.boss.state === 'rewind') {
                  // Move parallel to boss
                  this.x += this.boss.dashVelocity.x * 60 * dt;
                  this.y += this.boss.dashVelocity.y * 60 * dt;
             } else if (this.boss.state === 'lock') {
                  // Jitter
                  this.x += (Math.random() - 0.5) * 5;
                  this.y += (Math.random() - 0.5) * 5;
             }
        }

        // Standard bounds check
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
