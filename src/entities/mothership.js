import { ctx } from "../ui.js";
import { CONFIG } from "../config.js";

export class Mothership {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 80;
        this.health = CONFIG.ABYSS.MOTHERSHIP_HEALTH;
        this.maxHealth = CONFIG.ABYSS.MOTHERSHIP_HEALTH;
        this.color = '#4CAF50';
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Shield Effect (optional, could scale with health)
        ctx.shadowColor = '#81C784';
        ctx.shadowBlur = 20;
        
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#81C784';
        ctx.lineWidth = 4;
        
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size, this.size);
        ctx.lineTo(0, this.size * 0.5); // Notch
        ctx.lineTo(-this.size, this.size);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();
        
        // Draw Health Bar
        const barWidth = 150;
        const barHeight = 12;
        const barY = this.size + 30;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);
        
        const healthPercent = Math.max(0, this.health / this.maxHealth);
        ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : (healthPercent > 0.25 ? '#FFFF00' : '#FF0000');
        ctx.fillRect(-barWidth / 2, barY, barWidth * healthPercent, barHeight);
        
        ctx.restore();
    }
}
