import { FinalBoss, Monolith, AfterimageBoss } from '../enemies/index.js';
import { EchoAlly, VampAlly } from '../allies/index.js';
import { Coolant } from '../entities/items.js';
import { Asteroid } from '../enemies/index.js';
import { audioManager } from '../audio.js';

export class DestructionHandler {
    handleAsteroidDestruction(asteroid, index, game) {
        if (asteroid === game.finalBoss) {
            if (game.finalBoss && !game.finalBoss.isDefeated) {
                
                // Distinguish between Initial FinalBoss and Void Monolith
                if (asteroid instanceof FinalBoss) {
                    // INITIAL FINAL BOSS DEFEATED
                    audioManager.playSound('finalbossExplosion', 1.0);
                    game.finalBoss.isDefeated = true;
                    game.finalBossDefeated = true; 
                    game.score += 5000;
                    game.isFinalBossActive = false;
                    game.ui.hideFinalBossHealth();
                    
                    // UNLOCK AIM MODE & VOID MODE
                    game.isAimUnlocked = true;
                    game.ui.updateGameStatus('FINAL BOSS DEFEATED! VOID MODE UNLOCKED!');
                    game.ui.showHeatGroup(); // Show Heat Bar
                    
                    // VOID TIME RESET (Only here!)
                    game.voidStartTime = game.gameTime;
                    game.ui.setTimerLabel("Void Time");

                    game.upgradePoints += 10;
                    if (game.isAutoUpgradeEnabled) {
                        game.upgradeSystem.autoUpgradeAllies();
                    }
                    game.player.shieldCharges += 5;
                    game.screenShakeDuration = 60;
                    game.screenShakeIntensity = 20;
                    
                    game.echoAlly = new EchoAlly();
                    game.ui.updateGameStatus("Echo Ally Acquired!");
                } else if (asteroid instanceof Monolith) {
                     // MONOLITH DEFEATED - TRIGGER CRISIS MODE
                     audioManager.playSound('finalbossExplosion', 1.0);
                     game.isFinalBossActive = false;
                     game.ui.hideFinalBossHealth();
                     
                     game.crisisMode = true; // ACTIVATE CRISIS
                     
                     game.ui.updateGameStatus('CRISIS MODE: FIVE MINUTES OF HELL', false);
                     // Set Barrier Cap done in update loop
                     game.voidBarrierHealth = Math.min(game.voidBarrierHealth, 50);

                     game.screenShakeDuration = 100;
                     game.screenShakeIntensity = 25;
                     
                     // Reward?
		             game.upgradePoints += 15;
                     game.score += 10000;

		             if (game.isAutoUpgradeEnabled) {
                        game.upgradeSystem.autoUpgradeAllies();
                     }
                } else if (asteroid instanceof AfterimageBoss) {
                     // AFTERIMAGE DEFEATED
                     audioManager.playSound('finalbossExplosion', 1.0);
                     game.isFinalBossActive = false;
                     game.ui.hideFinalBossHealth();
                     game.ui.updateGameStatus("AFTERIMAGE SHATTERED! ABYSS AWAITS...");
		             game.upgradePoints += 30;
                     game.score += 50000;
		             if (game.isAutoUpgradeEnabled) {
                        game.upgradeSystem.autoUpgradeAllies();
                     }
                     // Transition to Abyss Mode
                     game.stateManager.transition('Abyss', game);
                }

                game.createExplosion(asteroid.x, asteroid.y, asteroid.color, 400);
                game.asteroids.splice(index, 1);
                game.finalBoss = null;
            }
        } else {
            game.createExplosion(asteroid.x, asteroid.y, asteroid.color, asteroid.size);
            game.asteroids.splice(index, 1);
            
            // ANCHOR DEATH LOGIC
            if (asteroid.type === 'anchor' && asteroid.anchorTarget) {
                 const target = asteroid.anchorTarget;
                 if (target && game.asteroids.includes(target)) {
                     target.protectedBy = null;
		     // - 50% health immediately
                     const damage = target.maxHealth * 0.5;
                     target.health -= damage;

                     game.createExplosion(target.x, target.y, '#ff0000', 20); // Big red hit
                     game.ui.updateGameStatus("Anchor Destroyed! Shield Down!");
                 }
            }

            // BEHEMOTH REWARD: Vamp Ally & UNLOCK Extended
            if (asteroid.type === 'behemoth') {
                 game.behemothDefeated = true; // UNLOCK VOID MODE EXTENDED
                 game.vampAlly = new VampAlly();
                 game.ui.updateGameStatus("BEHEMOTH DESTROYED! THE EXTENDED OPENS...");
                 audioManager.playSound('AIupgraded');
		         game.upgradePoints += 5;
		         if (game.isAutoUpgradeEnabled) {
                     game.upgradeSystem.autoUpgradeAllies();
                 }
                 
                 // Show Barrier Immediately
                 game.ui.showVoidBarrier();
            }

            // VAMP ALLY PASSIVE (Heal Barrier or Mothership)
            if (game.vampAlly) {
                 // Buff: 100% chance during Crisis/Abyss, 20% otherwise
                 let healChance = 0.20;
                 if (game.crisisMode || game.isAbyssMode) healChance = 1.0;

                 if (Math.random() < healChance) {
                     if (game.isAbyssMode && game.mothership) {
                         if (game.mothership.health < game.mothership.maxHealth) {
                              game.mothership.health = Math.min(game.mothership.maxHealth, game.mothership.health + 10);
                         }
                     } else if (game.voidBarrierHealth < game.maxVoidBarrierHealth) {
                          game.voidBarrierHealth = Math.min(game.maxVoidBarrierHealth, game.voidBarrierHealth + 1);
                          // Visual Feedback
                          game.ui.flashBarrierHeal();
                     }
                 }
            }

            // Drop Coolant (10% chance from Void Enemies)
            if (['orbiter', 'weaver', 'bulwark'].includes(asteroid.type) && Math.random() < 0.1) {
                game.coolants.push(new Coolant(asteroid.x, asteroid.y));
            }

            if (asteroid.isBoss) {
                game.score += 250;
                game.isBossActive = false;
                game.ui.updateGameStatus('Boss defeated!');
                game.upgradePoints++;
            } else {
                audioManager.playSound('enemyDefeated', 0.3);
                game.score += 10;
                if (asteroid.type === 'splitter') {
                    game.asteroids.push(new Asteroid(game, { type: 'standard', x: asteroid.x - 10, y: asteroid.y, size: 15 }));
                    game.asteroids.push(new Asteroid(game, { type: 'standard', x: asteroid.x + 10, y: asteroid.y, size: 15 }));
                }
            }
        }
        game.ui.updateHUD(game);
    }
}
