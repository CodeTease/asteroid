import { canvas, ctx } from "../ui.js";
import { audioManager } from "../audio.js";
import { CONFIG } from "../config.js";

export class EchoAlly {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height - 100; // Start higher
        this.size = 15;
        this.floatTimer = 0; // For sine wave animation
        this.isStunned = false;
        this.stunTimer = 0;
    }

    draw(game) {
        if (!game.player || game.player.isDestroyed) return;

        ctx.save();
        ctx.globalAlpha = 0.4; // Ghostly transparent
        if (this.isStunned) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#555'; // Grey when stunned
        } else {
            // Use player's rotation logic for the ghost
            if (game && game.isAimUnlocked && game.mousePos) {
                 const angle = Math.atan2(game.mousePos.y - this.y, game.mousePos.x - this.x);
                 ctx.translate(this.x, this.y);
                 ctx.rotate(angle + Math.PI / 2);
                 ctx.translate(-this.x, -this.y);
            }
            ctx.fillStyle = '#00ffff'; // Cyan Ghost
        }

        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.size * 2.2);
        ctx.lineTo(this.x - this.size * 0.6, this.y + this.size * 1.8);
        ctx.lineTo(this.x + this.size * 0.6, this.y + this.size * 1.8);
        ctx.closePath();
        ctx.fill();

        if (!this.isStunned) ctx.fillStyle = '#aaddff';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.size, this.y + this.size * 2);
        ctx.lineTo(this.x, this.y + this.size * 1.5);
        ctx.lineTo(this.x + this.size, this.y + this.size * 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    update(game, dt) {
        if (this.isConfused) {
             this.confusedTimer -= dt;
             if (this.confusedTimer <= 0) this.isConfused = false;
        }

        if (this.isStunned) {
             this.stunTimer -= dt;
             if (this.stunTimer <= 0) this.isStunned = false;
        }

        if (game.player && !game.player.isDestroyed) {
            this.floatTimer += dt;
            
            // GHOSTLY DRIFT LOGIC
            // Side to side movement (30px wide sine wave)
            const floatX = Math.sin(this.floatTimer * 2) * 30; 
            // Slight up and down hover (10px height)
            const floatY = Math.sin(this.floatTimer * 4) * 10; 

            // Target is ABOVE player now (-60px)
            const targetX = game.player.x + floatX;
            const targetY = game.player.y - 60 + floatY; 
            
            // Smoothly move towards target (Lower lerp factor = more drift/delay)
            this.x += (targetX - this.x) * 3 * dt;
            this.y += (targetY - this.y) * 3 * dt;
        }
    }
}
