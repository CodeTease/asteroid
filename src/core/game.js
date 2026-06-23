import * as UI from '../ui.js';
import { Player } from '../entities/player.js';
import { Projectile } from '../entities/projectiles.js';
import { Asteroid, GhostAsteroid, FinalBoss, StaticMine, BehemothTurret, BehemothBomb, Monolith, MiniBehemoth, Breacher, AfterimageBoss, DefenseDrone } from '../enemies/index.js';
import { AIAlly, LaserAlly, EchoAlly, VampAlly, SolidDecoy } from '../allies/index.js';
import { Coolant } from '../entities/items.js';
import { Particle, VoidRift } from '../entities/particles.js';
import { audioManager } from '../audio.js';
import { CONFIG } from '../config.js';
import { ObjectPool } from '../pool.js';
import { Spawner } from './spawner.js';
import { CollisionSystem } from './collisions.js';
import { UpgradeSystem } from './upgrades.js';


export class Game {
    constructor() {
        this.animationFrameId = 0;
        
        // Object Pools
        this.projectilePool = new ObjectPool(() => new Projectile(0, 0), 200);
        this.particlePool = new ObjectPool(() => new Particle(0, 0, '#fff'), 200);
        this.keys = {};
        
        // Subsystems
        this.spawner = new Spawner(this);
        this.collisionSystem = new CollisionSystem(this);
        this.upgradeSystem = new UpgradeSystem(this);

        // Game State Variables
        this.player = null;
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.asteroids = [];
        this.particles = [];
        this.coolants = []; // New drop items
        this.score = 0;
        this.gameTime = 0;
        this.voidStartTime = 0; // Initialize voidStartTime
        this.deltaTime = 0;
        this.lastTime = 0;
        this.nextBossTime = 0;
        this.lastSpawnTime = 0;
        this.nextShieldScore = 0;
        this.upgradePoints = 0;
        this.allyUpgrades = {};
        this.laserAlly = null;
        this.echoAlly = null; // REPLACED PRISM WITH ECHO
        this.echoAlly2 = null; // PERMANENT ECHO SKILL
        this.vampAlly = null; // REWARD FOR BEHEMOTH
        this.finalBoss = null;
        this.isBossActive = false;
        this.isFinalBossActive = false;
        this.isGameOver = false;
        this.isPaused = false;
        this.isAutoUpgradeEnabled = false;
        this.finalBossWarningShown = false;
        this.finalBossDefeated = false;
        this.screenShakeDuration = 0;
        this.screenShakeIntensity = 0;
        this.flashDuration = 0;
        this.statusMessageTimeout = null;

        // Aim Mode
        this.isAimUnlocked = false;
        this.mousePos = { x: 0, y: 0 };
        this.godMode = false; // Debug

        // VOID MODE SKILLS
        this.voidSkills = {
            noHeatMode: { active: false, timer: 0, cooldown: 120, lastUsed: -999, duration: 60 },
            ultimateBarrage: { cooldown: 120, lastUsed: -999 },
            permanentEcho: { acquired: false }
        };
        this.selectedSkill = null; // 'noHeatMode', 'permanentEcho', 'ultimateBarrage'
        this.behemothSpawned = false;
        this.behemothDefeated = false;
        this.crisisMode = false; // CRISIS MODE FLAG

        // VOID BARRIER & OVERLOAD
        this.voidBarrierHealth = 100;
        this.maxVoidBarrierHealth = 100;
        this.playerPositions = []; // For Overload check
        this.overloadTimer = 0;

        // DARKNESS EVENT
        this.darknessTimer = 0;
        this.isDarknessActive = false;
        this.nextDarknessCheck = 30; // Check every 30s
        
        // CRISIS EVENTS
        this.driftTimer = 0;
        this.isDriftActive = false;
        this.driftForce = 0;
        this.nextDriftCheck = 30; // Every 30s in Crisis
        
        this.inversionTimer = 0;
        this.isInputInverted = false;
        
        this.chaosTimer = 0;
        this.nextChaosCheck = 45;
    }

