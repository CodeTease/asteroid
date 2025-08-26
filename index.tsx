/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Game } from './src/game.js';
import * as UI from './src/ui.js';
import { audioManager } from './src/audio.js';

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();

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

    let shootInterval: number | null = null;
    const startShooting = () => {
        if (!shootInterval && game.player) {
            game.player.shoot(game);
            shootInterval = setInterval(() => game.player?.shoot(game), 200) as unknown as number;
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

    function handleTouchMove(e: TouchEvent) {
        e.preventDefault();
        if (e.touches.length > 0 && game.player) {
            const touch = e.touches[0];
            const rect = UI.canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            game.player.x = Math.max(game.player.size, Math.min(UI.canvas.width - game.player.size, touchX));
        }
    }

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

});