import * as GameClasses from './classes.js';
import { CONFIG } from './config.js';

// --- STYLES ---
const DEBUG_STYLES = `
    #parasite-debug-panel {
        position: fixed;
        top: 10px;
        right: 10px;
        width: 300px;
        background: rgba(0, 0, 0, 0.9);
        border: 1px solid #00ff00;
        color: #00ff00;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        z-index: 10000;
        display: none;
        max-height: 90vh;
        overflow-y: auto;
        padding: 10px;
        box-shadow: 0 0 10px #00ff00;
    }
    #parasite-debug-toggle {
        position: fixed;
        top: 10px;
        right: 10px;
        width: 30px;
        height: 30px;
        background: #000;
        border: 1px solid #00ff00;
        color: #00ff00;
        text-align: center;
        line-height: 30px;
        cursor: pointer;
        z-index: 10001;
        font-weight: bold;
        user-select: none;
    }
    #parasite-debug-toggle:hover { background: #111; }
    .debug-module {
        border-bottom: 1px solid #333;
        padding: 5px 0;
        margin-bottom: 5px;
    }
    .debug-module h4 {
        margin: 0 0 5px 0;
        background: #111;
        padding: 2px;
        cursor: pointer;
        user-select: none;
    }
    .debug-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
    }
    .debug-btn {
        background: #222;
        border: 1px solid #00ff00;
        color: #00ff00;
        cursor: pointer;
        padding: 2px 5px;
        flex: 1;
        margin: 0 2px;
    }
    .debug-btn:hover { background: #333; }
    .debug-input {
        background: #000;
        border: 1px solid #555;
        color: #fff;
        width: 50px;
    }
    .debug-slider { width: 100px; }
`;

class DebugTool {
    constructor() {
        this.game = null;
        this.state = {
            godMode: false,
            noHeat: false,
            oneShot: false,
            timeScale: 1.0,
            hitboxOverlay: false,
            vectors: false,
            spawnGrid: false,
            statusLabels: false,
            inspector: false
        };
        this.selectedEntity = null;
        
        // Wait for game to be available
        const checkGame = setInterval(() => {
            if (window.game) {
                this.game = window.game;
                clearInterval(checkGame);
                this.init();
            }
        }, 100);
    }

    init() {
        console.log("[Parasite] Debug Tool Attached.");
        this.injectStyles();
        this.createUI();
        this.applyMonkeyPatches();
        this.hideLegacyDebug();
        
        // Loop for stats
        setInterval(() => this.updateStats(), 500);
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = DEBUG_STYLES;
        document.head.appendChild(style);
    }

    hideLegacyDebug() {
        const oldToggle = document.getElementById('debug-toggle');
        const oldPanel = document.getElementById('debug-panel');
        if (oldToggle) oldToggle.style.display = 'none';
        if (oldPanel) oldPanel.style.display = 'none';
    }

    createUI() {
        // Toggle Button
        const toggle = document.createElement('div');
        toggle.id = 'parasite-debug-toggle';
        toggle.innerText = '⚙️';
        toggle.onclick = () => {
            const panel = document.getElementById('parasite-debug-panel');
            const current = window.getComputedStyle(panel).display;
            panel.style.display = current === 'none' ? 'block' : 'none';
        };
        document.body.appendChild(toggle);

        // Main Panel
        const panel = document.createElement('div');
        panel.id = 'parasite-debug-panel';
        
        // Header
        const header = document.createElement('h3');
        header.innerText = 'PARASITE DEBUGGER v1.0';
        header.style.textAlign = 'center';
        header.style.marginTop = '0';
        panel.appendChild(header);

        // --- MODULES ---
        this.buildPlayerModule(panel);
        this.buildWorldModule(panel);
        this.buildSpawnModule(panel);
        this.buildViewModule(panel);
        this.buildSystemModule(panel);

        document.body.appendChild(panel);
    }

    // --- MODULE BUILDERS ---

    buildPlayerModule(container) {
        const mod = this.createModule('🛠️ PLAYER', container);
        
        // God Mode
        this.createCheckbox(mod, 'God Mode', this.state.godMode, (v) => {
            this.state.godMode = v;
            if (this.game) this.game.godMode = v;
        });

        // No Heat
        this.createCheckbox(mod, 'No Heat', this.state.noHeat, (v) => this.state.noHeat = v);

        // One Shot
        this.createCheckbox(mod, 'One-Shot Kill', this.state.oneShot, (v) => this.state.oneShot = v);
        
        // Shield Editor
        this.createNumberInput(mod, 'Shields', 0, (v) => {
            if (this.game && this.game.player) this.game.player.shieldCharges = v;
        });

        // Max Upgrades
        this.createButton(mod, 'Max Upgrades', () => {
            if (!this.game) return;
            this.game.allyUpgrades = {
                fireRateLevel: 5,
                hasDoubleShot: true,
                hasFasterProjectiles: true,
                laserDamageLevel: 5,
                laserCooldownLevel: 5
            };
            this.game.updateGameStatus("DEBUG: MAX UPGRADES APPLIED");
        });
        
        // Ally Toggle
        this.createButton(mod, 'Toggle Allies', () => {
             if (!this.game) return;
             if (this.game.laserAlly) {
                 this.game.laserAlly = null;
                 this.game.echoAlly = null;
                 this.game.player.allies = [];
                 this.game.updateGameStatus("Allies Removed");
             } else {
                 // Trigger upgrades that add allies
                 this.game.score = 5000;
                 this.game.checkUpgrades(); // Should re-add logic
                 this.game.updateGameStatus("Allies Toggled (Simulated)");
             }
        });
    }

