import { canvas, ctx } from "../ui.js";
import { audioManager } from "../audio.js";
import { CONFIG } from "../config.js";

export class Coolant {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 10;
        this.vy = 2;
        this.color = '#00ffff'; // Cyan
    }

    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner detail
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("❄", this.x, this.y + 4);
        
        ctx.restore();
    }

    update(dt) {
        this.y += this.vy * 60 * dt;
    }
}
