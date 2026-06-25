import { canvas, ctx } from "../../ui.js";
import { audioManager } from "../../audio.js";
import { CONFIG } from "../../config.js";
import { Asteroid } from '../basic/asteroid.js';
import { MiniBehemoth } from './behemoth.js';

export class Monolith extends Asteroid {
    constructor(game) {
        super(game, { isBoss: true });
        this.size = 250;
        this.x = canvas.width / 2;
        this.y = -200;
        this.initialY = 150;
        this.health = 20000;
        this.maxHealth = 20000;
        this.color = '#000000'; // Vantablack
        this.type = 'monolith';
        
        this.coolingNodes = [
            { x: -85, y: 85, hp: 300, active: true },
            { x: 85, y: 85, hp: 300, active: true },
            { x: 0, y: 170, hp: 300, active: true }
        ];
        
        this.state = 'enter'; // enter, idle, attack, stunned
        this.stateTimer = 0;
        this.gravityPressActive = false;
        this.gravityTimer = 0;
    }

    draw(game) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Vantablack Body
        ctx.fillStyle = 'black';
        ctx.shadowColor = '#800080'; // Purple
        ctx.shadowBlur = 30;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        
        // Purple Outline (Vibrating)
        ctx.strokeStyle = `rgba(128, 0, 128, ${0.5 + Math.random() * 0.5})`;
        ctx.lineWidth = 5;
        ctx.strokeRect(-this.size/2, -this.size/2, this.size, this.size);

        // Cooling Nodes
        this.coolingNodes.forEach(node => {
            if (node.active) {
                ctx.fillStyle = '#00ffff'; // Blue
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(node.x, node.y, 15, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Stunned Effect
        if (this.state === 'stunned') {
             ctx.fillStyle = 'yellow';
             ctx.font = '30px Arial';
             ctx.fillText("⚡ STUNNED ⚡", -100, 0);
        }

        ctx.restore();

        // Gravity Press Visual
        if (this.gravityPressActive) {
             ctx.save();
             const grad = ctx.createLinearGradient(0, this.y + this.size/2, 0, canvas.height);
             grad.addColorStop(0, 'rgba(128, 0, 128, 0.5)');
             grad.addColorStop(1, 'rgba(128, 0, 128, 0)');
             ctx.fillStyle = grad;
             ctx.fillRect(0, this.y + this.size/2, canvas.width, canvas.height);
             ctx.restore();
        }
    }

    update(game, dt) {
        if (this.state === 'enter') {
            this.y += 20 * dt;
            if (this.y >= this.initialY) {
                this.y = this.initialY;
                this.state = 'idle';
                this.stateTimer = 2;
                game.updateGameStatus("MONOLITH DESCENDS!");
                game.screenShakeDuration = 60;
            }
            return;
        }

        if (this.state === 'stunned') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'idle';
                this.stateTimer = 2;
                // Respawn nodes if all dead? Or just recover?
                // Suggests nodes might regenerate or it's a one-time weakness phase. 
                // Let's regenerate them with lower HP to keep mechanic active.
                if (this.coolingNodes.every(n => !n.active)) {
                     this.coolingNodes.forEach(n => { n.active = true; n.hp = 200; });
                }
            }
            return;
        }

        // Logic check for nodes
        // Hit detection for nodes is complex in standard collision. 
        // We will assume player shoots body, and damage distributes or we check node collision manually in Game class.
        // For simplicity: If Monolith takes damage, check if it hit a node area?
        // Actually, let's implement the node hit logic in Game.checkCollisions or here if we pass projectiles.
        // Since Game handles collisions, we'll need to modify Game.js to handle node hits.

        if (this.state === 'idle') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'attack';
                this.stateTimer = 5; // Time between attacks
                this.chooseAttack(game);
            }
        } else if (this.state === 'attack') {
             this.stateTimer -= dt;
             if (this.stateTimer <= 0) {
                 this.state = 'idle';
                 this.stateTimer = 3;
                 this.gravityPressActive = false; // Reset gravity
             }
        }

