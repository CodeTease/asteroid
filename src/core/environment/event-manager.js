import * as UI from '../../ui.js';
import { audioManager } from '../../audio.js';
import { AfterimageBoss, Monolith } from '../../enemies/index.js';
import { applyDriftForce, drawDriftOverlay, drawDarknessOverlay } from './modifiers.js';

/**
 * EventManager - Điều phối thiên tai Void Mode
 * Extracted from game.js: Darkness, Drift, Inversion, Chaos, Overload
 */
export class EventManager {
    constructor() {
        this.reset();
    }

    reset() {
        // DARKNESS EVENT
        this.darknessTimer = 0;
        this.isDarknessActive = false;
        this.nextDarknessCheck = 30; // Check every 30s

        // DRIFT EVENT (Crisis)
        this.driftTimer = 0;
        this.isDriftActive = false;
        this.driftForce = 0;
        this.nextDriftCheck = 30; // Every 30s in Crisis

        // FIELD INVERSION (Crisis)
        this.inversionTimer = 0;
        this.isInputInverted = false;

        // CHAOS TARGET LOCK (Crisis)
        this.chaosTimer = 0;
        this.nextChaosCheck = 45;

        // OVERLOAD
        this.playerPositions = [];
        this.overloadTimer = 0;
    }

    /**
     * Main update loop for all environmental events
     * Extracted from game.js update() L231-L360
     */
    update(dt, game) {
        if (game.isAbyssMode) {
            game.ui.hideVoidBarrier();
            this.isDarknessActive = false;
            this.isDriftActive = false;
            this.isInputInverted = false;
            return;
        }

        if (!game.behemothDefeated || game.isGameOver) {
            game.ui.hideVoidBarrier();
            this.isDarknessActive = false;
            this.isDriftActive = false;
            this.isInputInverted = false;
            return;
        }

        game.ui.showVoidBarrier();

        // Crisis Mode Barrier Cap
        if (game.crisisMode) {
            game.maxVoidBarrierHealth = 50;
            if (game.voidBarrierHealth > game.maxVoidBarrierHealth) {
                game.voidBarrierHealth = game.maxVoidBarrierHealth;
            }
        } else {
            game.maxVoidBarrierHealth = 100;
        }

        // Overload Check
        this.handleOverload(dt, game);

        const vTime = game.getVoidTime();

        // CRISIS EVENTS (Drift, Inversion, Chaos)
        if (game.crisisMode) {
            // Drift Check (Every 30s) - Blocked by Afterimage Boss
            if (vTime >= this.nextDriftCheck) {
                this.nextDriftCheck += 30;
                if (Math.random() < 0.3 && !(game.finalBoss instanceof AfterimageBoss)) { // 30% chance
                    this.isDriftActive = true;
                    this.driftTimer = 10;
                    this.driftForce = (Math.random() > 0.5 ? 1 : -1) * 2; // Direction
                    game.ui.updateGameStatus("⚠️ ENERGY STORM! DRIFT DETECTED! ⚠️");
                    this.isDarknessActive = false; // Disable Darkness
                }
            }

            if (this.isDriftActive) {
                // Apply Force
                applyDriftForce(game.player, this.driftForce, dt, UI.canvas.width);

                this.driftTimer -= dt;
                if (this.driftTimer <= 0) {
                    this.isDriftActive = false;
                    game.ui.updateGameStatus("Storm cleared.");
                }
            }

            // Field Inversion Check (Low chance)
            if (Math.floor(vTime) % 10 === 0 && Math.random() < 0.015) { // Roughly check
                // Actually, let's use a dedicated timer logic
            }
            // Let's do it simply: check every 20s
            // ... better to do inside the 1s tick or similar.
            // Implemented below in Chaos Logic
        }

        // Darkness Event Check (Disabled during Drift)
        if (vTime >= this.nextDarknessCheck && !this.isDriftActive) {
            this.nextDarknessCheck += 30;
            // Don't trigger Darkness while fighting the Monolith or AfterimageBoss
            if (!(game.isFinalBossActive && (game.finalBoss instanceof Monolith || game.finalBoss instanceof AfterimageBoss))) {
                if (Math.random() < 0.15) { // 15% chance
                    this.isDarknessActive = true;
                    this.darknessTimer = 10; // 10s duration
                    game.ui.updateGameStatus("🌑 THE DARKNESS HAS FALLEN 🌑", false);
                    audioManager.playSound('finalbossWarning'); // Scary sound
                }
            }
        }

        if (this.isDarknessActive) {
            this.darknessTimer -= dt;
            if (this.isDriftActive) this.isDarknessActive = false; // Drift cancels darkness
            if (this.darknessTimer <= 0) {
                this.isDarknessActive = false;
                game.ui.updateGameStatus("Light Returns...");
            }
        }

        // Field Inversion Active Logic
        if (this.isInputInverted) {
            this.inversionTimer -= dt;
            if (this.inversionTimer <= 0) {
                this.isInputInverted = false;
                game.ui.updateGameStatus("Controls Restored.");
            }
        } else if (game.crisisMode) {
            // 5-10% chance to happen randomly?
            // Let's check every 5 seconds
            if (Math.floor(game.gameTime * 10) % 50 === 0) { // roughly every 5s
                if (Math.random() < 0.02 && !(game.finalBoss instanceof AfterimageBoss)) { // very low chance per check to average out
                    this.isInputInverted = true;
                    this.inversionTimer = 3;
                    game.ui.updateGameStatus("⚠️ FIELD INVERSION! CONTROLS FLIPPED! ⚠️");
                    audioManager.playSound('finalbossWarning');
                }
            }

            // CHAOS TARGET LOCK (Every 45s) - Blocked by Afterimage Boss
            if (vTime >= this.nextChaosCheck) {
                this.nextChaosCheck += 45;

                // Gather all allies (EXCEPT Echo and Vamp as per Design Doc)
                const allies = [];
                if (!(game.finalBoss instanceof AfterimageBoss)) {
                    allies.push(...game.player.allies);
                    if (game.laserAlly) allies.push(game.laserAlly);
                }
                // Echo and Vamp allies are immune to Chaos Target Lock

                if (allies.length > 0) {
                    const victim = allies[Math.floor(Math.random() * allies.length)];
                    if (victim) {
                        victim.isConfused = true;
                        victim.confusedTimer = 10; // 10s confusion
                        game.ui.updateGameStatus("⚠️ ALLY SYSTEM HACKED! CHAOS MODE! ⚠️");
                        audioManager.playSound('finalbossWarning');
                    }
                }
            }
        }
    }

