import * as UI from './ui.js';
import { Player, Projectile, AIAlly, LaserAlly, EchoAlly, Coolant, Asteroid, FinalBoss, Particle, StaticMine, BehemothTurret } from './classes.js';
import { audioManager } from './audio.js';

export class Game {
    constructor() {
        this.animationFrameId = 0;
        this.keys = {};

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
        this.nextBossTime = 60;
        this.nextShieldScore = 1500;
        this.isBossActive = false;
        this.isFinalBossActive = false;
        this.finalBossWarningShown = false;
        this.finalBossDefeated = false;
        this.finalBoss = null;
        this.laserAlly = null;
        this.echoAlly = null;
        this.echoAlly2 = null;
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

        this.updateHUD();
        this.updateGameStatus('Ready', false);
        UI.finalBossHealthContainer.style.display = 'none';
        UI.heatGroup.style.display = 'none'; // Hide heat bar initially
        UI.timerLabel.innerText = "⏱️"; // Reset timer label
    }

    gameLoop(currentTime) {
        let deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        if (deltaTime > 0.25) deltaTime = 0.25;

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
            this.gameTime += dt;
            this.handleSpawning();
        }

        // Update Game Objects
        this.player.update(this, dt);
        this.player.draw(this);
        this.player.allies.forEach(p => p.update(this, dt));
        if (this.laserAlly) this.laserAlly.update(this, dt);
        if (this.echoAlly) this.echoAlly.update(this, dt);
        if (this.echoAlly2) this.echoAlly2.update(this, dt);

        this.coolants.forEach((c, i) => {
             c.update(dt);
             if (c.y > UI.canvas.height) this.coolants.splice(i, 1);
        });

