
import * as UI from '../ui.js';
import { audioManager } from '../audio.js';
import { CONFIG } from '../config.js';
import { Player } from '../entities/player.js';
import { AfterimageBoss, Monolith, BehemothBomb } from '../enemies/index.js';
import { VoidRift } from '../entities/particles.js';

export class CollisionSystem {
    constructor(game) {
        this.game = game;
    }

    checkCollisions() {
        // Player vs Asteroids/Enemies
        for (let j = this.game.asteroids.length - 1; j >= 0; j--) {
            if (this.game.isGameOver) break;
            const asteroid = this.game.asteroids[j];
            if (this.checkCollision(this.game.player, asteroid)) {
                if (this.game.godMode || this.game.player.isDashing) continue; // God Mode & I-frames Check

                // AFTERIMAGE INSTANT KILL (Bypasses Shield)
                if (asteroid instanceof AfterimageBoss) {
                    this.game.player.shieldCharges = 0;
                    this.game.handleGameOver("SHATTERED BY AFTERIMAGE!");
                    return;
                }

                if (this.game.player.shieldCharges > 0) {
                    if (asteroid.isBoss) {
                        this.game.player.shieldCharges = 0;
                        this.game.handleGameOver("Your shield was destroyed by the boss!");
                    } else {
                        this.game.player.shieldCharges--;
                        this.game.createExplosion(asteroid.x, asteroid.y, '#00e5ff', 40);
                        this.game.asteroids.splice(j, 1);
                    }
                } else {
                    this.game.handleGameOver("You collided with an asteroid.");
                }
            }
        }

        // Player vs Enemy Projectiles
        for (let j = this.game.enemyProjectiles.length - 1; j >= 0; j--) {
            const p = this.game.enemyProjectiles[j];
            if (p instanceof BehemothBomb || p instanceof VoidRift) continue; // Custom collision

            if (this.checkCollision(this.game.player, p)) {
                if (this.game.godMode || this.game.player.isDashing) continue; // God Mode & I-frames Check

                if (this.game.player.shieldCharges > 0) {
                    this.game.player.shieldCharges--;
                    this.game.createExplosion(p.x, p.y, '#00e5ff', 20);
                } else {
                    this.game.handleGameOver("You were hit by a projectile.");
                }
                this.game.enemyProjectiles.splice(j, 1);
                break;
            }
        }

        // Mothership vs Asteroids/Enemies (Abyss Mode)
        if (this.game.isAbyssMode && this.game.mothership) {
            for (let j = this.game.asteroids.length - 1; j >= 0; j--) {
                const asteroid = this.game.asteroids[j];
                if (this.checkCollision(this.game.mothership, asteroid)) {
                    this.game.mothership.health -= asteroid.isBoss ? 50 : (asteroid.isElite ? 20 : 5);
                    this.game.createExplosion(asteroid.x, asteroid.y, '#ff0000', 30);
                    audioManager.playSound('playerHit', 0.5);
                    
                    if (asteroid.isBoss) {
                        asteroid.health = 0; // Destroy boss as well? Or just let it pass/bounce?
                    } else {
                        this.game.asteroids.splice(j, 1);
                    }

                    if (this.game.mothership.health <= 0) {
                        this.game.mothership.health = 0;
                        this.game.handleGameOver("MOTHERSHIP DESTROYED!");
                    }
                }
            }
        }

        // Player vs Coolant
        for (let j = this.game.coolants.length - 1; j >= 0; j--) {
            const c = this.game.coolants[j];
            if (this.checkCollision(this.game.player, c)) {
                this.game.player.heat = 0;
                this.game.player.isOverheated = false;
                clearTimeout(this.game.player.overheatTimeout);
                this.game.updateGameStatus("Coolant acquired! Weapon Cooled.");
                audioManager.playSound('AIupgraded', 0.5); // Reuse sound
                this.game.coolants.splice(j, 1);
            }
        }

        // Projectiles vs Enemies
        for (let i = this.game.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.game.projectiles[i];
            let hitSomething = false;

            for (let j = this.game.asteroids.length - 1; j >= 0; j--) {
                const asteroid = this.game.asteroids[j];
                if (!projectile || !asteroid) continue;
                if (this.checkCollision(projectile, asteroid)) {
                    
                    // AFTERIMAGE BOSS INVULNERABILITY
                    if (asteroid instanceof AfterimageBoss && asteroid.drone && !asteroid.drone.isDead()) {
                        this.game.createExplosion(projectile.x, projectile.y, 'cyan', 5);
                        this.game.removeProjectile(i);
                        hitSomething = true;
                        break;
                    }

                    // BEHEMOTH LOGIC (AI Ally Immunity)
                    if (asteroid.type === 'behemoth' && projectile.source === 'ai_ally') {
                        this.game.createExplosion(projectile.x, projectile.y, '#888', 5);
                        this.game.removeProjectile(i);
                        hitSomething = true;
                        break;
                    }

                    // TANKER PARRY LOGIC (Small AI Ally projectiles)
                    if (asteroid.type === 'tanker' && projectile.source === 'ai_ally') {
                         this.game.createExplosion(projectile.x, projectile.y, '#888', 5); // Grey spark
                         this.game.removeProjectile(i);
                         hitSomething = true;
                         break;
                    }

                    // BULWARK SHIELD LOGIC
                    if (asteroid.type === 'bulwark') {
                        if (this.game.player.y > asteroid.y) {
                            this.game.createExplosion(projectile.x, projectile.y, '#00e5ff', 5);
                            this.game.removeProjectile(i);
                            hitSomething = true;
                            break;
                        }
                    }

                    this.game.createExplosion(asteroid.x, asteroid.y, asteroid.color, 5);

                    let damage = projectile.damage;

                    // VOID MODE GLOBAL DAMAGE BUFF (x2) - STARTS AT 100s+ (As per original Void Mode design)
                    if (this.game.finalBossDefeated && this.game.getVoidTime() >= CONFIG.GAME.VOID_MODE_START_TIME) damage *= 2;

                    // MONOLITH CUSTOM DAMAGE LOGIC
                    if (asteroid instanceof Monolith) {
                        const actualDamage = asteroid.takeDamage(damage, projectile.source, projectile.x, projectile.y);
                        // Visual feedback for immunity/resist
                        if (actualDamage === 0) {
                             this.game.createExplosion(projectile.x, projectile.y, '#888', 5);
                        } else if (actualDamage < damage) {
                             this.game.createExplosion(projectile.x, projectile.y, '#purple', 5); // Resisted color
                        }
                    } else {
                        asteroid.health -= damage;
                    }

                    // ANCHOR PROTECTION LOGIC
                    if (asteroid.protectedBy && asteroid.health <= 1) {
                         asteroid.health = 1;
                         this.game.createExplosion(asteroid.x, asteroid.y, '#ffffff', 2); // White shield sparks
                    }

                    this.game.removeProjectile(i);
                    hitSomething = true;
                    break;
                }
            }
            if (hitSomething) continue;
        }
    }

    checkCollision(obj1, obj2) {
        if (!obj1 || !obj2 || (obj1 instanceof Player && obj1.isDestroyed)) return false;
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.hypot(dx, dy);
        const collisionDistance = (obj1.size + obj2.size) * 0.8;
        return distance < collisionDistance;
    }
}
