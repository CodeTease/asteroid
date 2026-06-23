import { canvas, ctx } from "../ui.js";
import { audioManager } from "../audio.js";
import { CONFIG } from "../config.js";

export class Particle {
    constructor(x, y, color) {
        this.reset({ x, y, color });
    }
    
    reset(options) {
        this.x = options.x ?? 0;
        this.y = options.y ?? 0;
        this.color = options.color ?? '#fff';
        this.radius = Math.random() * 3 + 1;
        this.vx = Math.random() * 4 - 2;
        this.vy = Math.random() * 4 - 2;
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

export class VoidRift {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 30;
        this.life = 2; // 2 seconds
        this.color = '#800080'; // Purple
        this.rotation = Math.random() * Math.PI;
    }

    draw(game) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'purple';
        
        // Rift shape
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
             ctx.rotate(Math.PI * 2 / 6);
             ctx.lineTo(this.size, 0);
             ctx.lineTo(this.size/3, 5);
        }
        ctx.fill();
        
        ctx.restore();
    }

    update(game, dt) {
        this.life -= dt;
        this.rotation += dt;
        
        // Slow Player
        if (game.player && !game.player.isDestroyed) {
            const dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);
            if (dist < this.size + game.player.size) {
                game.player.isSlowed = true;
            }
        }

        if (this.life <= 0) {
            // Explode
            game.createExplosion(this.x, this.y, 'purple', 8);
            if (game.player && !game.player.isDestroyed) {
                const dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);
                if (dist < 60) { // Explosion radius
                     if (game.player.shieldCharges > 0) {
                         game.player.shieldCharges--;
                         game.updateGameStatus("Shield damaged by Void Rift!");
                     } else {
                         game.handleGameOver("Consumed by Void Rift!");
                     }
                }
            }
            return true; // Destroy
        }
        return false;
    }
}
