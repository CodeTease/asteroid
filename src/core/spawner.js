
import * as UI from '../ui.js';
import { Asteroid, BehemothTurret, Monolith, AfterimageBoss, GhostAsteroid, FinalBoss, StaticMine, BehemothBomb, Breacher, DefenseDrone } from '../enemies/index.js';
import { AIAlly, LaserAlly, EchoAlly, VampAlly } from '../allies/index.js';
import { audioManager } from '../audio.js';
import { CONFIG } from '../config.js';

export class Spawner {
    constructor(game) {
        this.game = game;
    }

    handleSpawning() {
        const spawnInterval = Math.max(400, 1200 - Math.floor(this.game.gameTime) * 10);
        // Only spawn if no boss is active, OR if it's the Brick Wall (placeholder boss that doesn't spawn anything else)
        if (performance.now() - this.game.lastSpawnTime > spawnInterval && !this.game.isBossActive && !this.game.isFinalBossActive) {
            
            const enemyType = this.getSpawnType();
            if (enemyType) {
                 // Void Mode Logic for Elite & Linked Enemies (Requires Behemoth Defeated)
                 let isElite = false;
                 let isLinked = false;
                 
                 if (this.game.behemothDefeated) {
                     let eliteChance = 0.1;
                     if (this.game.crisisMode) eliteChance = 0.3; // 30% in Crisis

                     // Elite Chance
                     if (Math.random() < eliteChance) isElite = true;

                     // Linked Chance (Low) - Only if not Elite
                     if (!isElite && Math.random() < 0.1) isLinked = true;
                 }

                 if (isLinked) {
                      // Spawn Pair
                      const x1 = Math.random() * (UI.canvas.width / 2);
                      const x2 = x1 + 100 + Math.random() * 100; // Separation
                      
                      const enemy1 = new Asteroid(this, { type: enemyType, x: x1, y: -50 });
                      const enemy2 = new Asteroid(this, { type: enemyType, x: x2, y: -50 });
                      
                      enemy1.partner = enemy2;
                      enemy2.partner = enemy1;
                      
                      this.game.asteroids.push(enemy1);
                      this.game.asteroids.push(enemy2);
                      this.game.updateGameStatus("LINKED ENEMIES SPAWNED!");
                 } else if (this.game.isDarknessActive && Math.random() < 0.7) { 
                      // High chance for Ghost during Darkness
                      this.game.asteroids.push(new GhostAsteroid(this));
                 } else {
                      this.game.asteroids.push(new Asteroid(this, { type: enemyType, isElite: isElite }));
                      if (isElite) this.game.updateGameStatus("ELITE ENEMY DETECTED!");
                 }
            }
            this.game.lastSpawnTime = performance.now();
        }
        
        if (this.game.gameTime >= this.game.nextBossTime && !this.game.isBossActive && !this.game.isFinalBossActive && !this.game.finalBossDefeated) {
            this.spawnBoss(false);
            this.game.nextBossTime += 60;
        }

        if (this.game.gameTime >= 295 && !this.game.finalBossWarningShown && !this.game.finalBossDefeated) {
            this.game.updateGameStatus('!!! FINAL BOSS WARNING !!!');
            audioManager.playSound('finalbossWarning');
            this.game.finalBossWarningShown = true;
        }

        if (this.game.gameTime >= 300 && !this.game.isFinalBossActive && !this.game.finalBoss && !this.game.finalBossDefeated) {
            this.spawnBoss(true);
        }

        // VOID MODE BEHEMOTH SPAWN (at 150s Void Time)
        if (this.game.finalBossDefeated && this.game.getVoidTime() >= 150 && !this.game.behemothSpawned) {
             this.game.asteroids.push(new BehemothTurret(this));
             this.game.behemothSpawned = true;
             this.game.isBossActive = true;
        }

        // VOID MODE MONOLITH SPAWN (at 300s Void Time)
        // Check !crisisMode to ensure we don't respawn it
        if (this.game.finalBossDefeated && this.game.getVoidTime() >= 300 && !this.game.isFinalBossActive && !this.game.finalBoss && !this.game.crisisMode) {
             // Re-using FinalBossActive flag for Monolith for HUD/Logic convenience
             this.game.isFinalBossActive = true; 
             this.game.isBossActive = false;
             this.game.asteroids.forEach(a => {
                 if (a.type !== 'monolith') this.game.createExplosion(a.x, a.y, a.color, a.size);
             });
             this.game.asteroids = []; // Clear screen
             this.game.enemyProjectiles = [];
             
             this.game.finalBoss = new Monolith(this);
             this.game.asteroids.push(this.game.finalBoss);
             
             UI.finalBossHealthContainer.style.display = 'block';
             UI.finalBossHealthBar.style.width = '100%';
             // Update Health Bar Color for Monolith
             UI.finalBossHealthBar.style.background = 'purple';
             
             this.game.updateGameStatus('!!! MONOLITH DETECTED !!!');
             this.game.screenShakeDuration = 120;
             this.game.screenShakeIntensity = 4;
             audioManager.playSound('finalbossBegin'); // Reuse sound
        }

        // AFTERIMAGE BOSS SPAWN (at 600s Void Time)
        if (this.game.crisisMode && this.game.getVoidTime() >= 600 && !this.game.isFinalBossActive && !this.game.finalBoss) {
             this.game.isFinalBossActive = true;
             this.game.isBossActive = false;
             
             // Clear screen
             this.game.asteroids.forEach(a => {
                 this.game.createExplosion(a.x, a.y, a.color, a.size);
             });
             this.game.asteroids = [];
             this.game.enemyProjectiles = [];
             
             this.game.finalBoss = new AfterimageBoss(this);
             this.game.asteroids.push(this.game.finalBoss);
             
             UI.finalBossHealthContainer.style.display = 'block';
             UI.finalBossHealthBar.style.width = '100%';
             UI.finalBossHealthBar.style.background = '#00FFFF'; // Cyan
             
             this.game.updateGameStatus('AFTERIMAGE HAS ARRIVED!');
             this.game.screenShakeDuration = 120;
        }

           // Override for Behemoth/Monolith/Crisis: Allow spawning even if isBossActive, but slower
           if (this.game.finalBossDefeated) {
               
               // Monolith Logic: It spawns its own stuff (Legion Gate), so disable natural spawning
               if (this.game.finalBoss instanceof Monolith) {
                   this.game.lastSpawnTime = performance.now();
               }
               // Afterimage Logic: Spawns its own Breachers/Drones. Disable natural spawning.
               else if (this.game.finalBoss instanceof AfterimageBoss) {
                   this.game.lastSpawnTime = performance.now();
               }
               // Behemoth (Mini-Boss) or Crisis Mode (No Boss Active)
               else if (this.game.behemothSpawned || this.game.crisisMode) {
                  const voidSpawnInterval = this.game.crisisMode ? 1000 : 2000; // Faster in Crisis
                  if (performance.now() - this.game.lastSpawnTime > voidSpawnInterval && (!this.game.isFinalBossActive || this.game.finalBoss instanceof AfterimageBoss)) {
                     // Wait, if Afterimage is active, we don't spawn. The condition above handles it.
                     // But we need to ensure we spawn during Crisis if NO Boss is active.
                     
                     if (this.game.isFinalBossActive) return; // Don't spawn if Afterimage is active

                     const enemyType = this.getSpawnType();
                     if (enemyType) {
                         // Void Mode Logic for Elite & Linked Enemies (Requires Behemoth Defeated)
                         let isElite = false;
                         let isLinked = false;
                          
                         if (this.game.behemothDefeated) {
                            let eliteChance = 0.1;
                            if (this.game.crisisMode) eliteChance = 0.3;

                            if (Math.random() < eliteChance) isElite = true;
                            if (!isElite && Math.random() < 0.1) isLinked = true;
                         }

                         if (isLinked) {
                             const x1 = Math.random() * (UI.canvas.width / 2);
                             const x2 = x1 + 100 + Math.random() * 100;
                             const enemy1 = new Asteroid(this, { type: enemyType, x: x1, y: -50 });
                             const enemy2 = new Asteroid(this, { type: enemyType, x: x2, y: -50 });
                             enemy1.partner = enemy2; enemy2.partner = enemy1;
                             this.game.asteroids.push(enemy1); this.game.asteroids.push(enemy2);
                         } else {
                             this.game.asteroids.push(new Asteroid(this, { type: enemyType, isElite: isElite }));
                         }
                     }
                     this.game.lastSpawnTime = performance.now();
                  }
               }
           }
    }

