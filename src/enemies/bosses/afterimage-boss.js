import { canvas, ctx } from "../../ui.js";
import { audioManager } from "../../audio.js";
import { CONFIG } from "../../config.js";
import { Asteroid } from '../basic/asteroid.js';
import { DefenseDrone, Breacher } from '../index.js';
import { VoidRift } from '../../entities/particles.js';
import { SolidDecoy } from '../../allies/solid-decoy.js';

export class AfterimageBoss extends Asteroid {
    constructor(game) {
        super(game, { isBoss: true });
        this.type = 'afterimage';
        this.size = 40;
        this.x = canvas.width / 2;
        this.y = -100;
        this.initialY = 150;
        this.health = 10000;
        this.maxHealth = 10000;
        this.color = '#00FFFF'; // Cyan
        
        this.state = 'enter'; // enter, idle, lock, dash, recover, shattered
        this.stateTimer = 0;
        
        this.targetPos = { x: 0, y: 0 };
        this.dashVelocity = { x: 0, y: 0 };
        this.drone = null;
        this.lastDroneSpawn = -999;
        
        this.enraged = false;
        this.dashCount = 0; // For Chain Dash
        
        this.trueX = this.x;
        this.trueY = this.y;
        this.lastRiftTime = 0;
    }
    
    draw(game) {
        if (this.state === 'shattered') return; // Invisible

        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Visuals
        ctx.fillStyle = this.enraged ? '#FF0000' : this.color;
        ctx.shadowColor = this.enraged ? '#FF0000' : '#00FFFF';
        ctx.shadowBlur = 20;
        
        // Glitch effect
        const shakeX = Math.random() * 4 - 2;
        const shakeY = Math.random() * 4 - 2;
        
        // Diamond Shape
        ctx.beginPath();
        ctx.moveTo(0 + shakeX, -this.size + shakeY); // Top
        ctx.lineTo(this.size + shakeX, 0 + shakeY); // Right
        ctx.lineTo(0 + shakeX, this.size + shakeY); // Bottom
        ctx.lineTo(-this.size + shakeX, 0 + shakeY); // Left
        ctx.closePath();
        ctx.fill();
        
        // Inner Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(shakeX, shakeY, 10, 0, Math.PI * 2);
        ctx.fill();

        // Invulnerable Shield
        if (this.drone && !this.drone.isDead()) {
             ctx.strokeStyle = 'cyan';
             ctx.lineWidth = 3;
             ctx.beginPath();
             ctx.arc(0, 0, this.size + 15, 0, Math.PI * 2);
             ctx.stroke();
             
             ctx.font = '20px Arial';
             ctx.fillStyle = 'cyan';
             ctx.textAlign = 'center';
             ctx.fillText("🛡️ INVULNERABLE 🛡️", 0, -this.size - 20);
        }

        ctx.restore();
        
        // Health Bar removed – displayed on game UI instead

        // Lock Line - REMOVED (No telegraphing)
    }
    