    start() {
        this.init();
        audioManager.stopAllLoopingSounds();
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.lastTime = performance.now(); // Reset timer for game loop
        this.gameLoop(this.lastTime);
    }

    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = 0;
        }
        audioManager.stopAllLoopingSounds();
        audioManager.playMenuMusic();
    }

    init() {
        this.isGameOver = false;
        this.isPaused = false;
        this.player = new Player();
        
        // Release existing pooled objects
        this.projectilePool.releaseAll();
        this.particlePool.releaseAll();

        this.projectiles = [];
        this.enemyProjectiles = [];
        this.asteroids = [];
        this.particles = [];
        this.coolants = [];
        this.score = 0;
        this.gameTime = 0;
        this.voidStartTime = 0; // Reset voidStartTime
        this.deltaTime = 0;
        this.lastTime = 0;
        this.lastSpawnTime = 0;
        this.nextBossTime = CONFIG.GAME.BOSS_SPAWN_TIME;
        this.nextShieldScore = CONFIG.PLAYER.SHIELD_RECHARGE_SCORE_STEP;
        this.isBossActive = false;
        this.isFinalBossActive = false;
        this.finalBossWarningShown = false;
        this.finalBossDefeated = false;
        this.finalBoss = null;
        this.laserAlly = null;
        this.echoAlly = null;
        this.echoAlly2 = null;
        this.vampAlly = null;
        this.upgradePoints = 0;
        this.allyUpgrades = {
            fireRateLevel: 0,
            hasDoubleShot: false,
            hasFasterProjectiles: false,
            laserDamageLevel: 0,
            laserCooldownLevel: 0,
        };
        this.screenShakeDuration = 0;
        this.flashDuration = 0;
        if (this.statusMessageTimeout) clearTimeout(this.statusMessageTimeout);
        this.statusMessageTimeout = null;
        
        this.isAimUnlocked = false;

        this.voidSkills = {
            noHeatMode: { active: false, timer: 0, cooldown: 120, lastUsed: -999, duration: 60 },
            ultimateBarrage: { cooldown: 120, lastUsed: -999 },
            permanentEcho: { acquired: false }
        };
        this.selectedSkill = null;
        this.behemothSpawned = false;
        this.behemothDefeated = false;
        this.crisisMode = false;

        this.voidBarrierHealth = 100;
        this.maxVoidBarrierHealth = 100;
        this.playerPositions = [];
        this.overloadTimer = 0;
        
        this.darknessTimer = 0;
        this.isDarknessActive = false;
        this.nextDarknessCheck = 30;
        
        this.driftTimer = 0;
        this.isDriftActive = false;
        this.driftForce = 0;
        this.nextDriftCheck = 30;
        
        this.inversionTimer = 0;
        this.isInputInverted = false;
        
        this.chaosTimer = 0;
        this.nextChaosCheck = 45;

        this.updateHUD();
        this.updateGameStatus('Ready', false);
        UI.finalBossHealthContainer.style.display = 'none';
        UI.voidBarrierContainer.style.display = 'none'; // Hide barrier initially
        UI.heatGroup.style.display = 'none'; // Hide heat bar initially
        UI.timerLabel.innerText = "⏱️"; // Reset timer label
    }

    gameLoop(currentTime) {
        let deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        if (deltaTime > CONFIG.GAME.MAX_DELTA_TIME) deltaTime = CONFIG.GAME.MAX_DELTA_TIME;

        if (this.isPaused) {
            this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
            return;
        }
        
        this.update(deltaTime);
        this.draw();
        
        this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    }
    
    update(dt) {
        if (!this.isGameOver) {
             // FREEZE TIME: Stop time if Boss is Active (Monolith, Behemoth, FinalBoss, AfterimageBoss)
             // This ensures gameplay timeline is consistent
             if (!this.isBossActive && !this.isFinalBossActive) {
                this.gameTime += dt;
             }
            this.spawner.handleSpawning();
        }

        // VOID BARRIER CHECK (Only active AFTER Behemoth is defeated)
        if (this.behemothDefeated && !this.isGameOver) {
            UI.voidBarrierContainer.style.display = 'block';
            
            // Crisis Mode Barrier Cap
            if (this.crisisMode) {
                 this.maxVoidBarrierHealth = 50;
                 if (this.voidBarrierHealth > this.maxVoidBarrierHealth) {
                      this.voidBarrierHealth = this.maxVoidBarrierHealth;
                 }
            } else {
                 this.maxVoidBarrierHealth = 100;
            }
            
            // Overload Check
            this.handleOverload(dt);
            
            const vTime = this.getVoidTime();

            // CRISIS EVENTS (Drift, Inversion, Chaos)
            if (this.crisisMode) {
                 // Drift Check (Every 30s) - Blocked by Afterimage Boss
                 if (vTime >= this.nextDriftCheck) {
                      this.nextDriftCheck += 30;
                      if (Math.random() < 0.3 && !(this.finalBoss instanceof AfterimageBoss)) { // 30% chance
                          this.isDriftActive = true;
                          this.driftTimer = 10; // Lasts 10s? Prompt says "storm", assume duration or until event end?
                          // Let's assume duration. Or maybe it's a momentary strong push?
                          // Prompt: "Cơn bão năng lượng... overlay... đẩy người chơi trôi dạt... mỗi 30s"
                          // Let's make it last 10 seconds.
                          this.driftForce = (Math.random() > 0.5 ? 1 : -1) * 2; // Direction
                          this.updateGameStatus("⚠️ ENERGY STORM! DRIFT DETECTED! ⚠️");
                          this.isDarknessActive = false; // Disable Darkness
                      }
                 }
                 
                 if (this.isDriftActive) {
                      // Apply Force
                      if (this.player && !this.player.isDestroyed) {
                          this.player.x += this.driftForce * 60 * dt;
                          // Keep in bounds
                          if (this.player.x < this.player.size) this.player.x = this.player.size;
                          if (this.player.x > UI.canvas.width - this.player.size) this.player.x = UI.canvas.width - this.player.size;
                      }
                      
                      this.driftTimer -= dt;
                      if (this.driftTimer <= 0) {
                           this.isDriftActive = false;
                           this.updateGameStatus("Storm cleared.");
                      }
                 }
                 
                 // Field Inversion Check (Low chance)
                 // Let's check periodically or reuse spawn timer? 
                 // It says "5-10%". Let's check randomly every frame is bad.
                 // Let's check every 10 seconds? Or reuse Drift timer offset?
                 // Let's put it in handleSpawning or separate timer. 
                 // Or just random chance every 10s.
                 if (Math.floor(vTime) % 10 === 0 && Math.random() < 0.005) { // Roughly check 
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
                  if (!(this.isFinalBossActive && (this.finalBoss instanceof Monolith || this.finalBoss instanceof AfterimageBoss))) {
                     if (Math.random() < 0.15) { // 15% chance
                         this.isDarknessActive = true;
                         this.darknessTimer = 10; // 10s duration
                         this.updateGameStatus("🌑 THE DARKNESS HAS FALLEN 🌑", false);
                         audioManager.playSound('finalbossWarning'); // Scary sound
                     }
                  }
            }

            if (this.isDarknessActive) {
                 this.darknessTimer -= dt;
                 if (this.isDriftActive) this.isDarknessActive = false; // Drift cancels darkness
                 if (this.darknessTimer <= 0) {
                      this.isDarknessActive = false;
                      this.updateGameStatus("Light Returns...");
                 }
            }

            // Field Inversion Active Logic
            if (this.isInputInverted) {
                this.inversionTimer -= dt;
                if (this.inversionTimer <= 0) {
                     this.isInputInverted = false;
                     this.updateGameStatus("Controls Restored.");
                }
            } else if (this.crisisMode) {
                 // 5-10% chance to happen randomly?
                 // Let's check every 5 seconds
                 if (Math.floor(this.gameTime * 10) % 50 === 0) { // roughly every 5s
                      if (Math.random() < 0.02 && !(this.finalBoss instanceof AfterimageBoss)) { // very low chance per check to average out
                          this.isInputInverted = true;
                          this.inversionTimer = 3;
                          this.updateGameStatus("⚠️ FIELD INVERSION! CONTROLS FLIPPED! ⚠️");
                          audioManager.playSound('finalbossWarning');
                      }
                 }
                 
                 // CHAOS TARGET LOCK (Every 45s) - Blocked by Afterimage Boss
                 if (vTime >= this.nextChaosCheck) {
                      this.nextChaosCheck += 45;
                      
                      // Gather all allies (EXCEPT Echo and Vamp as per Design Doc)
                      const allies = [];
                      if (!(this.finalBoss instanceof AfterimageBoss)) {
                          allies.push(...this.player.allies);
                          if (this.laserAlly) allies.push(this.laserAlly);
                      }
                      // Echo and Vamp allies are immune to Chaos Target Lock
                      
                      if (allies.length > 0) {
                           const victim = allies[Math.floor(Math.random() * allies.length)];
                           if (victim) {
                                victim.isConfused = true;
                                victim.confusedTimer = 10; // 10s confusion
                                this.updateGameStatus("⚠️ ALLY SYSTEM HACKED! CHAOS MODE! ⚠️");
                                audioManager.playSound('finalbossWarning');
                           }
                      }
                 }
            }

        } else {
            UI.voidBarrierContainer.style.display = 'none';
            this.isDarknessActive = false;
            this.isDriftActive = false;
            this.isInputInverted = false;
        }

        // Update Game Objects
        this.player.update(this, dt);
        this.player.draw(this);
        this.player.allies.forEach(p => p.update(this, dt));
        if (this.laserAlly) this.laserAlly.update(this, dt);
        if (this.echoAlly) this.echoAlly.update(this, dt);
        if (this.echoAlly2) this.echoAlly2.update(this, dt);
        if (this.vampAlly) this.vampAlly.update(this, dt);

        this.coolants.forEach((c, i) => {
             c.update(dt);
             if (c.y > UI.canvas.height) this.coolants.splice(i, 1);
        });

        // VOID SKILL UPDATES & UI COOLDOWN (Triggered at 100s, unrelated to Behemoth)
        let skillText = null;
        if (this.selectedSkill) {
            const skill = this.voidSkills[this.selectedSkill];
            if (this.selectedSkill === 'noHeatMode') {
                if (skill.active) {
                    skillText = `ACTIVE (${Math.ceil(skill.timer)}s)`;
                } else {
                    const cooldownLeft = Math.max(0, skill.cooldown - (this.gameTime - skill.lastUsed));
                    if (cooldownLeft > 0) skillText = `Cooldown: ${Math.ceil(cooldownLeft)}s`;
                    else skillText = "🔥 NO HEAT";
                }
            } else if (this.selectedSkill === 'ultimateBarrage') {
                const cooldownLeft = Math.max(0, skill.cooldown - (this.gameTime - skill.lastUsed));
                if (cooldownLeft > 0) skillText = `Cooldown: ${Math.ceil(cooldownLeft)}s`;
                else skillText = "🚀 BARRAGE";
            }
            if (skillText) UI.updateSkillButton(skillText);
        }

        if (this.voidSkills.noHeatMode.active) {
            this.voidSkills.noHeatMode.timer -= dt;
            if (this.voidSkills.noHeatMode.timer <= 0) {
                this.voidSkills.noHeatMode.active = false;
                this.updateGameStatus("No Heat Mode Ended!");
            }
        }

        // VOID MODE 100s TRIGGER
        if (this.finalBossDefeated && this.getVoidTime() >= 100 && !this.selectedSkill && !this.isPaused) {
             this.showVoidSkillSelection();
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(this, dt);
            
            // CLEANUP LOGIC: Expired or Off-screen
            if (p.y < 0 || p.y > UI.canvas.height || p.x < 0 || p.x > UI.canvas.width) {
                this.removeProjectile(i);
            }
        }
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];

            // Special Logic for persistent projectiles (Bomb, Rift)
            if (p instanceof BehemothBomb || p instanceof VoidRift) {
                if (p.update(this, dt)) {
                    this.enemyProjectiles.splice(i, 1);
                    continue;
                }
            } else {
                p.update(this, dt);
            }

            if (p.y < 0 || p.y > UI.canvas.height || p.x < 0 || p.x > UI.canvas.width) {
                this.enemyProjectiles.splice(i, 1);
                // Note: enemyProjectiles might also be pooled if they are standard Projectiles
                if (p instanceof Projectile) {
                    this.projectilePool.release(p);
                }
            }
        }
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const a = this.asteroids[i];
            a.update(this, dt);
            
            // Boundary Check
            if (a.y > UI.canvas.height + a.size) {
                // ORBITER FIX: Don't kill orbiter if it's orbiting (it might dip below screen)
                if (a.type === 'orbiter' && a.isOrbiting) {
                    continue;
                }

                // VOID BARRIER DAMAGE (Only active AFTER Behemoth is defeated)
                if (this.behemothDefeated) {
                     let damage = 1;
                     // Spec says: "Quái nhỏ/Asteroid: -1 HP. Quái to (Tanker, Elite): -5 HP."
                     
                     if (['tanker', 'bulwark', 'sizzler', 'behemoth', 'boss'].includes(a.type) || a.isBoss) {
                         damage = 5;
                     }
                     
                     if (a.isElite) {
                         // Design says "Quái to (Tanker, Elite): -5 HP" BUT also "Elite Variants... gây x2 Sát thương lên Barrier"
                         // This implies Elite Base Damage is high, or it doubles the base.
                         // Let's interpret: Elite always deals significant damage. 
                         // If it's a small elite, does it deal 1*2=2? Or 5?
                         // "Quái to (Tanker, Elite): -5 HP" suggests Elite IS considered "Quái to".
                         // "Effect: ... gây x2 Sát thương". 
                         // So maybe Elite = 5 HP (base) * 2 = 10 HP? 
                         // Or just 5HP? 
                         // Let's go with: Base Damage (1 or 5) * 2 if Elite.
                         // Actually "Quái to (Tanker, Elite): -5 HP" seems to define the base class.
                         // And "Effect: ... gây x2 Sát thương" might be redundant or stacking.
                         // Let's implement: Big=5, Small=1. If Elite, multiply by 2.
                         
                         // Re-eval: If a small scout is Elite, is it "Quái to"? Probably.
                         // Let's stick to: If Elite, it hits for 10 (5*2).
                         damage = 10;
                     } else if (['tanker', 'bulwark', 'sizzler', 'behemoth', 'boss'].includes(a.type) || a.isBoss) {
                         damage = 5;
                     }

                     this.takeBarrierDamage(damage);
                     
                     // Visual feedback for barrier hit
                     this.createExplosion(a.x, UI.canvas.height, '#ff0000', 10);
                     audioManager.playSound('playerHit', 0.5); // Re-use hit sound
                }

                if (a.isBoss && a !== this.finalBoss && a.type !== 'behemoth') {
                    this.isBossActive = false;
                    this.handleGameOver("Boss escaped!");
                    break;
                } else if (a.type !== 'behemoth') {
                    this.asteroids.splice(i, 1);
                }
            }
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(this, dt);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                this.particlePool.release(p);
            }
        }

        if (!this.isGameOver) {
            this.collisionSystem.checkCollisions();
            for (let j = this.asteroids.length - 1; j >= 0; j--) {
                const asteroid = this.asteroids[j];
                if (asteroid.health <= 0) {
                    this.handleAsteroidDestruction(asteroid, j);
                }
            }
            this.updateHUD();
            this.upgradeSystem.checkUpgrades();
        }
    }

    getVoidTime() {
        return Math.max(0, this.gameTime - this.voidStartTime);
    }
    
    draw() {
        UI.ctx.save();
        if (this.screenShakeDuration > 0) {
            const dx = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
            const dy = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
            UI.ctx.translate(dx, dy);
            this.screenShakeDuration--;
        }

        UI.ctx.clearRect(-UI.canvas.width, -UI.canvas.height, UI.canvas.width * 2, UI.canvas.height * 2);

        this.player.draw(this);
        this.player.allies.forEach(p => p.draw());
        if (this.laserAlly) this.laserAlly.draw();
        if (this.echoAlly) this.echoAlly.draw(this);
        if (this.echoAlly2) this.echoAlly2.draw(this);
        if (this.vampAlly) this.vampAlly.draw(this);
        
        this.coolants.forEach(c => c.draw());

        this.projectiles.forEach(p => p.draw());
        this.enemyProjectiles.forEach(p => p.draw());
        this.asteroids.forEach(a => a.draw(this)); // Pass game for shield checking
        this.particles.forEach(p => p.draw());

        if (this.isAimUnlocked) {
            UI.ctx.save();
            UI.ctx.strokeStyle = '#00ff00';
            UI.ctx.lineWidth = 2;
            UI.ctx.beginPath();
            UI.ctx.arc(this.mousePos.x, this.mousePos.y, 10, 0, Math.PI * 2);
            UI.ctx.stroke();
            UI.ctx.restore();
        }
        
        // DRIFT OVERLAY (Orange Tint)
        if (this.isDriftActive) {
            UI.ctx.save();
            UI.ctx.fillStyle = 'rgba(255, 165, 0, 0.2)'; // Orange
            UI.ctx.fillRect(-UI.canvas.width, -UI.canvas.height, UI.canvas.width * 2, UI.canvas.height * 2);
            
            // Wind effect particles?
            UI.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            for(let i=0; i<20; i++) {
                const rx = Math.random() * UI.canvas.width;
                const ry = Math.random() * UI.canvas.height;
                UI.ctx.fillRect(rx, ry, 20, 2);
            }
            UI.ctx.restore();
        }

        if (this.flashDuration > 0) {
            UI.ctx.globalAlpha = this.flashDuration / 10;
            UI.ctx.fillStyle = 'white';
            UI.ctx.fillRect(-UI.canvas.width, -UI.canvas.height, UI.canvas.width * 2, UI.canvas.height * 2);
            this.flashDuration--;
        }

        // DARKNESS OVERLAY
        if (this.isDarknessActive) {
             // Create a temporary canvas for the mask
             // Or simpler: Fill black, use composite operation 'destination-out' to cut holes
             UI.ctx.save();
             UI.ctx.fillStyle = 'black';
             UI.ctx.globalAlpha = 0.95;
             UI.ctx.fillRect(-UI.canvas.width, -UI.canvas.height, UI.canvas.width * 2, UI.canvas.height * 2);
             
             UI.ctx.globalCompositeOperation = 'destination-out';
             
             // Cut hole for Player
             const drawLight = (x, y, r) => {
                 const grad = UI.ctx.createRadialGradient(x, y, 0, x, y, r);
                 grad.addColorStop(0, 'rgba(0,0,0,1)');
                 grad.addColorStop(1, 'rgba(0,0,0,0)');
                 UI.ctx.fillStyle = grad;
                 UI.ctx.beginPath();
                 UI.ctx.arc(x, y, r, 0, Math.PI * 2);
                 UI.ctx.fill();
             };

             if (this.player && !this.player.isDestroyed) {
                 drawLight(this.player.x, this.player.y, 150);
             }
             
             this.player.allies.forEach(a => drawLight(a.x, a.y, 100));
             if (this.laserAlly) drawLight(this.laserAlly.x, this.laserAlly.y, 100);
             if (this.echoAlly) drawLight(this.echoAlly.x, this.echoAlly.y, 100);
             if (this.echoAlly2) drawLight(this.echoAlly2.x, this.echoAlly2.y, 100);
             if (this.vampAlly) drawLight(this.vampAlly.x, this.vampAlly.y, 80);

             // Projectiles glow in dark
             this.projectiles.forEach(p => drawLight(p.x, p.y, 40));

             UI.ctx.restore();
        }

        UI.ctx.restore();

        if (this.isFinalBossActive && this.finalBoss) {
            UI.finalBossHealthBar.style.width = `${Math.max(0, (this.finalBoss.health / this.finalBoss.maxHealth) * 100)}%`;
        }
    }









    
    removeProjectile(index) {
        const p = this.projectiles[index];
        if (p) {
            this.projectiles.splice(index, 1);
            this.projectilePool.release(p);
        }
    }

    handleAsteroidDestruction(asteroid, index) {
        if (asteroid === this.finalBoss) {
            if (this.finalBoss && !this.finalBoss.isDefeated) {
                
                // Distinguish between Initial FinalBoss and Void Monolith
                if (asteroid instanceof FinalBoss) {
                    // INITIAL FINAL BOSS DEFEATED
                    audioManager.playSound('finalbossExplosion', 1.0);
                    this.finalBoss.isDefeated = true;
                    this.finalBossDefeated = true; 
                    this.score += 5000;
                    this.isFinalBossActive = false;
                    UI.finalBossHealthContainer.style.display = 'none';
                    
                    // UNLOCK AIM MODE & VOID MODE
                    this.isAimUnlocked = true;
                    this.updateGameStatus('FINAL BOSS DEFEATED! VOID MODE UNLOCKED!');
                    UI.heatGroup.style.display = 'flex'; // Show Heat Bar
                    
                    // VOID TIME RESET (Only here!)
                    this.voidStartTime = this.gameTime;
                    UI.timerLabel.innerText = "Void Time";

                    this.upgradePoints += 10;
                    this.player.shieldCharges += 5;
                    this.screenShakeDuration = 60;
                    this.screenShakeIntensity = 20;
                    
                    this.echoAlly = new EchoAlly();
                    this.updateGameStatus("Echo Ally Acquired!");

                    if (!this.upgradeSystem.areAllUpgradesMaxed()) {
                        this.isAutoUpgradeEnabled ? this.upgradeSystem.autoUpgradeAllies() : this.upgradeSystem.showUpgradeModal();
                    }
                } else if (asteroid instanceof Monolith) {
                     // MONOLITH DEFEATED - TRIGGER CRISIS MODE
                     audioManager.playSound('finalbossExplosion', 1.0);
                     this.isFinalBossActive = false;
                     UI.finalBossHealthContainer.style.display = 'none';
                     
                     this.crisisMode = true; // ACTIVATE CRISIS
                     
                     this.updateGameStatus('CRISIS MODE: FIVE MINUTES OF HELL', false);
                     // Set Barrier Cap done in update loop
                     this.voidBarrierHealth = Math.min(this.voidBarrierHealth, 50);

                     this.screenShakeDuration = 100;
                     this.screenShakeIntensity = 25;
                     
                     // Reward?
                     this.score += 10000;
                } else if (asteroid instanceof AfterimageBoss) {
                     // AFTERIMAGE DEFEATED
                     audioManager.playSound('finalbossExplosion', 1.0);
                     this.isFinalBossActive = false;
                     UI.finalBossHealthContainer.style.display = 'none';
                     this.updateGameStatus("AFTERIMAGE SHATTERED! ABYSS AWAITS...");
                     this.score += 50000;
                     // Logic for Abyss Mode would go here if implemented
                }

                this.createExplosion(asteroid.x, asteroid.y, asteroid.color, 400);
                this.asteroids.splice(index, 1);
                this.finalBoss = null;
            }
        } else {
            this.createExplosion(asteroid.x, asteroid.y, asteroid.color, asteroid.size);
            this.asteroids.splice(index, 1);
            
            // ANCHOR DEATH LOGIC
            if (asteroid.type === 'anchor' && asteroid.anchorTarget) {
                 const target = asteroid.anchorTarget;
                 if (target && this.asteroids.includes(target)) {
                     target.protectedBy = null;
                     // Request: "lose 50% max HP immediately"
                     const damage = target.maxHealth * 0.5;
                     target.health -= damage;

                     this.createExplosion(target.x, target.y, '#ff0000', 20); // Big red hit
                     this.updateGameStatus("Anchor Destroyed! Shield Down!");
                 }
            }

            // BEHEMOTH REWARD: Vamp Ally & UNLOCK Extended
            if (asteroid.type === 'behemoth') {
                 this.behemothDefeated = true; // UNLOCK VOID MODE EXTENDED
                 this.vampAlly = new VampAlly();
                 this.updateGameStatus("BEHEMOTH DESTROYED! THE EXTENDED OPENS...");
                 audioManager.playSound('AIupgraded');
                 
                 // Show Barrier Immediately
                 UI.voidBarrierContainer.style.display = 'block';
            }

            // VAMP ALLY PASSIVE (Heal Barrier)
            if (this.vampAlly) {
                 // Buff: 100% chance during Crisis, 20% otherwise
                 let healChance = 0.20;
                 if (this.crisisMode) healChance = 1.0;

                 if (Math.random() < healChance) {
                     if (this.voidBarrierHealth < this.maxVoidBarrierHealth) {
                          this.voidBarrierHealth = Math.min(this.maxVoidBarrierHealth, this.voidBarrierHealth + 1);
                          // Visual Feedback
                          UI.voidBarrierBar.style.boxShadow = `0 0 20px #00ff00`;
                          setTimeout(() => UI.voidBarrierBar.style.boxShadow = '', 200);
                     }
                 }
            }

            // Drop Coolant (10% chance from Void Enemies)
            if (['orbiter', 'weaver', 'bulwark'].includes(asteroid.type) && Math.random() < 0.1) {
                this.coolants.push(new Coolant(asteroid.x, asteroid.y));
            }

            if (asteroid.isBoss) {
                this.score += 250;
                this.isBossActive = false;
                this.updateGameStatus('Boss defeated!');
                this.upgradePoints++;
            } else {
                audioManager.playSound('enemyDefeated', 0.3);
                this.score += 10;
                if (asteroid.type === 'splitter') {
                    this.asteroids.push(new Asteroid(this, { type: 'standard', x: asteroid.x - 10, y: asteroid.y, size: 15 }));
                    this.asteroids.push(new Asteroid(this, { type: 'standard', x: asteroid.x + 10, y: asteroid.y, size: 15 }));
                }
            }
        }
        UI.updateUpgradePoints(this.upgradePoints);
    }

    handleGameOver(reason) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        
        audioManager.playSound('PlayerDead');
        audioManager.stopAllLoopingSounds();
        audioManager.playMenuMusic();

        this.player.isDestroyed = true;
        this.player.allies.forEach(ally => ally.isRetreating = true);
        if (this.laserAlly) this.laserAlly.isRetreating = true;
        if (this.vampAlly) this.vampAlly.isRetreating = true;

        this.screenShakeDuration = 30;
        this.screenShakeIntensity = 10;
        this.flashDuration = 10;
        this.createExplosion(this.player.x, this.player.y, '#ff4500', 100);

        this.updateGameStatus("Game Over!", false);
        UI.showMessage("Game Over!", `${reason} Your Score: ${this.score}`);
    }



    createExplosion(x, y, color, count = 20) {
        for (let i = 0; i < count; i++) {
            const p = this.particlePool.get({ x, y, color });
            this.particles.push(p);
        }
    }





    updateHUD() {
        UI.scoreDisplay.innerText = `${this.score}`;
        UI.shieldDisplay.innerText = `${this.player.shieldCharges}`;
        const displayTime = this.finalBossDefeated ? this.getVoidTime() : this.gameTime;
        UI.timerDisplay.innerText = `${Math.floor(displayTime)}s`;
        UI.updateUpgradePoints(this.upgradePoints);
        
        // Update Heat Bar
        if (this.player) {
            const heatPercent = (this.player.heat / this.player.maxHeat) * 100;
            UI.heatBar.style.width = `${heatPercent}%`;
            
            if (this.player.isOverheated) {
                UI.overheatText.style.display = 'block';
                UI.heatBar.style.backgroundColor = 'red';
            } else {
                UI.overheatText.style.display = 'none';
                UI.heatBar.style.backgroundColor = ''; // Reset to gradient
            }
        }

        // Update Void Barrier (Only if unlocked)
        if (this.behemothDefeated) {
            const barrierPercent = (this.voidBarrierHealth / this.maxVoidBarrierHealth) * 100;
            UI.voidBarrierBar.style.width = `${Math.max(0, barrierPercent)}%`;
            if (this.voidBarrierHealth < 30) {
                 UI.voidBarrierBar.style.boxShadow = `0 0 15px red`;
                 UI.voidBarrierBar.style.background = `linear-gradient(90deg, red, #800000)`;
            } else {
                 UI.voidBarrierBar.style.boxShadow = `0 0 10px #00ffff`;
                 UI.voidBarrierBar.style.background = `linear-gradient(90deg, #00ffff, #0088ff)`;
            }
        }
    }

    takeBarrierDamage(amount) {
        this.voidBarrierHealth -= amount;
        this.screenShakeDuration = 5;
        
        // CRISIS: Barrier Feedback Shock
        if (this.crisisMode) {
             this.screenShakeDuration = 20; // Stronger shake
             if (this.player && !this.isNoHeatMode) {
                 this.player.heat += 20; // Heat penalty (Nerfed from 30)
                 if (this.player.heat >= this.player.maxHeat) {
                      this.player.isOverheated = true;
                      this.updateGameStatus("BARRIER SHOCK: SYSTEM OVERHEAT!");
                 }
             }
        }

        if (this.voidBarrierHealth <= 0) {
            this.voidBarrierHealth = 0;
            this.handleGameOver("Void Barrier Destroyed! Base Overrun.");
        }
    }

    handleOverload(dt) {
        if (!this.player || this.isPaused || this.isGameOver) return;

        // Track position
        this.playerPositions.push({ x: this.player.x, y: this.player.y, time: this.gameTime });
        
        // Remove old positions (> 3s ago)
        const cutoff = this.gameTime - 3; // 3 seconds threshold
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
                      if (!this.player.isOverheated && !this.isNoHeatMode) {
                           this.player.heat += 50 * dt; // Rapid heat
                           this.updateGameStatus("⚠️ MOVE! OVERLOAD DETECTED! ⚠️", false);
                      }
                 }
            } else {
                this.overloadTimer = 0;
            }
        }
    }

    // ... (Existing helper methods) ...
    updateGameStatus(text, autoFade = true) {
        if (this.statusMessageTimeout) {
            clearTimeout(this.statusMessageTimeout);
        }
        UI.gameStatus.innerText = text;
        UI.gameStatus.style.opacity = '1';

        if (autoFade) {
            this.statusMessageTimeout = setTimeout(() => {
                UI.gameStatus.style.opacity = '0';
            }, 2500);
        }
    }

    // VOID SKILL METHODS
    showVoidSkillSelection() {
        this.isPaused = true;
        UI.showVoidSkillModal((skill) => {
            this.selectVoidSkill(skill);
            UI.hideVoidSkillModal();
            this.isPaused = false;
            this.lastTime = performance.now();
        });
    }

    selectVoidSkill(skill) {
        this.selectedSkill = skill;
        this.updateGameStatus(`Skill Selected: ${skill}`);

        if (skill === 'permanentEcho') {
             this.voidSkills.permanentEcho.acquired = true;
             this.echoAlly2 = new EchoAlly();
             this.updateGameStatus("Second Echo Ally Acquired!");
        }

        // Add skill button to HUD or Key listener
        UI.addSkillButton(skill, () => this.activateSkill());
    }

    activateSkill() {
        const now = this.gameTime;
        const skill = this.selectedSkill;

        if (!skill) return;

        if (skill === 'noHeatMode') {
             if (now - this.voidSkills.noHeatMode.lastUsed >= this.voidSkills.noHeatMode.cooldown) {
                 this.voidSkills.noHeatMode.active = true;
                 this.voidSkills.noHeatMode.timer = this.voidSkills.noHeatMode.duration;
                 this.voidSkills.noHeatMode.lastUsed = now;
                 this.player.heat = 0;
                 this.player.isOverheated = false;
                 this.updateGameStatus("NO HEAT MODE ACTIVATED!");
                 audioManager.playSound('Playerupgraded');
             } else {
                 this.updateGameStatus("Skill on Cooldown!");
             }
        } else if (skill === 'ultimateBarrage') {
             if (now - this.voidSkills.ultimateBarrage.lastUsed >= this.voidSkills.ultimateBarrage.cooldown) {
                 this.voidSkills.ultimateBarrage.lastUsed = now;
                 this.fireUltimateBarrage();
                 this.updateGameStatus("ULTIMATE BARRAGE!");
                 audioManager.playSound('finalbossExplosion');
             } else {
                  this.updateGameStatus("Skill on Cooldown!");
             }
        }
    }

    fireUltimateBarrage() {
        // Ultimate Barrage Buff: Massive Spiral + Random Spread
        const count = 100;
        const playerX = this.player.x;
        const playerY = this.player.y;

        for (let i = 0; i < count; i++) {
            // Spiral Pattern
            const angle = (i / count) * Math.PI * 4; // 2 rotations
            const speed = 12 + Math.random() * 5;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            this.projectiles.push(this.projectilePool.get({
                x: playerX, y: playerY,
                vx, vy,
                size: 8,
                damage: 50,
                color: '#ff00ff',
                source: 'ultimate'
            }));
        }

        this.screenShakeDuration = 60;
        this.screenShakeIntensity = 20;
        this.createExplosion(playerX, playerY, '#ff00ff', 100);

        // Wipe Screen (kill all except bosses)
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const a = this.asteroids[i];
            if (!a.isBoss) {
                 a.health = 0;
                 this.handleAsteroidDestruction(a, i);
            } else {
                if (a instanceof Monolith) {
                     a.takeDamage(500, 'ultimate'); // Monolith absorbs/resists logic inside takeDamage
                } else {
                     a.health -= 500; // Big damage to normal bosses
                }
                this.createExplosion(a.x, a.y, a.color, 50);
            }
        }
    }

    get isNoHeatMode() {
        return this.voidSkills.noHeatMode.active;
    }

    resizeCanvas() {
        UI.canvas.width = window.innerWidth;
        UI.canvas.height = window.innerHeight - 50;
        if (this.player) {
            this.player.x = Math.max(this.player.size, Math.min(UI.canvas.width - this.player.size, this.player.x));
        }
    }




    



    

    

}