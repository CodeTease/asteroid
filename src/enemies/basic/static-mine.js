import { canvas, ctx } from "../../ui.js";
import { audioManager } from "../../audio.js";
import { CONFIG } from "../../config.js";

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

export class BehemothBomb {
    constructor(x, y, targetX, targetY) {
        this.x = x;
        this.y = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.size = 20;
        this.speed = 1.5;
        this.color = '#ff4500';
        this.isExploding = false;
        this.explosionRadius = 150;
        this.explodeTimer = 0;
    }

    draw() {
        if (this.isExploding) {
            ctx.save();
            ctx.fillStyle = `rgba(255, 69, 0, ${0.5 + Math.sin(Date.now() / 50) * 0.5})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.explosionRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            ctx.save();
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 20;
            ctx.shadowColor = 'red';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            // Pulse center
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 0.5 * (1 + Math.sin(Date.now() / 100) * 0.3), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    update(game, dt) {
        if (this.isExploding) {
            this.explodeTimer -= dt;
            if (this.explodeTimer <= 0) return true; // Signal to remove

            // Damage check (simple: if player in radius)
            const dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);
            if (dist < this.explosionRadius && !game.player.isDestroyed) {
                // Break shields instantly or kill
                if (game.player.shieldCharges > 0) {
                    game.player.shieldCharges = 0;
                    game.updateGameStatus("SHIELD BROKEN BY BOMB!");
                    game.screenShakeDuration = 20;
                } else {
                    game.handleGameOver("Obliterated by Behemoth Bomb!");
                }
            }
            return false;
        }

        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
            this.isExploding = true;
            this.explodeTimer = 1; // Lasts 1s
            game.screenShakeDuration = 10;
            audioManager.playSound('finalbossExplosion');
        } else {
            this.x += (dx / dist) * this.speed * 60 * dt;
            this.y += (dy / dist) * this.speed * 60 * dt;
        }
        return false;
    }
}
