import { canvas, ctx } from "../../ui.js";
import { audioManager } from "../../audio.js";
import { CONFIG } from "../../config.js";
import { Asteroid } from '../basic/asteroid.js';

export class Breacher extends Asteroid {
    constructor(game, options = {}) {
        super(game, { type: 'breacher', ...options });
        this.size = 12; // Small
        this.speed = 5; // Fast
        this.health = 3; // Low HP but not one-shot
        this.color = '#FF4500'; // OrangeRed
        
        // Physics Override for Shrapnel Mode
        this.vx = options.vx ?? 0;
        this.vy = options.vy ?? this.speed;
        this.usePhysics = options.vx !== undefined || options.vy !== undefined;

        // Shape: Arrow/Triangle pointing down
        this.shape = [
            { x: -10, y: -10 },
            { x: 10, y: -10 },
            { x: 0, y: 15 }
        ];
    }

    draw(game) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        
        // Trail effect
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - 5, this.y - 15);
        ctx.lineTo(this.x + 5, this.y - 15);
        ctx.fillStyle = 'rgba(255, 69, 0, 0.5)';
        ctx.fill();

        super.draw(game);
        ctx.restore();
    }

    update(game, dt) {
        if (this.usePhysics) {
             const moveFactor = 60 * dt;
             this.x += this.vx * moveFactor;
             this.y += this.vy * moveFactor;
             
             // Gravity for Shrapnel Mode (if moving up initially)
             // Or just constant gravity
             this.vy += 0.1 * moveFactor; 
             
             // Boundary Bounce (X-axis)
             if (this.x < 0 || this.x > canvas.width) {
                 this.vx *= -1;
                 // Push back in
                 if (this.x < 0) this.x = 0;
                 if (this.x > canvas.width) this.x = canvas.width;
             }

             // Rotate to face velocity
             // Note: Asteroid.draw doesn't rotate by default unless we add rotation logic.
             // We'll skip complex rotation for now.
        } else {
            // Standard Breacher behavior
            this.y += this.speed * 60 * dt;
            this.x += Math.sin(this.y / 50) * 1;
        }
    }
}

export class DefenseDrone extends Asteroid {
    constructor(game, parent) {
        super(game, { type: 'defense_drone', isBoss: false });
        this.parent = parent;
        this.angle = Math.random() * Math.PI * 2;
        this.distance = 80;
        this.health = 500;
        this.maxHealth = 500;
        this.color = '#FFFFFF';
        this.size = 15;
    }

    update(game, dt) {
        if (!this.parent || this.parent.health <= 0 || !game.asteroids.includes(this.parent)) {
             this.health = 0; // Self destruct if boss gone
             return;
        }

        const moveFactor = 60 * dt;
        this.angle += 0.05 * moveFactor;
        this.x = this.parent.x + Math.cos(this.angle) * this.distance;
        this.y = this.parent.y + Math.sin(this.angle) * this.distance;
    }

    draw(game) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'cyan';
        
        // Draw Drone
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
        
        // Link
        if (this.parent) {
             ctx.save();
             ctx.strokeStyle = 'cyan';
             ctx.lineWidth = 2;
             ctx.setLineDash([5, 5]);
             ctx.beginPath();
             ctx.moveTo(this.x, this.y);
             ctx.lineTo(this.parent.x, this.parent.y);
             ctx.stroke();
             ctx.restore();
        }
    }
}