    buildWorldModule(container) {
        const mod = this.createModule('🌍 WORLD', container);

        // Time Travel
        this.createNumberInput(mod, 'Set Game Time (s)', 0, (v) => {
            if (this.game) {
                this.game.gameTime = v;
                this.game.nextBossTime = v + 60;
                this.game.lastSpawnTime = performance.now();
                this.game.updateHUD();
            }
        });

        // Shortcuts
        const row = document.createElement('div');
        row.className = 'debug-row';
        ['Start', 'Void', 'Behemoth', 'Monolith', 'Crisis'].forEach((label, idx) => {
            const btn = document.createElement('button');
            btn.className = 'debug-btn';
            btn.innerText = label;
            btn.onclick = () => this.triggerShortcut(label);
            row.appendChild(btn);
        });
        mod.appendChild(row);

        // Time Scale
        const scaleRow = document.createElement('div');
        scaleRow.className = 'debug-row';
        scaleRow.innerHTML = `<span>Time Scale:</span> <span id="debug-timescale-val">1.0x</span>`;
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '5';
        slider.step = '0.1';
        slider.value = '1';
        slider.className = 'debug-slider';
        slider.oninput = (e) => {
            this.state.timeScale = parseFloat(e.target.value);
            document.getElementById('debug-timescale-val').innerText = this.state.timeScale.toFixed(1) + 'x';
        };
        scaleRow.appendChild(slider);
        mod.appendChild(scaleRow);

        // Event Overrides
        this.createButton(mod, 'Toggle Darkness', () => {
            if(this.game) this.game.isDarknessActive = !this.game.isDarknessActive;
        });
    }