    update(game, dt) {
        const moveFactor = 60 * dt;
        
        // Restore True Position from Glitch Step
        if (this.state === 'idle' || this.state === 'lock') {
             this.x = this.trueX;
             this.y = this.trueY;
        }
        
        // Rewind State Logic
        if (this.state === 'rewind') {
             this.x += this.dashVelocity.x * moveFactor;
             this.y += this.dashVelocity.y * moveFactor;
             
             if (this.y <= this.initialY) {
                 this.y = this.initialY;
                 this.state = 'idle';
                 this.stateTimer = 1;
                 this.vx = 0;
                 this.vy = 0;
                 game.updateGameStatus("REWIND COMPLETE!");
             }
             return;
        }

        // Phase 2 Check
        if (!this.enraged && this.health < 3000) {
            this.enraged = true;
            // Clear drone if exists
            if (this.drone) {
                this.drone.health = 0;
                this.drone = null;
            }
            game.updateGameStatus("AFTERIMAGE ENRAGED! SPEED LIMIT BROKEN!");
            audioManager.playSound('finalbossWarning');
            game.screenShakeDuration = 60;
        }

        if (this.state === 'enter') {
            this.y += 10 * moveFactor;
            if (this.y >= this.initialY) {
                this.y = this.initialY;
                this.state = 'idle';
                this.stateTimer = 60; // 1s wait
                game.updateGameStatus("AFTERIMAGE: THE SHATTERED VELOCITY");
                audioManager.playSound('finalbossBegin');
            }
            return;
        }
        
        // Drone Spawn Logic (Phase 1 Only - Phase 2 uses Elites)
        if (!this.enraged && (!this.drone || this.drone.health <= 0) && game.gameTime - this.lastDroneSpawn > 30) {
             if (Math.random() < 0.01) { // Random chance each frame after cd? Better to just spawn on timer
                  // Let's spawn immediately if off cooldown for reliability
                  this.drone = new DefenseDrone(game, this);
                  game.asteroids.push(this.drone);
                  this.lastDroneSpawn = game.gameTime;
                  game.updateGameStatus("Guardian Drone Deployed!");
             }
        }
        // Phase 2 Elite Spawn handled in Game loop or here? 
        if (this.enraged && game.gameTime - this.lastDroneSpawn > 20) { // faster CD
             // Spawn Elites
             const types = ['juggler', 'sizzler', 'tanker'];
             const type = types[Math.floor(Math.random() * types.length)];
             const elite = new Asteroid(game, { type: type, isElite: true, x: Math.random() * canvas.width, y: -50 });
             game.asteroids.push(elite);
             this.lastDroneSpawn = game.gameTime;
             game.updateGameStatus("Elite Reinforcements!");
        }

        if (this.state === 'idle') {
            // Hover logic
            this.x += Math.sin(Date.now() / 500) * 2 * moveFactor;
            this.y = this.initialY + Math.sin(Date.now() / 300) * 10;
            
            this.stateTimer -= dt * 60; // Timer in frames or seconds? Let's use dt (seconds) logic
            
            if (this.stateTimer <= 0) {
                this.state = 'lock';
                this.stateTimer = this.enraged ? 0.5 : 1.5; // Buffed Lock Times
                
                // Phantom Feint / Solid Decoys (Enraged) – 40% chance per lock
                if (this.enraged && Math.random() < 0.4) {
                     for(let i=0; i<2; i++) {
                         const margin = 60;
                         const spawnX = margin + Math.random() * (canvas.width - margin * 2);
                         const spawnY = this.y + (Math.random() - 0.5) * 200;
                         game.asteroids.push(new SolidDecoy(game, spawnX, spawnY, this));
                     }
                }

                // Lock onto player
                if (game.player) {
                    const dx = game.player.x - this.x;
                    const dy = game.player.y - this.y;
                    const dist = Math.hypot(dx, dy);
                    
                    // Normalize and project to bottom of screen
                    // We want to dash through the player to the wall.
                    // If dy is negative (player above boss?), handle it.
                    // Boss is usually at top (y=150). Player at bottom.
                    
                    const scale = 2000; // Far enough
                    this.targetPos = {
                        x: this.x + (dx / dist) * scale,
                        y: this.y + (dy / dist) * scale
                    };
                    
                    // Calculate velocity now
                    const speed = this.enraged ? 40 : 25; // Very fast
                    this.dashVelocity = {
                        x: (dx / dist) * speed,
                        y: (dy / dist) * speed
                    };
                }
                audioManager.playSound('finalbossWarning');
            }
        } 
        else if (this.state === 'lock') {
             this.stateTimer -= dt;
             
             if (this.stateTimer <= 0) {
                 // Fake Lock Chance (30%)
                 if (this.enraged && Math.random() < 0.3) {
                      // Fake!
                      this.x = Math.random() * (canvas.width - 100) + 50;
                      this.y = Math.random() * 200 + 50;
                      this.trueX = this.x;
                      this.trueY = this.y;
                      this.stateTimer = 0.5; // Relock
                      game.createExplosion(this.x, this.y, 'cyan', 10);
                      game.updateGameStatus("FAKE OUT!");
                 } else {
                      this.state = 'dash';
                      this.dashCount = 3; // Reset Bounce Count
                      audioManager.playSound('enemyShoot'); // Dash sound
                 }
             }
        }
        else if (this.state === 'dash') {
             this.x += this.dashVelocity.x * moveFactor;
             this.y += this.dashVelocity.y * moveFactor;
             
             // Residual Void (Spawn Rifts)
             if (performance.now() - this.lastRiftTime > 100) { // Every 100ms
                 game.enemyProjectiles.push(new VoidRift(this.x, this.y));
                 this.lastRiftTime = performance.now();
             }

             // RICOCHET LOGIC (Enraged)
             let hitWall = false;
             if ((this.x < 0 && this.dashVelocity.x < 0) || (this.x > canvas.width && this.dashVelocity.x > 0)) {
                 this.dashVelocity.x *= -1;
                 hitWall = true;
             }
             if (this.y > canvas.height - this.size && this.dashVelocity.y > 0) {
                 this.dashVelocity.y *= -1; // Bounce up
                 hitWall = true;
             }
             if (this.y < this.size && this.dashVelocity.y < 0) {
                 this.dashVelocity.y *= -1; // Bounce down
                 hitWall = true;
             }
             
             // Fail-safe: If stuck deep below
             if (this.y > canvas.height + 200) {
                 this.y = this.initialY;
                 this.dashVelocity = { x: 0, y: 0 };
                 this.state = 'idle';
                 this.stateTimer = 1;
             }

             if (hitWall) {
                 game.createExplosion(this.x, this.y, 'cyan', 20);
                 
                 if (this.enraged && this.dashCount > 0) {
                     this.dashCount--;
                     // Continue Dashing
                 } else {
                     // SHATTER / REWIND
                     // Check Rewind Chance (30%)
                     if (this.enraged && Math.random() < 0.3) {
                          this.state = 'rewind';
                          // Velocity towards start
                          const dx = this.initialY - this.y; // Up
                          // Just fly straight up fast
                          this.dashVelocity = { x: 0, y: -40 }; 
                          game.updateGameStatus("TEMPORAL REWIND!");
                     } else {
                         // SHATTER
                         this.state = 'shattered';
                         this.stateTimer = 2; 
                         
                         const shatterX = this.x;
                         const shatterY = this.y;

                         game.createExplosion(shatterX, shatterY, this.color, 50);
                         
                         if (this.drone) { this.drone.health = 0; this.drone = null; }

                         this.x = -1000;
                         this.y = -1000;

                         game.screenShakeDuration = 20;
                         
                         const spawnY = Math.min(shatterY, canvas.height - 30);
                         const count = 8;
                         for (let i = 0; i < count; i++) {
                              const vx = (Math.random() - 0.5) * 10;
                              const vy = -(Math.random() * 5 + 10);
                              game.asteroids.push(new Breacher(game, { x: shatterX, y: spawnY, vx, vy }));
                         }
                     }
                 }
             }
        }
        else if (this.state === 'shattered') {
             this.stateTimer -= dt;
             if (this.stateTimer <= 0) {
                 // RESPAWN
                 this.x = Math.random() * (canvas.width - 100) + 50;
                 this.y = -100; // Fly in from top
                 this.state = 'enter'; // Re-enter
                 this.initialY = 100 + Math.random() * 100; // Vary height
                 
                 // Reset physics
                 this.vx = 0; 
                 this.vy = 0;
             }
        }
        
        // Glitch Step (Jitter Position in Idle/Lock)
        if (this.state === 'idle' || this.state === 'lock') {
             this.trueX = this.x;
             this.trueY = this.y;
             this.x += (Math.random() - 0.5) * 40;
             this.y += (Math.random() - 0.5) * 40;
        } else {
             // Ensure trueX tracks x during movement
             this.trueX = this.x;
             this.trueY = this.y;
        }
    }
}
