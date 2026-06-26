import { Player } from '../entities/player.js';
import { Mothership } from '../entities/mothership.js';
import { Projectile } from '../entities/projectiles.js';
import { Asteroid, FinalBoss, Monolith, AfterimageBoss, BehemothBomb } from '../enemies/index.js';
import { EchoAlly, VampAlly } from '../allies/index.js';
import { Coolant } from '../entities/items.js';
import { Particle, VoidRift } from '../entities/particles.js';
import { audioManager } from '../audio.js';
import { CONFIG } from '../config.js';
import { ObjectPool } from '../pool.js';
import { Spawner } from './spawner.js';
import { CollisionSystem } from './collisions.js';
import { UpgradeSystem } from './upgrades.js';

// Refactored Subsystems
import { UIManager } from './ui-manager.js';
import { EventManager } from './environment/event-manager.js';
import { SkillManager } from './skills/skill-manager.js';
import { DestructionHandler } from './destruction-handler.js';
import { StateManager, NormalState, VoidState, CrisisState, AbyssState } from './state-manager.js';

export class Game {
    constructor() {
        this.animationFrameId = 0;
        
        // Object Pools
        this.projectilePool = new ObjectPool(() => new Projectile(0, 0), 200);
        this.particlePool = new ObjectPool(() => new Particle(0, 0, '#fff'), 200);
        this.keys = {};
        
        // Subsystems
        this.ui = new UIManager();
        this.eventManager = new EventManager();
        this.skillManager = new SkillManager();
        this.destructionHandler = new DestructionHandler();
        
        this.stateManager = new StateManager();
        this.stateManager.register('Normal', new NormalState());
        this.stateManager.register('Void', new VoidState());
        this.stateManager.register('Crisis', new CrisisState());
        this.stateManager.register('Abyss', new AbyssState());
        
        this.spawner = new Spawner(this);
        this.collisionSystem = new CollisionSystem(this);
        this.upgradeSystem = new UpgradeSystem(this);

        // Game State Variables
        this.player = null;
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.asteroids = [];
        this.particles = [];
        this.coolants = [];
        this.score = 0;
        this.gameTime = 0;
        this.voidStartTime = 0;
        this.deltaTime = 0;
        this.lastTime = 0;
        this.nextBossTime = 0;
        this.lastSpawnTime = 0;
        this.nextShieldScore = 0;
        this.upgradePoints = 0;
        this.allyUpgrades = {};
        this.laserAlly = null;
        this.echoAlly = null;
        this.echoAlly2 = null;
        this.vampAlly = null;
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

        // Aim Mode
        this.isAimUnlocked = false;
        this.mousePos = { x: 0, y: 0 };
        this.godMode = false;

        // VOID STATE VARS
        this.behemothSpawned = false;
        this.behemothDefeated = false;
        this.crisisMode = false;

        // ABYSS MODE VARS
        this.isAbyssMode = false;
        this.abyssStartTime = 0;
        this.mothership = null;
        this.cameraX = 0;
        this.cameraY = 0;
        this.worldWidth = 0;
        this.worldHeight = 0;

        // VOID BARRIER & OVERLOAD
        this.voidBarrierHealth = 100;
        this.maxVoidBarrierHealth = 100;
    }

    // Getters for Backward Compatibility
    get isNoHeatMode() { return this.skillManager.isNoHeatActive; }
    get isInputInverted() { return this.eventManager.isInputInverted; }
    get isDriftActive() { return this.eventManager.isDriftActive; }
    get isDarknessActive() { return this.eventManager.isDarknessActive; }
    get selectedSkill() { return this.skillManager.selectedSkill; }
    get voidSkills() { return this.skillManager.voidSkills; }

    // Compatibility methods for callers using old game interface
    updateGameStatus(text, autoFade = true) {
        this.ui.updateGameStatus(text, autoFade);
    }

    updateHUD() {
        this.ui.updateHUD(this);
    }

    handleAsteroidDestruction(asteroid, index) {
        this.destructionHandler.handleAsteroidDestruction(asteroid, index, this);
    }

