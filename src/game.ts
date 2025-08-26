import * as UI from './ui.js';
import { Player, Projectile, AIAlly, LaserAlly, Asteroid, FinalBoss, Particle } from './classes.js';
import { audioManager } from './audio.js';

type AllyUpgradeType = 'firerate' | 'doubleshot' | 'projectilespeed' | 'laserDamage' | 'laserCooldown';

export class Game {
    // Game State Variables
    player: Player;
    projectiles: Projectile[];
    enemyProjectiles: Projectile[];
    asteroids: Asteroid[];
    particles: Particle[];
    score: number;
    gameTime: number;
    deltaTime: number;
    lastTime: number;
    nextBossTime: number;
    lastSpawnTime: number;
    nextShieldScore: number;
    upgradePoints: number;
    allyUpgrades: {
        fireRateLevel: number;
        hasDoubleShot: boolean;
        hasFasterProjectiles: boolean;
        laserDamageLevel: number;
        laserCooldownLevel: number;
    };
    laserAlly: LaserAlly | null;
    finalBoss: FinalBoss | null;
    isBossActive: boolean;
    isFinalBossActive: boolean;
    isGameOver: boolean;
    isPaused: boolean;
    isAutoUpgradeEnabled: boolean;
    finalBossWarningShown: boolean;
    finalBossDefeated: boolean;
    animationFrameId: number;
    screenShakeDuration: number;
    screenShakeIntensity: number;
    flashDuration: number;
    private statusMessageTimeout: number | null = null;
    keys: Record<string, boolean> = {};

    constructor() {
        this.animationFrameId = 0;
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

        this.updateHUD();
        this.updateGameStatus('Sẵn sàng', false);
        UI.finalBossHealthContainer.style.display = 'none';
    }

    gameLoop(currentTime: number) {
        let deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Cap deltaTime to prevent massive jumps when tab is refocused
        if (deltaTime > 0.25) {
            deltaTime = 0.25;
        }

        if (this.isPaused) {
            this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
            return;
        }
        
        this.update(deltaTime);
        this.draw();
        
        this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    }
    