        // Gravity Press Effect
        if (this.gravityPressActive) {
             if (game.player) {
                 game.player.y += 200 * dt; // Push down
                 if (game.player.y > canvas.height - 40) game.player.y = canvas.height - 40;
             }
             this.gravityTimer -= dt;
             if (this.gravityTimer <= 0) {
                 // SLAM
                 game.takeBarrierDamage(25);
                 game.createExplosion(game.player.x, canvas.height, '#800080', 50);
                 game.updateGameStatus("MONOLITH SLAM! BARRIER CRITICAL!");
                 this.gravityPressActive = false;
             }
        }
    }

    chooseAttack(game) {
        const rand = Math.random();
        if (rand < 0.4) {
            // Legion Gate
            game.updateGameStatus("Legion Gate Opened!");
            for(let i=0; i<3; i++) {
                // Spawn Elites
                const type = ['juggler', 'sizzler', 'tanker'][Math.floor(Math.random()*3)];
                game.asteroids.push(new Asteroid(game, { type, isElite: true, x: Math.random() * canvas.width, y: -50 }));
            }
        } else if (rand < 0.7) {
            // Mini Behemoth
            game.updateGameStatus("Mini-Behemoth Deployed!");
            // Ensure Mini-Behemoth does not spawn overlapping the Monolith itself
            const margin = 50; // safety margin from Monolith edges
            const leftBound = this.x - this.size / 2 - margin;
            const rightBound = this.x + this.size / 2 + margin;
            // pick a safe x that is outside the monolith horizontal bounds
            let spawnX = Math.random() * (canvas.width - 100) + 50;
            let attempts = 0;
            while (spawnX > leftBound && spawnX < rightBound && attempts < 10) {
                spawnX = Math.random() * (canvas.width - 100) + 50;
                attempts++;
            }
            // if still inside after attempts, push it to nearest side
            if (spawnX > leftBound && spawnX < rightBound) {
                if (spawnX < this.x) spawnX = Math.max(50, leftBound - margin);
                else spawnX = Math.min(canvas.width - 50, rightBound + margin);
            }
            game.asteroids.push(new MiniBehemoth(game, spawnX, 200));
        } else {
            // Gravity Press
            game.updateGameStatus("GRAVITY PRESS! BREAK THE NODES!");
            this.gravityPressActive = true;
            this.gravityTimer = 10; // 10s to stop it
        }
    }

    takeDamage(amount, source, hitX, hitY) {
        // Resistances
        let damage = amount;
        if (source === 'ai_ally') return 0; // Immune
        if (source === 'laser_ally') damage *= 0.1; // 90% resist
        if (source === 'player') damage *= 0.5; // 50% resist
        if (source === 'ultimate') {
             // Absorb
             this.health += 100;
             return 0; 
        }

        // Check Node Hit
        // Transform hitX/Y to local space
        const localX = hitX - this.x;
        const localY = hitY - this.y;
        
        let nodeHit = false;
        for (const node of this.coolingNodes) {
            if (node.active) {
                const dist = Math.hypot(localX - node.x, localY - node.y);
                if (dist < 20) {
                    // Critical Hit on Node
                    node.hp -= amount * 5; // Bonus damage to node
                    damage = amount * 2; // Bonus damage to boss
                    nodeHit = true;
                    if (node.hp <= 0) {
                        node.active = false;
                        // Check all nodes
                        if (this.coolingNodes.every(n => !n.active)) {
                             // STUN TRIGGER
                             this.state = 'stunned';
                             this.stateTimer = 5;
                             this.gravityPressActive = false; // Interrupt gravity
                             // Clear Player Heat
                             if (game.player) {
                                 game.player.heat = 0;
                                 game.player.isOverheated = false;
                                 game.updateGameStatus("NODES DESTROYED! HEAT CLEARED! BOSS STUNNED!");
                             }
                        }
                    }
                    break;
                }
            }
        }

        this.health -= damage;
        return damage;
    }
}