    start() {
        this.init();
        audioManager.stopAllLoopingSounds();
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.lastTime = performance.now();
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
        
        this.projectilePool.releaseAll();
        this.particlePool.releaseAll();

        this.projectiles = [];
        this.enemyProjectiles = [];
        this.asteroids = [];
        this.particles = [];
        this.coolants = [];
        this.score = 0;
        this.gameTime = 0;
        this.voidStartTime = 0;
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
        
        this.ui.clearStatusTimeout();
        this.isAimUnlocked = false;

        this.behemothSpawned = false;
        this.behemothDefeated = false;
        this.crisisMode = false;

        this.voidBarrierHealth = 100;
        this.maxVoidBarrierHealth = 100;

        this.isAbyssMode = false;
        this.abyssStartTime = 0;
        this.mothership = null;
        this.cameraX = 0;
        this.cameraY = 0;
        if (this.ui.canvas) {
            this.worldWidth = this.ui.canvas.width;
            this.worldHeight = this.ui.canvas.height;
        }

        // Reset sub-managers
        this.eventManager.reset();
        this.skillManager.reset();
        this.stateManager.transition('Normal', this);

        this.ui.updateHUD(this);
        this.ui.updateGameStatus('Ready', false);
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
             if (!this.isBossActive && !this.isFinalBossActive) {
                this.gameTime += dt;
             }
        }

        // Delegate to StateManager
        this.stateManager.update(dt, this);

        // Update player & allies & drops (shared logic across all states)
        this.player.update(this, dt);
        this.player.allies.forEach(p => p.update(this, dt));
        if (this.laserAlly) this.laserAlly.update(this, dt);
        if (this.echoAlly) this.echoAlly.update(this, dt);
        if (this.echoAlly2) this.echoAlly2.update(this, dt);
        if (this.vampAlly) this.vampAlly.update(this, dt);

        this.coolants.forEach((c, i) => {
             c.update(dt);
             if (c.y > window.innerHeight - 50) this.coolants.splice(i, 1); // Note: canvas height bound
        });