    getSpawnType() {
        const isVoid = this.game.finalBossDefeated;
        const t = isVoid ? this.game.getVoidTime() : this.game.gameTime;
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
            } else if (t < 300) {
                 // 180s-300s V-Time: Phase-in Anchor. Decrease Bulwark.
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
            } else {
                 // CRISIS MODE (300s+)
                 // Breacher, Seeker, Stunner, Sizzler spam.
                 weights.push({ type: 'breacher', w: 30 });
                 weights.push({ type: 'seeker', w: 20 });
                 weights.push({ type: 'stunner', w: 20 });
                 weights.push({ type: 'sizzler', w: 20 });
                 weights.push({ type: 'tanker', w: 10 });
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
            this.game.isFinalBossActive = true;
            this.game.isBossActive = false;
            this.game.asteroids.forEach(a => this.game.createExplosion(a.x, a.y, a.color, a.size));
            this.game.asteroids = [];
            this.game.enemyProjectiles = [];
            this.game.finalBoss = new FinalBoss(this);
            this.game.asteroids.push(this.game.finalBoss);
            UI.finalBossHealthContainer.style.display = 'block';
            this.game.updateGameStatus('!!! FINAL BOSS APPEARED !!!');
            this.game.screenShakeDuration = 120;
            this.game.screenShakeIntensity = 4;
        } else if (!this.game.isBossActive && !this.game.isFinalBossActive) {
            this.game.asteroids.push(new Asteroid(this, { isBoss: true }));
            this.game.isBossActive = true;
            this.game.updateGameStatus('Boss appeared!');
        }
    }
}