    update(dt: number) {
        if (!this.isGameOver) {
            this.gameTime += dt;
            this.handleSpawning();
        }

        // Update Game Objects
        this.player.update(this, dt);
        this.player.allies.forEach(p => p.update(this, dt));
        if (this.laserAlly) this.laserAlly.update(this, dt);

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(this, dt);
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
                if (a.isBoss && a !== this.finalBoss) {
                    this.isBossActive = false;
                    this.handleGameOver("Boss đã trốn thoát!");
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

        this.player.draw();
        this.player.allies.forEach(p => p.draw());
        if (this.laserAlly) this.laserAlly.draw();
        this.projectiles.forEach(p => p.draw());
        this.enemyProjectiles.forEach(p => p.draw());
        this.asteroids.forEach(a => a.draw());
        this.particles.forEach(p => p.draw());

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
        // Regular Asteroids
        const spawnInterval = Math.max(400, 1200 - Math.floor(this.gameTime) * 10);
        if (performance.now() - this.lastSpawnTime > spawnInterval && !this.isBossActive && !this.isFinalBossActive) {
            this.asteroids.push(new Asteroid(this));
            this.lastSpawnTime = performance.now();
        }
        // Regular Boss
        if (this.gameTime >= this.nextBossTime && !this.isBossActive && !this.isFinalBossActive) {
            this.spawnBoss(false);
            this.nextBossTime += 60;
        }

        // Final Boss Warning & Arrival
        if (this.gameTime >= 295 && !this.finalBossWarningShown) {
            this.updateGameStatus('!!! Cảnh Báo Boss Cuối !!!');
            audioManager.playSound('finalbossWarning');
            this.finalBossWarningShown = true;
        }

        if (this.gameTime >= 300 && !this.isFinalBossActive && !this.finalBoss && !this.finalBossDefeated) {
            this.spawnBoss(true);
        }
    }

    spawnBoss(isFinal: boolean) {
        if (isFinal) {
            this.isFinalBossActive = true;
            this.isBossActive = false;
            this.asteroids.forEach(a => this.createExplosion(a.x, a.y, a.color, a.size));
            this.asteroids = [];
            this.enemyProjectiles = [];
            this.finalBoss = new FinalBoss(this);
            this.asteroids.push(this.finalBoss);
            UI.finalBossHealthContainer.style.display = 'block';
            this.updateGameStatus('!!! BOSS CUỐI XUẤT HIỆN !!!');
            this.screenShakeDuration = 120;
            this.screenShakeIntensity = 4;
        } else if (!this.isBossActive && !this.isFinalBossActive) {
            this.asteroids.push(new Asteroid(this, { isBoss: true }));
            this.isBossActive = true;
            this.updateGameStatus('Boss xuất hiện!');
        }
    }


    checkCollisions() {
        for (let j = this.asteroids.length - 1; j >= 0; j--) {
            if (this.isGameOver) break;
            const asteroid = this.asteroids[j];
            if (this.checkCollision(this.player, asteroid)) {
                if (this.player.shieldCharges > 0) {
                    if (asteroid.isBoss) {
                        this.player.shieldCharges = 0;
                        this.handleGameOver("Lá chắn của bạn đã bị boss phá hủy!");
                    } else {
                        this.player.shieldCharges--;
                        this.createExplosion(asteroid.x, asteroid.y, '#00e5ff', 40);
                        this.asteroids.splice(j, 1);
                    }
                } else {
                    this.handleGameOver("Bạn đã va chạm với tiểu hành tinh.");
                }
            }
        }

        for (let j = this.enemyProjectiles.length - 1; j >= 0; j--) {
            const p = this.enemyProjectiles[j];
            if (this.checkCollision(this.player, p)) {
                if (this.player.shieldCharges > 0) {
                    this.player.shieldCharges--;
                    this.createExplosion(p.x, p.y, '#00e5ff', 20);
                } else {
                    this.handleGameOver("Bạn bị trúng đạn.");
                }
                this.enemyProjectiles.splice(j, 1);
                break;
            }
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            for (let j = this.asteroids.length - 1; j >= 0; j--) {
                if (!this.projectiles[i] || !this.asteroids[j]) continue;
                if (this.checkCollision(this.projectiles[i], this.asteroids[j])) {
                    const asteroid = this.asteroids[j];
                    this.createExplosion(asteroid.x, asteroid.y, asteroid.color);
                    asteroid.health -= this.projectiles[i].damage;
                    this.projectiles.splice(i, 1);

                    if (asteroid.health <= 0) {
                        // This is now handled in the update loop
                    }
                    break;
                }
            }
        }
    }

    handleAsteroidDestruction(asteroid: Asteroid, index: number) {
        if (asteroid === this.finalBoss) {
            if (this.finalBoss && !this.finalBoss.isDefeated) {
                audioManager.playSound('finalbossExplosion', 1.0);
                this.finalBoss.isDefeated = true;
                this.finalBossDefeated = true; // Prevents respawning
                this.score += 5000;
                this.isFinalBossActive = false;
                UI.finalBossHealthContainer.style.display = 'none';
                this.updateGameStatus('BOSS CUỐI BỊ TIÊU DIỆT!');
                this.upgradePoints += 10;
                this.player.shieldCharges += 5;
                this.screenShakeDuration = 60;
                this.screenShakeIntensity = 20;
                this.createExplosion(asteroid.x, asteroid.y, asteroid.color, 400);
                this.asteroids.splice(index, 1);
                this.finalBoss = null;
                if (!this.areAllUpgradesMaxed()) {
                    this.isAutoUpgradeEnabled ? this.autoUpgradeAllies() : this.showUpgradeModal();
                }
            }
        } else {
            this.createExplosion(asteroid.x, asteroid.y, asteroid.color, asteroid.size);
            this.asteroids.splice(index, 1);
            if (asteroid.isBoss) {
                this.score += 250;
                this.isBossActive = false;
                this.updateGameStatus('Boss bị tiêu diệt!');
                this.upgradePoints++;
                if (!this.areAllUpgradesMaxed()) {
                    this.isAutoUpgradeEnabled ? this.autoUpgradeAllies() : this.showUpgradeModal();
                }
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

    handleGameOver(reason: string) {
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

        this.updateGameStatus("Kết thúc!", false);
        UI.showMessage("Trò chơi kết thúc!", `${reason} Điểm của bạn: ${this.score}`);
    }

    checkCollision(obj1: any, obj2: any): boolean {
        if (!obj1 || !obj2 || (obj1 instanceof Player && obj1.isDestroyed)) return false;
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.hypot(dx, dy);
        const collisionDistance = (obj1.size + obj2.size) * 0.8;
        return distance < collisionDistance;
    }

    createExplosion(x: number, y: number, color: string, count = 20) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    triggerAllyUpgradeEffect(ally: AIAlly | LaserAlly) {
        this.createExplosion(ally.x, ally.y, '#ffd700', 30);
    }

    checkUpgrades() {
        if (this.score >= 250 && this.player.projectileSize < 7) {
            this.player.projectileSize = 7;
            this.player.projectileDamage = 2;
            this.updateGameStatus('Nâng cấp! Đạn to hơn!');
            audioManager.playSound('Playerupgraded');
        }
        if (this.score >= 500 && this.player.fireRate < 2) {
            this.player.fireRate = 2;
            this.updateGameStatus('Nâng cấp! Bắn 2 viên!');
            audioManager.playSound('Playerupgraded');
        }
        if (this.score >= 2000 && this.player.allies.length === 0) {
            this.player.allies.push(new AIAlly('left'));
            this.player.allies.push(new AIAlly('right'));
            this.updateGameStatus('Nâng cấp! Đồng minh AI!');
            audioManager.playSound('Playerupgraded', 0.8);
        }
        if (this.score >= 5000 && !this.laserAlly) {
            this.laserAlly = new LaserAlly();
            this.laserAlly.applyUpgrades(this);
            this.updateGameStatus('Đồng minh Laser đã tham chiến!');
            audioManager.playSound('Playerupgraded', 0.8);
        }
        if (this.score >= this.nextShieldScore) {
            this.player.shieldCharges += 3;
            this.nextShieldScore += 1500;
            this.updateGameStatus('Khiên đã được sạc!');
            audioManager.playSound('Playerupgraded');
        }
    }

    updateHUD() {
        UI.scoreDisplay.innerText = `${this.score}`;
        UI.shieldDisplay.innerText = `${this.player.shieldCharges}`;
        UI.timerDisplay.innerText = `${Math.floor(this.gameTime)}s`;
        UI.updateUpgradePoints(this.upgradePoints);
    }

    updateGameStatus(text: string, autoFade: boolean = true) {
        if (this.statusMessageTimeout) {
            clearTimeout(this.statusMessageTimeout);
        }
        UI.gameStatus.innerText = text;
        UI.gameStatus.style.opacity = '1';

        if (autoFade) {
            this.statusMessageTimeout = setTimeout(() => {
                UI.gameStatus.style.opacity = '0';
            }, 2500) as unknown as number;
        }
    }

    resizeCanvas() {
        UI.canvas.width = window.innerWidth;
        UI.canvas.height = window.innerHeight - 50;
        if (this.player) {
            this.player.x = Math.max(this.player.size, Math.min(UI.canvas.width - this.player.size, this.player.x));
        }
    }

    // --- UPGRADE LOGIC ---
    
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

    areAllUpgradesMaxed(): boolean {
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
    
    upgradeAlly(type: AllyUpgradeType) {
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