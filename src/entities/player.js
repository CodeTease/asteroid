import { canvas, ctx } from "../ui.js";
import { audioManager } from "../audio.js";
import { CONFIG } from "../config.js";
import { BehemothTurret } from "../enemies/bosses/behemoth.js";

export class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height - 40;
        this.size = CONFIG.PLAYER.INITIAL_SIZE;
        this.speed = CONFIG.PLAYER.INITIAL_SPEED;
        this.projectileSize = CONFIG.PLAYER.INITIAL_PROJECTILE_SIZE;
        this.projectileDamage = CONFIG.PLAYER.INITIAL_PROJECTILE_DAMAGE;
        this.fireRate = CONFIG.PLAYER.INITIAL_FIRE_RATE;
        this.alpha = 1;
        this.allies = [];
        this.lastX = this.x;
        this.vx = 0; // Added for Juggler push effect
        this.isDestroyed = false;
        this.shieldCharges = 0;
        
        this.isStunned = false;
        this.stunTimer = 0;
        
        // Status Effects
        this.isSlowed = false;

        // Heat System
        this.heat = 0;
        this.maxHeat = CONFIG.PLAYER.MAX_HEAT;
        this.isOverheated = false;
        this.overheatTimeout = null;

        // Abyss Mode: Dash
        this.dashCharges = CONFIG.ABYSS.MAX_DASH_CHARGES;
        this.isDashing = false;
        this.dashTimer = 0;
        this.lastDashTime = 0;
    }

    draw(game) {
        if (this.isDestroyed) return;

        if (this.shieldCharges > 0) {
            ctx.save();
            const shieldRadius = this.size * 2.5;
            const pulse = Math.sin(Date.now() / 150) * 0.2 + 0.5;
            ctx.fillStyle = `rgba(0, 229, 255, ${pulse})`;
            ctx.strokeStyle = `rgba(0, 229, 255, 0.8)`;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00e5ff';

            ctx.beginPath();
            ctx.arc(this.x, this.y + this.size, shieldRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        // Aim Rotation
        if (game && game.isAimUnlocked && game.mousePos) {
             const angle = Math.atan2(game.mousePos.y - this.y, game.mousePos.x - this.x);
             ctx.translate(this.x, this.y);
             ctx.rotate(angle + Math.PI / 2); 
             ctx.translate(-this.x, -this.y);
        }

        // Color changes based on heat
        let engineColor = '0, 229, 255'; // Default Blue
        if (this.isOverheated) engineColor = '255, 69, 0'; // Red
        else if (this.heat > 70) engineColor = '255, 140, 0'; // Orange

        const engineGlow = Math.random() * 0.3 + 0.7;
        ctx.fillStyle = `rgba(${engineColor}, ${engineGlow})`;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + this.size * 2.2);
        ctx.lineTo(this.x - this.size * 0.6, this.y + this.size * 1.8);
        ctx.lineTo(this.x + this.size * 0.6, this.y + this.size * 1.8);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = this.isOverheated ? '#555' : '#cccccc';
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
        let speedMult = 1;
        if (this.isSlowed) {
            speedMult = 0.2; // 80% Slow
            this.isSlowed = false; // Reset, requires continuous application
        }

        const moveSpeed = this.speed * speedMult * 60 * dt;

        // Apply Velocity (Juggler Push)
        if (this.vx !== 0) {
            this.x += this.vx * 60 * dt;
            this.vx *= 0.9; // Friction to slow down push
            if (Math.abs(this.vx) < 0.1) this.vx = 0;

            // Boundary checks for push
            if (this.x < this.size) this.x = this.size;
            if (this.x > game.worldWidth - this.size) this.x = game.worldWidth - this.size;
        }

        // Dash Logic
        if (this.isDashing) {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        } else {
            // Recharge Dash
            if (this.dashCharges < CONFIG.ABYSS.MAX_DASH_CHARGES) {
                const timeSinceLastDash = Date.now() - this.lastDashTime;
                if (timeSinceLastDash > CONFIG.ABYSS.DASH_COOLDOWN * 1000) {
                    this.dashCharges++;
                    this.lastDashTime = Date.now();
                }
            }
        }

        // Field Inversion Logic
        let leftKey = (game.keys['ArrowLeft'] || game.keys['a']);
        let rightKey = (game.keys['ArrowRight'] || game.keys['d']);

        if (game.isInputInverted) {
            const temp = leftKey;
            leftKey = rightKey;
            rightKey = temp;
            
            // Visual cue for inversion? Maybe in Draw.
        }
        
        // Override movement input
        let currentSpeed = moveSpeed;
        if (this.isDashing) {
            currentSpeed += CONFIG.ABYSS.DASH_SPEED_ADDITIVE * 60 * dt;
        }

        if (leftKey && this.x > this.size) this.x -= currentSpeed;
        if (rightKey && this.x < game.worldWidth - this.size) this.x += currentSpeed;

        if (game.isAbyssMode) {
            let upKey = (game.keys['ArrowUp'] || game.keys['w']);
            let downKey = (game.keys['ArrowDown'] || game.keys['s']);
            if (upKey && this.y > this.size) this.y -= currentSpeed;
            if (downKey && this.y < game.worldHeight - this.size) this.y += currentSpeed;
        }

        // Heat Decay
        if (!this.isOverheated && this.heat > 0) {
            // Check for Sizzler
            const hasSizzler = game.asteroids.some(a => a.type === 'sizzler');
            // Check for BehemothTurret
            const hasBehemoth = game.asteroids.some(a => a instanceof BehemothTurret);

            let decayRate = CONFIG.PLAYER.HEAT_DECAY_RATE;
            if (hasSizzler) decayRate = CONFIG.PLAYER.HEAT_DECAY_RATE / 2;
            if (hasBehemoth) decayRate = CONFIG.PLAYER.HEAT_DECAY_RATE / 4; // Behemoth significantly reduces cooling

            this.heat -= decayRate * dt; // Decay speed
            if (this.heat < 0) this.heat = 0;
        }
    }

    dash() {
        if (this.dashCharges > 0 && !this.isDashing && !this.isDestroyed && !this.isStunned) {
            this.dashCharges--;
            this.isDashing = true;
            this.dashTimer = CONFIG.ABYSS.DASH_DURATION;
            this.lastDashTime = Date.now();
            audioManager.playSound('shoot', 0.5); // TODO: Add dash sound
        }
    }

    shoot(game) {
        if (game.isGameOver || game.isPaused || this.isOverheated) return;

        // Heat Build-up
        if (game.isAimUnlocked && !game.isNoHeatMode) {
            // Check for Sizzler
            const hasSizzler = game.asteroids.some(a => a.type === 'sizzler');
             // Check for BehemothTurret
            const hasBehemoth = game.asteroids.some(a => a instanceof BehemothTurret);

            let heatGen = CONFIG.PLAYER.HEAT_GENERATION;
            if (hasSizzler) heatGen = CONFIG.PLAYER.HEAT_GENERATION * 1.2;
            if (hasBehemoth) heatGen = CONFIG.PLAYER.HEAT_GENERATION * 1.5; // Behemoth increases heat generation

            this.heat += heatGen;
            if (this.heat >= this.maxHeat) {
                this.heat = this.maxHeat;
                this.isOverheated = true;
                audioManager.playSound('finalbossWarning'); // Re-use sound for jam
                game.updateGameStatus("WEAPON JAMMED!");
                this.overheatTimeout = setTimeout(() => {
                    this.isOverheated = false;
                    this.heat = 0;
                }, 2000); // 2s penalty
            }
        }

        audioManager.playSound('shoot', 0.5);

        // Helper to create bullets
        const createBullet = (originX, originY, source = 'player') => {
            let vx = 0;
            let vy = -8;

            if (game.isAimUnlocked && game.mousePos) {
                const dx = game.mousePos.x - originX;
                const dy = game.mousePos.y - originY;
                const dist = Math.hypot(dx, dy);
                const speed = 10;
                vx = (dx / dist) * speed;
                vy = (dy / dist) * speed;
            }

            if (this.fireRate === 2) {
                if (game.isAimUnlocked) {
                    game.projectiles.push(game.projectilePool.get({ x: originX, y: originY, size: this.projectileSize, damage: this.projectileDamage, vx: vx + 1, vy: vy, source: source }));
                    game.projectiles.push(game.projectilePool.get({ x: originX, y: originY, size: this.projectileSize, damage: this.projectileDamage, vx: vx - 1, vy: vy, source: source }));
                } else {
                    game.projectiles.push(game.projectilePool.get({ x: originX - 7, y: originY, size: this.projectileSize, damage: this.projectileDamage, source: source }));
                    game.projectiles.push(game.projectilePool.get({ x: originX + 7, y: originY, size: this.projectileSize, damage: this.projectileDamage, source: source }));
                }
            } else {
                game.projectiles.push(game.projectilePool.get({ x: originX, y: originY, size: this.projectileSize, damage: this.projectileDamage, vx, vy, source: source }));
            }
        };

        // Player shoots
        createBullet(this.x, this.y, 'player');

        // Echo shoots (if exists)
        if (game.echoAlly && !game.echoAlly.isStunned) {
            createBullet(game.echoAlly.x, game.echoAlly.y, 'echo');
        }
        // Second Echo (Permanent Echo Skill)
        if (game.echoAlly2 && !game.echoAlly2.isStunned) {
            createBullet(game.echoAlly2.x, game.echoAlly2.y, 'echo');
        }
    }
}
