/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Game } from './src/game.js';
import { Asteroid } from './src/classes.js';
import * as UI from './src/ui.js';
import { audioManager } from './src/audio.js';

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    window.game = game; // Expose for console debugging if needed

    // Play menu music on first user interaction
    const playMenuMusicOnFirstInteraction = async () => {
        // Browsers require a user interaction to start the AudioContext.
        await audioManager.initializeAfterInteraction();
        await audioManager.initMenuMusic();
        audioManager.playMenuMusic();
        // Remove the listener after the first interaction
        document.body.removeEventListener('click', playMenuMusicOnFirstInteraction);
        document.body.removeEventListener('keydown', playMenuMusicOnFirstInteraction);
    };
    document.body.addEventListener('click', playMenuMusicOnFirstInteraction, { once: true });
    document.body.addEventListener('keydown', playMenuMusicOnFirstInteraction, { once: true });


    UI.playButton.addEventListener('click', async () => {
        // Ensure context is initialized, fixing a race condition if this is the first interaction.
        await audioManager.initializeAfterInteraction();
        audioManager.stopMenuMusic();
        UI.mainContainer.classList.add('hidden');
        UI.loadingContainer.classList.add('visible');
        
        await audioManager.initGameSounds();

        UI.loadingContainer.classList.remove('visible');
        UI.gameArea.classList.add('visible');

        UI.gameArea.addEventListener('transitionend', () => {
            UI.gameArea.classList.add('fullscreen-game');
            game.resizeCanvas();
            game.start();
        }, { once: true });
    });

    UI.messageButton.addEventListener('click', () => { // "Play Again" button
        UI.hideMessage(() => {
            game.start();
        });
    });

    UI.backToMenuButton.addEventListener('click', () => {
        UI.hideMessage(() => {
            game.stop();
            game.init(); // Reset game state for a clean slate
            UI.gameArea.classList.remove('fullscreen-game');
            
            // Wait for the game area to shrink back before hiding it
            UI.gameArea.addEventListener('transitionend', () => {
                UI.gameArea.classList.remove('visible');
                UI.mainContainer.classList.remove('hidden');
            }, { once: true });
        });
    });

    // How to Play Modal Logic
    UI.howToPlayButton.addEventListener('click', () => {
        UI.howToPlayModal.classList.add('visible');
    });

    UI.closeHowToPlayButton.addEventListener('click', () => {
        UI.howToPlayModal.classList.remove('visible');
    });

    window.addEventListener('resize', () => {
        if (UI.gameArea.classList.contains('fullscreen-game')) {
            game.resizeCanvas();
        }
    });

    window.addEventListener('keydown', (e) => { game.keys[e.key] = true; });
    window.addEventListener('keyup', (e) => { game.keys[e.key] = false; });

    let shootInterval = null;
    const startShooting = () => {
        if (!shootInterval && game.player) {
            game.player.shoot(game);
            shootInterval = setInterval(() => game.player?.shoot(game), 200);
        }
    };
    const stopShooting = () => {
        if (shootInterval !== null) {
            clearInterval(shootInterval);
            shootInterval = null;
        }
    };

    UI.canvas.addEventListener('mousedown', startShooting);
    UI.canvas.addEventListener('mouseup', stopShooting);
    UI.canvas.addEventListener('mouseleave', stopShooting);

    function handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length > 0 && game.player) {
            const touch = e.touches[0];
            const rect = UI.canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;

            // Move player (Constraint to X axis mostly, but Aim Mode relies on touch position)
            // Classic movement:
            game.player.x = Math.max(game.player.size, Math.min(UI.canvas.width - game.player.size, touchX));
            
            // Update aim position
            game.mousePos = { x: touchX, y: touchY };
        }
    }

    // Capture mouse position for Aim Mode
    UI.canvas.addEventListener('mousemove', (e) => {
        const rect = UI.canvas.getBoundingClientRect();
        game.mousePos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    });

    UI.canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startShooting();
        if (e.touches.length > 0) {
            handleTouchMove(e);
            UI.canvas.addEventListener('touchmove', handleTouchMove);
        }
    });

    UI.canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        stopShooting();
        UI.canvas.removeEventListener('touchmove', handleTouchMove);
    });
    
    // Upgrade Modal Logic
    UI.continueButton.addEventListener('click', () => game.hideUpgradeModal());
    UI.upgradeFirerateBtn.addEventListener('click', () => {
        game.upgradeAlly('firerate');
        game.updateUpgradeModalUI();
    });
    UI.upgradeDoubleshotBtn.addEventListener('click', () => {
        game.upgradeAlly('doubleshot');
        game.updateUpgradeModalUI();
    });
    UI.upgradeProjectilespeedBtn.addEventListener('click', () => {
        game.upgradeAlly('projectilespeed');
        game.updateUpgradeModalUI();
    });
    UI.upgradeLaserDamageBtn.addEventListener('click', () => {
        game.upgradeAlly('laserDamage');
        game.updateUpgradeModalUI();
    });
    UI.upgradeLaserCooldownBtn.addEventListener('click', () => {
        game.upgradeAlly('laserCooldown');
        game.updateUpgradeModalUI();
    });
    UI.autoUpgradeCheckbox.addEventListener('change', () => {
        game.isAutoUpgradeEnabled = UI.autoUpgradeCheckbox.checked;
    });

    // --- DEBUG PANEL LISTENERS ---
    const debugPanel = document.getElementById('debug-panel');
    const debugToggle = document.getElementById('debug-toggle');
    const debugClose = document.getElementById('debug-close');
    const debugTimePlus = document.getElementById('debug-time-plus');
    const debugSummonBoss = document.getElementById('debug-summon-boss');
    const debugSpawnEnemy = document.getElementById('debug-spawn-enemy');
    const debugEnemySelect = document.getElementById('debug-enemy-select');
    const debugAddScore = document.getElementById('debug-add-score');
    const debugKillAll = document.getElementById('debug-kill-all');
    const debugGodMode = document.getElementById('debug-god-mode');

    // Make Void Enemies Selectable in Debug
    const voidEnemies = ['tanker', 'stunner', 'behemoth'];
    voidEnemies.forEach(type => {
        if (!debugEnemySelect.querySelector(`option[value="${type}"]`)) {
            const opt = document.createElement('option');
            opt.value = type;
            opt.innerText = type.charAt(0).toUpperCase() + type.slice(1);
            debugEnemySelect.appendChild(opt);
        }
    });

    debugToggle.addEventListener('click', () => {
        debugPanel.classList.toggle('hidden');
    });

    debugClose.addEventListener('click', () => {
        debugPanel.classList.add('hidden');
    });

    debugTimePlus.addEventListener('click', () => {
        game.gameTime += 60;
        game.updateHUD();
    });

    debugSummonBoss.addEventListener('click', () => {
        if (!game.isFinalBossActive) {
            game.spawnBoss(true);
        }
    });

    debugSpawnEnemy.addEventListener('click', () => {
        const type = debugEnemySelect.value;
        game.asteroids.push(new Asteroid(game, { type: type, y: -50 }));
    });

    debugAddScore.addEventListener('click', () => {
        game.score += 1000;
        game.upgradePoints += 10;
        game.updateHUD();
    });

    debugKillAll.addEventListener('click', () => {
        // Iterate backwards to safely remove
        for (let i = game.asteroids.length - 1; i >= 0; i--) {
            const asteroid = game.asteroids[i];
            if (!asteroid.isBoss) { // Don't kill Boss/Mini-boss usually, but request said "all enemies"
                 // Setting health to 0 triggers explosion and drops in game loop
                 asteroid.health = 0;
                 // Force immediate handle if we want instant clear, but letting game loop handle it
                 // creates a nice chain reaction of explosions.
                 // However, let's call handleAsteroidDestruction directly to ensure they are gone now
                 game.handleAsteroidDestruction(asteroid, i);
            } else {
                 // For bosses, maybe just deal massive damage?
                 // Request said "Kill all". Let's kill bosses too.
                 asteroid.health = 0;
                 game.handleAsteroidDestruction(asteroid, i);
            }
        }
    });

    debugGodMode.addEventListener('change', () => {
        game.godMode = debugGodMode.checked;
    });
});