        // Projectiles cleanup
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(this, dt);
            if (p.y < 0 || p.y > window.innerHeight || p.x < 0 || p.x > window.innerWidth) { // boundary
                this.removeProjectile(i);
            }
        }
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            if (p instanceof BehemothBomb || p instanceof VoidRift) {
                if (p.update(this, dt)) {
                    this.enemyProjectiles.splice(i, 1);
                    continue;
                }
            } else {
                p.update(this, dt);
            }
            if (p.y < 0 || p.y > window.innerHeight || p.x < 0 || p.x > window.innerWidth) {
                this.enemyProjectiles.splice(i, 1);
                if (p instanceof Projectile) {
                    this.projectilePool.release(p);
                }
            }
        }

        // Asteroids loop with Barrier impact
        for (let i = this.asteroids.length - 1; i >= 0; i--) {
            const a = this.asteroids[i];
            a.update(this, dt);
            
            if (a.y > window.innerHeight) {
                if (a.type === 'orbiter' && a.isOrbiting) {
                    continue;
                }

                if (this.behemothDefeated) {
                     let damage = 1;
                     if (a.isElite) {
                         damage = 10;
                     } else if (['tanker', 'bulwark', 'sizzler', 'behemoth', 'boss'].includes(a.type) || a.isBoss) {
                         damage = 5;
                     }
                     this.takeBarrierDamage(damage);
                     this.createExplosion(a.x, window.innerHeight, '#ff0000', 10);
                     audioManager.playSound('playerHit', 0.5);
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
                    this.destructionHandler.handleAsteroidDestruction(asteroid, j, this);
                }
            }
            this.ui.updateHUD(this);
            this.upgradeSystem.checkUpgrades();
        }
    }

    getVoidTime() {
        return Math.max(0, this.gameTime - this.voidStartTime);
    }
    
    getAbyssTime() {
        return Math.max(0, this.gameTime - this.abyssStartTime);
    }
    
    draw() {
        const ctx = this.ui.canvas ? this.ui.canvas.getContext('2d') : null;
        if (!ctx) return;

        ctx.save();

        if (this.isAbyssMode && this.player) {
            this.cameraX = this.player.x - ctx.canvas.width / 2;
            this.cameraY = this.player.y - ctx.canvas.height / 2;
            this.cameraX = Math.max(0, Math.min(this.cameraX, this.worldWidth - ctx.canvas.width));
            this.cameraY = Math.max(0, Math.min(this.cameraY, this.worldHeight - ctx.canvas.height));
            ctx.translate(-this.cameraX, -this.cameraY);
        }

        if (this.screenShakeDuration > 0) {
            const dx = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
            const dy = (Math.random() - 0.5) * this.screenShakeIntensity * 2;
            ctx.translate(dx, dy);
            this.screenShakeDuration--;
        }

        // We clear based on the camera position now to ensure the whole view is clean
        const clearX = this.isAbyssMode ? this.cameraX - ctx.canvas.width : -ctx.canvas.width;
        const clearY = this.isAbyssMode ? this.cameraY - ctx.canvas.height : -ctx.canvas.height;
        ctx.clearRect(clearX, clearY, ctx.canvas.width * 3, ctx.canvas.height * 3);

        this.player.draw(this);
        this.player.allies.forEach(p => p.draw());
        if (this.laserAlly) this.laserAlly.draw();
        if (this.echoAlly) this.echoAlly.draw(this);
        if (this.echoAlly2) this.echoAlly2.draw(this);
        if (this.vampAlly) this.vampAlly.draw(this);
        
        this.coolants.forEach(c => c.draw());
        this.projectiles.forEach(p => p.draw());
        this.enemyProjectiles.forEach(p => p.draw());
        this.asteroids.forEach(a => a.draw(this));
        this.particles.forEach(p => p.draw());

        if (this.mothership) this.mothership.draw();

        if (this.isAimUnlocked) {
            ctx.save();
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            const aimX = this.isAbyssMode ? this.mousePos.x + this.cameraX : this.mousePos.x;
            const aimY = this.isAbyssMode ? this.mousePos.y + this.cameraY : this.mousePos.y;
            ctx.arc(aimX, aimY, 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        
        // Draw environmental overlays depending on active state
        this.stateManager.draw(ctx, this);

        if (this.flashDuration > 0) {
            ctx.globalAlpha = this.flashDuration / 10;
            ctx.fillStyle = 'white';
            const flashX = this.isAbyssMode ? this.cameraX - ctx.canvas.width : -ctx.canvas.width;
            const flashY = this.isAbyssMode ? this.cameraY - ctx.canvas.height : -ctx.canvas.height;
            ctx.fillRect(flashX, flashY, ctx.canvas.width * 3, ctx.canvas.height * 3);
            this.flashDuration--;
        }

        ctx.restore();

        if (this.isFinalBossActive && this.finalBoss) {
            this.ui.updateFinalBossHealthBar(this.finalBoss);
        }
    }
    
    removeProjectile(index) {
        const p = this.projectiles[index];
        if (p) {
            this.projectiles.splice(index, 1);
            this.projectilePool.release(p);
        }
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

        this.ui.updateGameStatus("Game Over!", false);
        this.ui.showMessage("Game Over!", `${reason} Your Score: ${this.score}`);
    }

    createExplosion(x, y, color, count = 20) {
        for (let i = 0; i < count; i++) {
            const p = this.particlePool.get({ x, y, color });
            this.particles.push(p);
        }
    }

    takeBarrierDamage(amount) {
        this.voidBarrierHealth -= amount;
        this.screenShakeDuration = 5;
        
        if (this.crisisMode) {
             this.screenShakeDuration = 20;
             if (this.player && !this.isNoHeatMode) {
                  this.player.heat += 20;
                  if (this.player.heat >= this.player.maxHeat) {
                       this.player.isOverheated = true;
                       this.ui.updateGameStatus("BARRIER SHOCK: SYSTEM OVERHEAT!");
                  }
             }
        }

        if (this.voidBarrierHealth <= 0) {
            this.voidBarrierHealth = 0;
            this.handleGameOver("Void Barrier Destroyed! Base Overrun.");
        }
    }

    resizeCanvas() {
        const canvas = this.ui.canvas || document.getElementById('gameCanvas');
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight - 50;
            if (!this.isAbyssMode) {
                this.worldWidth = canvas.width;
                this.worldHeight = canvas.height;
            } else {
                this.worldWidth = canvas.width * CONFIG.ABYSS.WORLD_WIDTH_MULTIPLIER;
                this.worldHeight = canvas.height * CONFIG.ABYSS.WORLD_HEIGHT_MULTIPLIER;
            }
            if (this.player) {
                this.player.x = Math.max(this.player.size, Math.min(this.worldWidth - this.player.size, this.player.x));
                this.player.y = Math.max(this.player.size, Math.min(this.worldHeight - this.player.size, this.player.y));
            }
        }
    }
}
export default Game;