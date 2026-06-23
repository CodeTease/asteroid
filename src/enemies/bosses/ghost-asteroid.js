import { canvas, ctx } from "../../ui.js";
import { audioManager } from "../../audio.js";
import { CONFIG } from "../../config.js";
import { Asteroid } from '../basic/asteroid.js';

export class GhostAsteroid extends Asteroid {
    constructor(game) {
        super(game, { type: 'standard' }); // Inherit standard stats initially
        this.type = 'ghost';
        this.color = '#333333'; // Darker base
        this.isRevealed = false;
        this.baseSpeed = this.speed;
        this.alpha = 0.1; // Almost invisible
    }

    draw(game) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        if (this.isRevealed) {
             ctx.fillStyle = '#ffffff'; // Ghostly white when revealed
             ctx.shadowColor = '#ffffff';
             ctx.shadowBlur = 10;
        } else {
             ctx.fillStyle = this.color;
        }
        
        ctx.beginPath();
        ctx.moveTo(this.x + this.shape[0].x, this.y + this.shape[0].y);
        for (let i = 1; i < this.shape.length; i++) {
            ctx.lineTo(this.x + this.shape[i].x, this.y + this.shape[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    update(game, dt) {
        // Visibility Logic (Move to update)
        if (!this.isRevealed) {
            let minDistance = Infinity;
            const entities = [game.player, ...game.player.allies];
            if (game.laserAlly) entities.push(game.laserAlly);
            if (game.echoAlly) entities.push(game.echoAlly);
            if (game.echoAlly2) entities.push(game.echoAlly2);
            if (game.vampAlly) entities.push(game.vampAlly);

            entities.forEach(e => {
                if (e && !e.isDestroyed && !e.isRetreating) {
                    const dist = Math.hypot(this.x - e.x, this.y - e.y);
                    if (dist < minDistance) minDistance = dist;
                }
            });

            // Flashlight Radius approx 150
            if (minDistance < 150) {
                this.isRevealed = true;
                this.alpha = 1;
            }
        }

        if (this.isRevealed) {
             // Tăng tốc (Speed up)
             this.y += this.baseSpeed * 2 * 60 * dt;
        } else {
             this.y += this.baseSpeed * 60 * dt;
        }
    }
}