    /**
     * Draw environmental overlays
     * Extracted from game.js draw() L542-L601
     */
    draw(ctx, game) {
        // DRIFT OVERLAY (Orange Tint)
        if (this.isDriftActive) {
            drawDriftOverlay(ctx, UI.canvas);
        }

        // DARKNESS OVERLAY
        if (this.isDarknessActive) {
            drawDarknessOverlay(ctx, UI.canvas, game);
        }
    }

    /**
     * Handle Overload mechanic - penalize stationary players
     * Extracted from game.js handleOverload() L851-L879
     */
    handleOverload(dt, game) {
        if (!game.player || game.isPaused || game.isGameOver) return;

        // Track position
        this.playerPositions.push({ x: game.player.x, y: game.player.y, time: game.gameTime });

        // Remove old positions (> 3s ago)
        const cutoff = game.gameTime - 3; // 3 seconds threshold
        this.playerPositions = this.playerPositions.filter(p => p.time >= cutoff);

        // Check if moved enough
        if (this.playerPositions.length > 0) {
            const first = this.playerPositions[0];
            const last = this.playerPositions[this.playerPositions.length - 1];
            const dist = Math.hypot(last.x - first.x, last.y - first.y);

            // If stayed within small radius for 3s
            if (dist < 50 && this.playerPositions.length > 60) { // Enough samples
                this.overloadTimer += dt;
                if (this.overloadTimer > 0.5) { // Warning buffer
                    if (!game.player.isOverheated && !game.isNoHeatMode) {
                        game.player.heat += 50 * dt; // Rapid heat
                        game.ui.updateGameStatus("⚠️ MOVE! OVERLOAD DETECTED! ⚠️", false);
                    }
                }
            } else {
                this.overloadTimer = 0;
            }
        }
    }
}
