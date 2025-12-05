import * as UI from './ui.js';
import { Player, Projectile, AIAlly, LaserAlly, PrismAlly, Coolant, Asteroid, FinalBoss, Particle, StaticMine } from './classes.js';
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
        this.deltaTime = 0;
        this.lastTime = 0;
        this.nextBossTime = 0;
        this.lastSpawnTime = 0;
        this.nextShieldScore = 0;
        this.upgradePoints = 0;
        this.allyUpgrades = {};
        this.laserAlly = null;
        this.prismAlly = null; // New Ally
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
        this.prismAlly = null;
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

        this.updateHUD();
        this.updateGameStatus('Ready', false);
        UI.finalBossHealthContainer.style.display = 'none';
        UI.heatGroup.style.display = 'none'; // Hide heat bar initially
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
        if (this.prismAlly) this.prismAlly.update(this, dt);

        this.coolants.forEach((c, i) => {
             c.update(dt);
             if (c.y > UI.canvas.height) this.coolants.splice(i, 1);
        });

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(this, dt);
            
            // CLEANUP LOGIC: Expired or Off-screen
            if (p.y < 0 || p.y > UI.canvas.height || p.x < 0 || p.x > UI.canvas.width || (p.isHoming && p.lifespan <= 0)) {
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
                if (a.isBoss && a !== this.finalBoss) {
                    this.isBossActive = false;
                    this.handleGameOver("Boss escaped!");
                    break;
                } else {
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
        if (this.prismAlly) this.prismAlly.draw();
        
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
            
            // Post-Game Spawning Logic
            if (this.isAimUnlocked && this.finalBossDefeated) {
                const rand = Math.random();
                // THE VOID SPAWNING
                if (rand < 0.25) {
                    this.asteroids.push(new Asteroid(this, { type: 'orbiter' }));
                } else if (rand < 0.45) {
                    this.asteroids.push(new Asteroid(this, { type: 'weaver' }));
                } else if (rand < 0.55) {
                    this.asteroids.push(new Asteroid(this, { type: 'bulwark' }));
                } else if (rand < 0.65) {
                     this.asteroids.push(new Asteroid(this, { type: 'teleporter' }));
                } else {
                    this.asteroids.push(new Asteroid(this));
                }
            } else {
                this.asteroids.push(new Asteroid(this));
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

        // Projectiles vs Enemies/Prism
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let hitSomething = false;

            // Check Collision with Prism Ally
            if (this.prismAlly && this.checkCollision(this.projectiles[i], this.prismAlly) && !this.projectiles[i].isHoming) {
                this.createExplosion(this.prismAlly.x, this.prismAlly.y, '#e500ff', 5);
                this.prismAlly.onHit(); // Trigger visuals
                
                // --- PRISM 2.0 UPDATE: THE SWARM ---
                const swarmCount = 6; // Double the original amount
                for(let k=0; k < swarmCount; k++) {
                    const angle = (Math.PI * 2 / swarmCount) * k;
                    // Initial explosion velocity
                    const vx = Math.cos(angle) * 8;
                    const vy = Math.sin(angle) * 8;
                    
                    this.projectiles.push(new Projectile(this.prismAlly.x, this.prismAlly.y, {
                        vx: vx, vy: vy, color: '#e500ff', isHoming: true, size: 4
                    }));
                }
                // ------------------------------------
                
                this.projectiles.splice(i, 1);
                continue; 
            }

            for (let j = this.asteroids.length - 1; j >= 0; j--) {
                if (!this.projectiles[i] || !this.asteroids[j]) continue;
                if (this.checkCollision(this.projectiles[i], this.asteroids[j])) {
                    const asteroid = this.asteroids[j];
                    
                    // BULWARK SHIELD LOGIC
                    if (asteroid.type === 'bulwark') {
                        // Very rough check: Shield blocks shots from "below/front" relative to asteroid
                        // Assuming Bulwark faces player, and players are usually below enemies
                        // Simple angle check: Is projectile hitting the bottom half?
                        
                        // Let's refine: Block hits that are hitting the 'shield' arc
                        // Shield is drawn from -PI/2 to PI/2 (relative to rotation towards player)
                        // This logic is complex for simple box collision.
                        // Simplified: Bullet is blocked if collision happens "between" Bulwark and Player.
                        // But let's just use a random chance for now to simulate deflection if hitting from front.
                        
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
                    asteroid.health -= this.projectiles[i].damage;
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
                
                this.upgradePoints += 10;
                this.player.shieldCharges += 5;
                this.screenShakeDuration = 60;
                this.screenShakeIntensity = 20;
                this.createExplosion(asteroid.x, asteroid.y, asteroid.color, 400);
                this.asteroids.splice(index, 1);
                this.finalBoss = null;
                
                // Grant Prism Ally
                this.prismAlly = new PrismAlly(this);
                this.updateGameStatus("Prism Ally Acquired!");

                if (!this.areAllUpgradesMaxed()) {
                    this.isAutoUpgradeEnabled ? this.autoUpgradeAllies() : this.showUpgradeModal();
                }
            }
        } else {
            this.createExplosion(asteroid.x, asteroid.y, asteroid.color, asteroid.size);
            this.asteroids.splice(index, 1);
            
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
        UI.timerDisplay.innerText = `${Math.floor(this.gameTime)}s`;
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