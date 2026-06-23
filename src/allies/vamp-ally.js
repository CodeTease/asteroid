import { canvas, ctx } from "../ui.js";
import { audioManager } from "../audio.js";
import { CONFIG } from "../config.js";

export class VampAlly {
    constructor() {
        this.size = 15;
        this.x = canvas.width / 2;
        this.y = canvas.height - 70;
        this.floatTimer = 0;
        this.damage = 1;
        this.isFiring = false;
        this.beamTarget = null;
        this.isRetreating = false;
    }

    draw(game) {
        if (!game.player || game.player.isDestroyed || this.isRetreating) return;

        ctx.save();
        // Visuals: Crimson red drone
        ctx.fillStyle = '#dc143c'; // Crimson

        // CHAOS MODE VISUAL (Confused)
        if (this.isConfused) {
             ctx.shadowColor = 'purple';
             ctx.shadowBlur = 20;
        }
        
        // Hover effect
        const yOffset = Math.sin(this.floatTimer * 3) * 5;
        const xOffset = Math.cos(this.floatTimer * 2) * 30;
        
        const drawX = game.player.x + xOffset - 40; // Left side of player
        const drawY = game.player.y - 40 + yOffset;
        
        this.x = drawX;
        this.y = drawY;

        ctx.translate(drawX, drawY);
        
        // Drone Body
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Eye
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = 'red';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();

        // Beam
        if (this.isFiring && this.beamTarget) {
            ctx.save();
            ctx.strokeStyle = `rgba(220, 20, 60, ${0.5 + Math.sin(Date.now() / 50) * 0.5})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.beamTarget.x, this.beamTarget.y);
            ctx.stroke();

            // Siphon particles moving back
            const dist = Math.hypot(this.beamTarget.x - this.x, this.beamTarget.y - this.y);
            const particleCount = 3;
            for (let i = 0; i < particleCount; i++) {
                const t = ((Date.now() / 500) + (i / particleCount)) % 1;
                const px = this.beamTarget.x + (this.x - this.beamTarget.x) * t;
                const py = this.beamTarget.y + (this.y - this.beamTarget.y) * t;
                ctx.fillStyle = '#00ff00'; // Green healing energy
                ctx.beginPath();
                ctx.arc(px, py, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }
    }

    update(game, dt) {
        if (this.isRetreating) return;
        
        this.floatTimer += dt;
        
        if (this.isConfused) {
             this.confusedTimer -= dt;
             if (this.confusedTimer <= 0) this.isConfused = false;
        }

        // Auto Attack Logic
        // Target closest enemy
        let bestTarget = null;
        let minDistance = 300; // Range

        for (const asteroid of game.asteroids) {
             const dist = Math.hypot(this.x - asteroid.x, this.y - asteroid.y);
             if (dist < minDistance) {
                 minDistance = dist;
                 bestTarget = asteroid;
             }
        }

        if (this.isConfused) {
             // Vamp ally does nothing or beams empty space
             this.isFiring = false;
             this.beamTarget = null;
        } else if (bestTarget) {
            this.isFiring = true;
            this.beamTarget = bestTarget;
            // Siphon Damage (Low but constant)
            if (bestTarget.health > 0) {
                bestTarget.health -= this.damage * 10 * dt;

                // VAMP ALLY KILL EFFECT
                if (bestTarget.health <= 0) {
                     if (game.player) {
                         if (bestTarget.isElite) {
                             // Elite Kill: INSTANT RESET
                             game.player.heat = 0;
                             game.player.isOverheated = false;
                             if (game.player.overheatTimeout) clearTimeout(game.player.overheatTimeout);
                             game.updateGameStatus("VAMP: HEAT RESET!");
                             game.createExplosion(game.player.x, game.player.y, '#00ff00', 30);
                         } else {
                             // Normal Kill: Reduce 30% Heat
                             game.player.heat -= game.player.maxHeat * 0.3;
                             if (game.player.heat < 0) game.player.heat = 0;
                             // Visual feedback
                             game.createExplosion(this.x, this.y, '#dc143c', 10);
                         }
                     }
                }
            }
        } else {
            this.isFiring = false;
            this.beamTarget = null;
        }
    }
}
