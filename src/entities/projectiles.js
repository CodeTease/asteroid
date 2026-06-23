import { canvas, ctx } from "../ui.js";
import { audioManager } from "../audio.js";
import { CONFIG } from "../config.js";

export class Projectile {
    constructor(x, y, options = {}) {
        this.reset({ x, y, ...options });
    }

    reset(options) {
        this.x = options.x ?? 0;
        this.y = options.y ?? 0;
        this.size = options.size ?? 5;
        this.damage = options.damage ?? 1;
        this.vx = options.vx ?? 0;
        this.vy = options.vy ?? -8;
        this.color = options.color ?? '#00ffff';
        this.source = options.source ?? 'player'; // 'player', 'echo', 'ai_ally'
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x - this.size / 2, this.y, this.size, this.size * 2);
        ctx.shadowBlur = 0;
    }

    update(game, dt) {
        const moveFactor = 60 * dt;
        this.x += this.vx * moveFactor;
        this.y += this.vy * moveFactor;
    }
}