        // VOID SKILL UPDATES
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
                this.projectiles.splice(i, 1);
            }
        }
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            p.update(this, dt);
            if (p.y < 0 || p.y > UI.canvas.height || p.x < 0 || p.x > UI.canvas.width) {
                this.enemyProjectiles.splice(i, 1);
            }
        }
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const a = this.asteroids[i];
            a.update(this, dt);
            if (a.y > UI.canvas.height + a.size) {
                if (a.isBoss && a !== this.finalBoss && a.type !== 'behemoth') {
                    this.isBossActive = false;
                    this.handleGameOver("Boss escaped!");
                    break;
                } else if (a.type !== 'behemoth') {
                    this.asteroids.splice(i, 1);
                }
            }
        }
        this.particles.forEach((p, i) => { p.update(this, dt); if (p.life <= 0) this.particles.splice(i, 1); });

        if (!this.isGameOver) {
            this.checkCollisions();
            for (let j = this.asteroids.length - 1; j >= 0; j--) {
                const asteroid = this.asteroids[j];
                if (asteroid.health <= 0) {
                    this.handleAsteroidDestruction(asteroid, j);
                }
            }
            this.updateHUD();
            this.checkUpgrades();
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

        if (this.flashDuration > 0) {
            UI.ctx.globalAlpha = this.flashDuration / 10;
            UI.ctx.fillStyle = 'white';
            UI.ctx.fillRect(-UI.canvas.width, -UI.canvas.height, UI.canvas.width * 2, UI.canvas.height * 2);
            this.flashDuration--;
        }
        UI.ctx.restore();

        if (this.isFinalBossActive && this.finalBoss) {
            UI.finalBossHealthBar.style.width = `${Math.max(0, (this.finalBoss.health / this.finalBoss.maxHealth) * 100)}%`;
        }
    }

    handleSpawning() {
        const spawnInterval = Math.max(400, 1200 - Math.floor(this.gameTime) * 10);
        if (performance.now() - this.lastSpawnTime > spawnInterval && !this.isBossActive && !this.isFinalBossActive) {
            
            const enemyType = this.getSpawnType();
            if (enemyType) {
                 this.asteroids.push(new Asteroid(this, { type: enemyType }));
            }
            this.lastSpawnTime = performance.now();
        }
        
        if (this.gameTime >= this.nextBossTime && !this.isBossActive && !this.isFinalBossActive && !this.finalBossDefeated) {
            this.spawnBoss(false);
            this.nextBossTime += 60;
        }

        if (this.gameTime >= 295 && !this.finalBossWarningShown && !this.finalBossDefeated) {
            this.updateGameStatus('!!! FINAL BOSS WARNING !!!');
            audioManager.playSound('finalbossWarning');
            this.finalBossWarningShown = true;
        }

        if (this.gameTime >= 300 && !this.isFinalBossActive && !this.finalBoss && !this.finalBossDefeated) {
            this.spawnBoss(true);
        }

        // VOID MODE BEHEMOTH SPAWN (at 150s Void Time)
        if (this.finalBossDefeated && this.getVoidTime() >= 150 && !this.behemothSpawned) {
             this.asteroids.push(new BehemothTurret(this));
             this.behemothSpawned = true;
             this.isBossActive = true;
        }

        // Override for Behemoth: Allow spawning even if isBossActive, but slower
        if (this.finalBossDefeated && this.behemothSpawned && this.isBossActive) {
             const voidSpawnInterval = 2000; // Slower spawn rate
             if (performance.now() - this.lastSpawnTime > voidSpawnInterval) {
                 const enemyType = this.getSpawnType();
                 if (enemyType) {
                      this.asteroids.push(new Asteroid(this, { type: enemyType }));
                 }
                 this.lastSpawnTime = performance.now();
             }
        }
    }

    getSpawnType() {
        const isVoid = this.finalBossDefeated;
        const t = isVoid ? this.getVoidTime() : this.gameTime;
        const weights = [];

        if (!isVoid) {
            // NORMAL MODE
            if (t < 60) {
                // 0-60s: Intro. Phase-in Seeker.
                weights.push({ type: 'standard', w: 25 });
                weights.push({ type: 'shard', w: 20 });
                weights.push({ type: 'splitter', w: 15 });
                weights.push({ type: 'scout', w: 15 });
                weights.push({ type: 'brute', w: 15 });
                weights.push({ type: 'seeker', w: 10 });
            } else if (t < 120) {
                // 60-120s: Projectile Pressure. Phase-in Shooter, Decrease Scout.
                weights.push({ type: 'standard', w: 20 });
                weights.push({ type: 'shard', w: 15 });
                weights.push({ type: 'splitter', w: 15 });
                weights.push({ type: 'scout', w: 5 });
                weights.push({ type: 'brute', w: 15 });
                weights.push({ type: 'seeker', w: 10 });
                weights.push({ type: 'shooter', w: 20 });
            } else if (t < 180) {
                // 120-180s: Complexity. Phase-in Teleporter. Decrease Standard/Shard.
                weights.push({ type: 'standard', w: 10 });
                weights.push({ type: 'shard', w: 10 });
                weights.push({ type: 'splitter', w: 15 });
                weights.push({ type: 'scout', w: 5 });
                weights.push({ type: 'brute', w: 15 });
                weights.push({ type: 'seeker', w: 15 });
                weights.push({ type: 'shooter', w: 20 });
                weights.push({ type: 'teleporter', w: 10 });
            } else {
                // 180-300s: Pre-Boss. High Seeker/Shooter/Teleporter. Low Brute/Splitter.
                weights.push({ type: 'standard', w: 5 });
                weights.push({ type: 'shard', w: 5 });
                weights.push({ type: 'splitter', w: 5 });
                weights.push({ type: 'scout', w: 5 });
                weights.push({ type: 'brute', w: 5 });
                weights.push({ type: 'seeker', w: 25 });
                weights.push({ type: 'shooter', w: 25 });
                weights.push({ type: 'teleporter', w: 25 });
            }
        } else {
            // VOID MODE
            // Base: Orbiter, Weaver, Bulwark, Teleporter.
            // Phase-in: Juggler, Sizzler, Anchor.
            // Phase-out: Teleporter, Orbiter, Weaver, Bulwark.

            if (t < 60) {
                 // 0-60s V-Time: Base Void Legion.
                 weights.push({ type: 'orbiter', w: 30 });
                 weights.push({ type: 'weaver', w: 30 });
                 weights.push({ type: 'bulwark', w: 30 });
                 weights.push({ type: 'teleporter', w: 10 });
            } else if (t < 120) {
                 // 60-120s V-Time: Phase-in Juggler. Decrease Orbiter.
                 weights.push({ type: 'orbiter', w: 15 });
                 weights.push({ type: 'weaver', w: 30 });
                 weights.push({ type: 'bulwark', w: 30 });
                 weights.push({ type: 'teleporter', w: 10 });
                 weights.push({ type: 'juggler', w: 15 });
            } else if (t < 180) {
                 // 120-180s V-Time: Phase-in Sizzler. Decrease Weaver.
                 weights.push({ type: 'orbiter', w: 15 });
                 weights.push({ type: 'weaver', w: 15 });
                 weights.push({ type: 'bulwark', w: 30 });
                 weights.push({ type: 'teleporter', w: 10 });
                 weights.push({ type: 'juggler', w: 15 });
                 weights.push({ type: 'sizzler', w: 15 }); // Low chance
                 if (t >= 100) weights.push({ type: 'tanker', w: 10 }); // New Enemy (100s+)
            } else {
                 // 180s+ V-Time: Phase-in Anchor. Decrease Bulwark.
                 weights.push({ type: 'orbiter', w: 15 });
                 weights.push({ type: 'weaver', w: 15 });
                 weights.push({ type: 'bulwark', w: 15 });
                 weights.push({ type: 'teleporter', w: 10 });
                 weights.push({ type: 'juggler', w: 15 });
                 weights.push({ type: 'sizzler', w: 15 });
                 weights.push({ type: 'anchor', w: 15 });
                 if (t >= 100) {
                    weights.push({ type: 'tanker', w: 15 });
                    weights.push({ type: 'stunner', w: 15 }); // New Enemy (100s+)
                 }
            }
        }

        // Weighted Random Selection
        const totalWeight = weights.reduce((sum, item) => sum + item.w, 0);
        let random = Math.random() * totalWeight;

        for (const item of weights) {
            random -= item.w;
            if (random <= 0) {
                return item.type;
            }
        }
        return weights.length > 0 ? weights[0].type : 'standard';
    }

    spawnBoss(isFinal) {
        if (isFinal) {
            this.isFinalBossActive = true;
            this.isBossActive = false;
            this.asteroids.forEach(a => this.createExplosion(a.x, a.y, a.color, a.size));
            this.asteroids = [];
            this.enemyProjectiles = [];
            this.finalBoss = new FinalBoss(this);
            this.asteroids.push(this.finalBoss);
            UI.finalBossHealthContainer.style.display = 'block';
            this.updateGameStatus('!!! FINAL BOSS APPEARED !!!');
            this.screenShakeDuration = 120;
            this.screenShakeIntensity = 4;
        } else if (!this.isBossActive && !this.isFinalBossActive) {
            this.asteroids.push(new Asteroid(this, { isBoss: true }));
            this.isBossActive = true;
            this.updateGameStatus('Boss appeared!');
        }
    }


    checkCollisions() {
        // Player vs Asteroids/Enemies
        for (let j = this.asteroids.length - 1; j >= 0; j--) {
            if (this.isGameOver) break;
            const asteroid = this.asteroids[j];
            if (this.checkCollision(this.player, asteroid)) {
                if (this.godMode) return; // God Mode Check

                if (this.player.shieldCharges > 0) {
                    if (asteroid.isBoss) {
                        this.player.shieldCharges = 0;
                        this.handleGameOver("Your shield was destroyed by the boss!");
                    } else {
                        this.player.shieldCharges--;
                        this.createExplosion(asteroid.x, asteroid.y, '#00e5ff', 40);
                        this.asteroids.splice(j, 1);
                    }
                } else {
                    this.handleGameOver("You collided with an asteroid.");
                }
            }
        }

        // Player vs Enemy Projectiles
        for (let j = this.enemyProjectiles.length - 1; j >= 0; j--) {
            const p = this.enemyProjectiles[j];
            if (this.checkCollision(this.player, p)) {
                if (this.godMode) return; // God Mode Check

                if (this.player.shieldCharges > 0) {
                    this.player.shieldCharges--;
                    this.createExplosion(p.x, p.y, '#00e5ff', 20);
                } else {
                    this.handleGameOver("You were hit by a projectile.");
                }
                this.enemyProjectiles.splice(j, 1);
                break;
            }
        }

        // Player vs Coolant
        for (let j = this.coolants.length - 1; j >= 0; j--) {
            const c = this.coolants[j];
            if (this.checkCollision(this.player, c)) {
                this.player.heat = 0;
                this.player.isOverheated = false;
                clearTimeout(this.player.overheatTimeout);
                this.updateGameStatus("Coolant acquired! Weapon Cooled.");
                audioManager.playSound('AIupgraded', 0.5); // Reuse sound
                this.coolants.splice(j, 1);
            }
        }

        // Projectiles vs Enemies
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let hitSomething = false;

            for (let j = this.asteroids.length - 1; j >= 0; j--) {
                if (!this.projectiles[i] || !this.asteroids[j]) continue;
                if (this.checkCollision(this.projectiles[i], this.asteroids[j])) {
                    const asteroid = this.asteroids[j];
                    
                    // TANKER PARRY LOGIC (Small AI Ally projectiles)
                    if (asteroid.type === 'tanker' && this.projectiles[i].source === 'ai_ally') {
                         this.createExplosion(this.projectiles[i].x, this.projectiles[i].y, '#888', 5); // Grey spark
                         this.projectiles.splice(i, 1);
                         hitSomething = true;
                         break;
                    }

                    // BULWARK SHIELD LOGIC
                    if (asteroid.type === 'bulwark') {
                        // Better: If player is below bulwark (y > asteroid.y), shield blocks.
                        // Flank = get above it.
                        if (this.player.y > asteroid.y) {
                            this.createExplosion(this.projectiles[i].x, this.projectiles[i].y, '#00e5ff', 5); // Blue spark
                            this.projectiles.splice(i, 1);
                            hitSomething = true;
                            break;
                        }
                    }


                    this.createExplosion(asteroid.x, asteroid.y, asteroid.color, 5);

                    let damage = this.projectiles[i].damage;

                    // VOID MODE GLOBAL DAMAGE BUFF (x2) - STARTS AT 100s+
                    if (this.finalBossDefeated && this.getVoidTime() >= 100) damage *= 2;

                    asteroid.health -= damage;

                    // ANCHOR PROTECTION LOGIC
                    if (asteroid.protectedBy && asteroid.health <= 1) {
                         asteroid.health = 1;
                         this.createExplosion(asteroid.x, asteroid.y, '#ffffff', 2); // White shield sparks
                    }

                    this.projectiles.splice(i, 1);
                    hitSomething = true;
                    break;
                }
            }
            if (hitSomething) continue;
        }
    }

    handleAsteroidDestruction(asteroid, index) {
        if (asteroid === this.finalBoss) {
            if (this.finalBoss && !this.finalBoss.isDefeated) {
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
                
                // VOID TIME RESET
                this.voidStartTime = this.gameTime;
                UI.timerLabel.innerText = "Void Time";

                this.upgradePoints += 10;
                this.player.shieldCharges += 5;
                this.screenShakeDuration = 60;
                this.screenShakeIntensity = 20;
                this.createExplosion(asteroid.x, asteroid.y, asteroid.color, 400);
                this.asteroids.splice(index, 1);
                this.finalBoss = null;
                
                // Grant ECHO Ally instead of Prism
                this.echoAlly = new EchoAlly();
                this.updateGameStatus("Echo Ally Acquired!");

                // Upgrade modal if needed, but Skill Selection comes later at 100s
                if (!this.areAllUpgradesMaxed()) {
                    this.isAutoUpgradeEnabled ? this.autoUpgradeAllies() : this.showUpgradeModal();
                }

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

        this.screenShakeDuration = 30;
        this.screenShakeIntensity = 10;
        this.flashDuration = 10;
        this.createExplosion(this.player.x, this.player.y, '#ff4500', 100);

        this.updateGameStatus("Game Over!", false);
        UI.showMessage("Game Over!", `${reason} Your Score: ${this.score}`);
    }

    checkCollision(obj1, obj2) {
        if (!obj1 || !obj2 || (obj1 instanceof Player && obj1.isDestroyed)) return false;
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.hypot(dx, dy);
        const collisionDistance = (obj1.size + obj2.size) * 0.8;
        return distance < collisionDistance;
    }

    createExplosion(x, y, color, count = 20) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    triggerAllyUpgradeEffect(ally) {
        this.createExplosion(ally.x, ally.y, '#ffd700', 30);
    }

    checkUpgrades() {
        if (this.score >= 250 && this.player.projectileSize < 7) {
            this.player.projectileSize = 7;
            this.player.projectileDamage = 2;
            this.updateGameStatus('Upgrade! Larger Bullets!');
            audioManager.playSound('Playerupgraded');
        }
        if (this.score >= 500 && this.player.fireRate < 2) {
            this.player.fireRate = 2;
            this.updateGameStatus('Upgrade! Double Shot!');
            audioManager.playSound('Playerupgraded');
        }
        if (this.score >= 2000 && this.player.allies.length === 0) {
            this.player.allies.push(new AIAlly('left'));
            this.player.allies.push(new AIAlly('right'));
            this.updateGameStatus('Upgrade! AI Allies!');
            audioManager.playSound('Playerupgraded', 0.8);
        }
        if (this.score >= 5000 && !this.laserAlly) {
            this.laserAlly = new LaserAlly();
            this.laserAlly.applyUpgrades(this);
            this.updateGameStatus('Laser Ally joined the battle!');
            audioManager.playSound('Playerupgraded', 0.8);
        }
        if (this.score >= this.nextShieldScore) {
            this.player.shieldCharges += 3;
            this.nextShieldScore += 1500;
            this.updateGameStatus('Shield Recharged!');
            audioManager.playSound('Playerupgraded');
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
        // Clear screen logic or massive damage
        // Let's spawn 50 projectiles in all directions
        const count = 50;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = 10;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            this.projectiles.push(new Projectile(this.player.x, this.player.y, {
                vx, vy,
                size: 8,
                damage: 50, // Massive damage
                color: '#fff'
            }));
        }
        // Also wipe small enemies
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const a = this.asteroids[i];
            if (!a.isBoss) {
                 a.health -= 50;
                 if (a.health <= 0) this.handleAsteroidDestruction(a, i);
            }
        }
        this.screenShakeDuration = 30;
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

    showUpgradeModal() {
        this.isPaused = true;
        this.updateUpgradeModalUI();
        UI.upgradeModal.classList.add('visible');
    }

    hideUpgradeModal() {
        UI.upgradeModal.classList.remove('visible');
        this.isPaused = false;
        this.lastTime = performance.now();
        this.lastSpawnTime = performance.now();
    }
    
    updateUpgradeModalUI() {
        UI.updateUpgradeModal(this.upgradePoints, this.allyUpgrades, !!this.laserAlly);
    }

    areAllUpgradesMaxed() {
        return this.allyUpgrades.fireRateLevel >= 5 &&
               this.allyUpgrades.hasDoubleShot &&
               this.allyUpgrades.hasFasterProjectiles &&
               (!this.laserAlly || (this.allyUpgrades.laserDamageLevel >= 5 && this.allyUpgrades.laserCooldownLevel >= 5));
    }
    
    autoUpgradeAllies() {
        let upgraded = false;
        while (this.upgradePoints > 0 && !this.areAllUpgradesMaxed()) {
             if (this.allyUpgrades.fireRateLevel < 5 && this.upgradePoints >= 1) {
                this.upgradeAlly('firerate'); upgraded = true;
            } else if (!this.allyUpgrades.hasDoubleShot && this.upgradePoints >= 1) {
                this.upgradeAlly('doubleshot'); upgraded = true;
            } else if (!this.allyUpgrades.hasFasterProjectiles && this.upgradePoints >= 1) {
                this.upgradeAlly('projectilespeed'); upgraded = true;
            } else if (this.laserAlly && this.allyUpgrades.laserDamageLevel < 5 && this.upgradePoints >= 3) {
                this.upgradeAlly('laserDamage'); upgraded = true;
            } else if (this.laserAlly && this.allyUpgrades.laserCooldownLevel < 5 && this.upgradePoints >= 4) {
                 this.upgradeAlly('laserCooldown'); upgraded = true;
            } else {
                break;
            }
        }
    }
    
    upgradeAlly(type) {
        let cost = 0;
        switch (type) {
            case 'firerate': cost = 1; if (this.allyUpgrades.fireRateLevel < 5) { this.upgradePoints -= cost; this.allyUpgrades.fireRateLevel++; } break;
            case 'doubleshot': cost = 1; if (!this.allyUpgrades.hasDoubleShot) { this.upgradePoints -= cost; this.allyUpgrades.hasDoubleShot = true; } break;
            case 'projectilespeed': cost = 1; if (!this.allyUpgrades.hasFasterProjectiles) { this.upgradePoints -= cost; this.allyUpgrades.hasFasterProjectiles = true; } break;
            case 'laserDamage': cost = 3; if (this.allyUpgrades.laserDamageLevel < 5) { this.upgradePoints -= cost; this.allyUpgrades.laserDamageLevel++; } break;
            case 'laserCooldown': cost = 4; if (this.allyUpgrades.laserCooldownLevel < 5) { this.upgradePoints -= cost; this.allyUpgrades.laserCooldownLevel++; } break;
        }

        if (cost > 0) {
             audioManager.playSound('AIupgraded');
        }

        if (type.startsWith('laser')) {
            if (this.laserAlly) { this.laserAlly.applyUpgrades(this); this.triggerAllyUpgradeEffect(this.laserAlly); }
        } else {
            this.player.allies.forEach(ally => this.triggerAllyUpgradeEffect(ally));
        }
    }
}