    buildSpawnModule(container) {
        const mod = this.createModule('👾 SPAWN', container);

        // Dynamic Registry
        const spawnable = {};
        const { Asteroid } = GameClasses;

        // 1. Types from Config
        if (CONFIG.ENEMIES && CONFIG.ENEMIES.STATS) {
            Object.keys(CONFIG.ENEMIES.STATS).forEach(type => {
                spawnable[`Type: ${type}`] = { type: type };
            });
        }
        
        // 2. Classes from GameClasses
        Object.keys(GameClasses).forEach(key => {
            const cls = GameClasses[key];
            if (typeof cls === 'function' && cls.prototype instanceof Asteroid && cls !== Asteroid) {
                spawnable[`Class: ${key}`] = { class: cls };
            }
        });

        const select = document.createElement('select');
        select.style.width = '100%';
        select.style.marginBottom = '5px';
        select.style.background = '#000';
        select.style.color = '#fff';
        
        // Sort keys
        Object.keys(spawnable).sort().forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.innerText = k;
            select.appendChild(opt);
        });
        mod.appendChild(select);

        // Manual Trigger
        this.createButton(mod, 'Spawn Center', () => {
            if (!this.game) return;
            const key = select.value;
            const def = spawnable[key];
            if (def) {
                if (def.class) {
                    this.game.asteroids.push(new def.class(this.game));
                } else {
                    this.game.asteroids.push(new Asteroid(this.game, { type: def.type, x: this.game.player.x, y: 100 }));
                }
            }
        });
        
        // Boss Force
        this.createButton(mod, 'Force Boss', () => {
             if(this.game) this.game.spawnBoss(true);
        });
        
        // Horde
        this.createButton(mod, 'Horde (10x)', () => {
             if (!this.game) return;
             for(let i=0; i<10; i++) {
                 this.game.handleSpawning(); // Force spawn logic or random
                 this.game.asteroids.push(new Asteroid(this.game)); // Random
             }
        });
        
        // Nuke
        this.createButton(mod, '☢️ NUKE ALL', () => {
            if (!this.game) return;
            for (let i = this.game.asteroids.length - 1; i >= 0; i--) {
                const a = this.game.asteroids[i];
                a.health = 0;
                this.game.handleAsteroidDestruction(a, i);
            }
            this.game.enemyProjectiles = [];
        });
    }

    buildViewModule(container) {
        const mod = this.createModule('👁️ VIEW', container);
        this.createCheckbox(mod, 'Hitbox Overlay', this.state.hitboxOverlay, (v) => this.state.hitboxOverlay = v);
        this.createCheckbox(mod, 'Vectors', this.state.vectors, (v) => this.state.vectors = v);
        this.createCheckbox(mod, 'Status Labels', this.state.statusLabels, (v) => this.state.statusLabels = v);
        
        // Stats
        const stats = document.createElement('div');
        stats.id = 'debug-stats';
        stats.className = 'debug-row';
        stats.style.fontSize = '10px';
        stats.innerText = 'FPS: -- | Obj: --';
        mod.appendChild(stats);
    }

    buildSystemModule(container) {
        const mod = this.createModule('⚙️ SYSTEM', container);
        this.createCheckbox(mod, 'Inspector (Click)', this.state.inspector, (v) => this.state.inspector = v);
        
        const info = document.createElement('div');
        info.id = 'debug-inspector-info';
        info.style.whiteSpace = 'pre-wrap';
        info.style.fontSize = '10px';
        info.style.color = '#aaa';
        mod.appendChild(info);
    }

    // --- HELPERS ---

    createModule(title, container) {
        const div = document.createElement('div');
        div.className = 'debug-module';
        const h4 = document.createElement('h4');
        h4.innerText = title;
        h4.onclick = () => {
            const content = div.querySelectorAll('div, select, button');
            // Toggle visibility of children except header
            // Actually simpler: toggle a 'collapsed' class or loop children
            // The previous implementation was fine
            const isHidden = div.getAttribute('data-collapsed') === 'true';
            
            // Helper to toggle
            Array.from(div.children).forEach(c => {
                if (c !== h4) c.style.display = isHidden ? '' : 'none';
            });
            div.setAttribute('data-collapsed', !isHidden);
        };
        div.appendChild(h4);
        container.appendChild(div);
        return div;
    }

    createCheckbox(container, label, initial, onChange) {
        const row = document.createElement('div');
        row.className = 'debug-row';
        const lbl = document.createElement('label');
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = initial;
        chk.onchange = (e) => onChange(e.target.checked);
        lbl.appendChild(chk);
        lbl.appendChild(document.createTextNode(' ' + label));
        row.appendChild(lbl);
        container.appendChild(row);
    }

    createButton(container, text, onClick) {
        const btn = document.createElement('button');
        btn.className = 'debug-btn';
        btn.innerText = text;
        btn.onclick = onClick;
        container.appendChild(btn);
    }

    createNumberInput(container, label, initial, onChange) {
        const row = document.createElement('div');
        row.className = 'debug-row';
        row.innerText = label + ': ';
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.className = 'debug-input';
        inp.value = initial;
        inp.onchange = (e) => onChange(parseFloat(e.target.value));
        row.appendChild(inp);
        container.appendChild(row);
    }

    triggerShortcut(label) {
        if (!this.game) return;
        this.game.lastSpawnTime = performance.now();
        switch(label) {
            case 'Start':
                this.game.gameTime = 0;
                this.game.voidStartTime = 0;
                this.game.finalBossDefeated = false;
                this.game.init();
                break;
            case 'Void':
                this.game.finalBossDefeated = true;
                this.game.voidStartTime = this.game.gameTime - 100;
                this.game.behemothDefeated = false;
                break;
            case 'Behemoth':
                this.game.finalBossDefeated = true;
                this.game.voidStartTime = this.game.gameTime - 150;
                this.game.behemothSpawned = false; 
                break;
            case 'Monolith':
                this.game.finalBossDefeated = true;
                this.game.behemothDefeated = true;
                this.game.voidStartTime = this.game.gameTime - 300;
                break;
            case 'Crisis':
                this.game.finalBossDefeated = true;
                this.game.behemothDefeated = true;
                this.game.crisisMode = true;
                this.game.voidStartTime = this.game.gameTime - 600;
                break;
        }
        this.game.updateHUD();
    }

    updateStats() {
        if (!this.game) return;
        const el = document.getElementById('debug-stats');
        if (el) {
            const count = this.game.asteroids.length + this.game.projectiles.length + this.game.particles.length;
            el.innerText = `Entities: ${count} | Time: ${this.game.gameTime.toFixed(1)}s`;
        }
        
        if (this.state.inspector && this.selectedEntity) {
            const info = document.getElementById('debug-inspector-info');
            if (info) {
                 info.innerText = `Type: ${this.selectedEntity.type}\nHP: ${this.selectedEntity.health}\nX: ${Math.round(this.selectedEntity.x)} Y: ${Math.round(this.selectedEntity.y)}`;
            }
        }
    }

    // --- MONKEY PATCHING ---
    
    applyMonkeyPatches() {
        if (!this.game || this.game._monkeyPatched) return;
        this.game._monkeyPatched = true;
        
        // 1. Hook Update for Time Scale & No Heat
        const originalUpdate = this.game.update.bind(this.game);
        this.game.update = (dt) => {
            const scaledDt = dt * this.state.timeScale;
            
            // No Heat Logic
            if (this.state.noHeat && this.game.player) {
                this.game.player.heat = 0;
                this.game.player.isOverheated = false;
            }

            originalUpdate(scaledDt);
        };

        // 2. Hook CheckCollision for God Mode & One Shot
        const originalCheckCollision = this.game.checkCollision.bind(this.game);
        this.game.checkCollision = (obj1, obj2) => {
            if (this.state.godMode) {
                if (obj1 === this.game.player || obj2 === this.game.player) return false;
            }
            return originalCheckCollision(obj1, obj2);
        };

        // One Shot Logic (Force Damage via loop hook)
        const originalGameLoop = this.game.gameLoop.bind(this.game);
        this.game.gameLoop = (t) => {
            if (this.state.oneShot && this.game.projectiles) {
                this.game.projectiles.forEach(p => {
                    if (p.source === 'player') p.damage = 999999;
                });
            }
            originalGameLoop(t);
        };

        // 3. Hook Draw for View Module
        const originalDraw = this.game.draw.bind(this.game);
        this.game.draw = () => {
            originalDraw();
            
            const canvas = document.getElementById('gameCanvas');
            const context = canvas ? canvas.getContext('2d') : null;

            if (context) {
                context.save();
                
                if (this.state.hitboxOverlay) {
                    context.strokeStyle = 'red';
                    context.lineWidth = 1;
                    this.game.asteroids.forEach(a => {
                        context.beginPath();
                        context.arc(a.x, a.y, a.size, 0, Math.PI*2);
                        context.stroke();
                    });
                    if (this.game.player) {
                        context.strokeStyle = 'lime';
                        context.beginPath();
                        context.arc(this.game.player.x, this.game.player.y, this.game.player.size, 0, Math.PI*2);
                        context.stroke();
                    }
                }

                if (this.state.statusLabels) {
                    context.fillStyle = 'white';
                    context.font = '10px Arial';
                    this.game.asteroids.forEach(a => {
                        context.fillText(`HP:${Math.ceil(a.health)}`, a.x - 10, a.y - a.size - 5);
                    });
                }
                
                if (this.state.vectors) {
                    context.strokeStyle = 'yellow';
                    this.game.asteroids.forEach(a => {
                         context.beginPath();
                         context.moveTo(a.x, a.y);
                         context.lineTo(a.x + (a.vx||0)*10, a.y + (a.speed||0)*10);
                         context.stroke();
                    });
                }
                
                if (this.state.spawnGrid) {
                     context.strokeStyle = 'rgba(0, 255, 0, 0.2)';
                     context.beginPath();
                     for(let x=0; x<canvas.width; x+=50) { context.moveTo(x,0); context.lineTo(x, canvas.height); }
                     for(let y=0; y<canvas.height; y+=50) { context.moveTo(0,y); context.lineTo(canvas.width, y); }
                     context.stroke();
                }

                context.restore();
            }
        };

        // 4. System: Inspector & Drag Drop
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            let isDragging = false;
            
            canvas.addEventListener('mousedown', (e) => {
                if (e.button === 2 && this.state.inspector) { // Right click Smite
                     const rect = canvas.getBoundingClientRect();
                     const x = e.clientX - rect.left;
                     const y = e.clientY - rect.top;
                     const target = this.findEntityAt(x, y);
                     if (target) {
                         target.health = 0;
                         this.game.createExplosion(target.x, target.y, '#fff', 50);
                     }
                } else if (this.state.inspector) {
                     const rect = canvas.getBoundingClientRect();
                     const x = e.clientX - rect.left;
                     const y = e.clientY - rect.top;
                     this.selectedEntity = this.findEntityAt(x, y);
                     if (this.selectedEntity) isDragging = true;
                }
            });

            canvas.addEventListener('mousemove', (e) => {
                if (isDragging && this.selectedEntity) {
                    const rect = canvas.getBoundingClientRect();
                    this.selectedEntity.x = e.clientX - rect.left;
                    this.selectedEntity.y = e.clientY - rect.top;
                }
            });

            canvas.addEventListener('mouseup', () => isDragging = false);
            canvas.addEventListener('contextmenu', e => e.preventDefault());
        }
    }

    findEntityAt(x, y) {
        if (!this.game) return null;
        for (const a of this.game.asteroids) {
            const dist = Math.hypot(a.x - x, a.y - y);
            if (dist < a.size + 10) return a;
        }
        return null;
    }
}

// Auto-launch
new DebugTool();
