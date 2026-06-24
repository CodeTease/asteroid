import * as UI from '../ui.js';

export class UIManager {
    constructor() {
        this.statusMessageTimeout = null;
    }

    get canvas() {
        return UI.canvas;
    }

    get ctx() {
        return UI.ctx;
    }

    showMessage(title, text) {
        UI.showMessage(title, text);
    }

    updateHUD(game) {
        UI.scoreDisplay.innerText = `${game.score}`;
        UI.shieldDisplay.innerText = `${game.player.shieldCharges}`;
        const displayTime = game.finalBossDefeated ? game.getVoidTime() : game.gameTime;
        UI.timerDisplay.innerText = `${Math.floor(displayTime)}s`;
        UI.updateUpgradePoints(game.upgradePoints);
        
        // Update Heat Bar
        if (game.player) {
            const heatPercent = (game.player.heat / game.player.maxHeat) * 100;
            UI.heatBar.style.width = `${heatPercent}%`;
            
            if (game.player.isOverheated) {
                UI.overheatText.style.display = 'block';
                UI.heatBar.style.backgroundColor = 'red';
            } else {
                UI.overheatText.style.display = 'none';
                UI.heatBar.style.backgroundColor = ''; // Reset to gradient
            }
        }

        // Update Void Barrier (Only if unlocked)
        if (game.behemothDefeated) {
            const barrierPercent = (game.voidBarrierHealth / game.maxVoidBarrierHealth) * 100;
            UI.voidBarrierBar.style.width = `${Math.max(0, barrierPercent)}%`;
            if (game.voidBarrierHealth < 30) {
                 UI.voidBarrierBar.style.boxShadow = `0 0 15px red`;
                 UI.voidBarrierBar.style.background = `linear-gradient(90deg, red, #800000)`;
            } else {
                 UI.voidBarrierBar.style.boxShadow = `0 0 10px #00ffff`;
                 UI.voidBarrierBar.style.background = `linear-gradient(90deg, #00ffff, #0088ff)`;
            }
        }
    }

    updateGameStatus(text, autoFade = true) {
        if (this.statusMessageTimeout) {
            clearTimeout(this.statusMessageTimeout);
        }
        UI.gameStatus.innerText = text;
        UI.gameStatus.style.opacity = '1';

        if (autoFade) {
            this.statusMessageTimeout = setTimeout(() => {
                UI.gameStatus.style.opacity = '0';
            }, 2500);
        }
    }

    showFinalBossHealth() {
        UI.finalBossHealthContainer.style.display = 'block';
    }

    hideFinalBossHealth() {
        UI.finalBossHealthContainer.style.display = 'none';
    }

    updateFinalBossHealthBar(boss) {
        if (boss) {
            UI.finalBossHealthBar.style.width = `${Math.max(0, (boss.health / boss.maxHealth) * 100)}%`;
        }
    }

    showVoidBarrier() {
        UI.voidBarrierContainer.style.display = 'block';
    }

    hideVoidBarrier() {
        UI.voidBarrierContainer.style.display = 'none';
    }

    showHeatGroup() {
        UI.heatGroup.style.display = 'flex';
    }

    hideHeatGroup() {
        UI.heatGroup.style.display = 'none';
    }

    setTimerLabel(text) {
        UI.timerLabel.innerText = text;
    }

    flashBarrierHeal() {
        UI.voidBarrierBar.style.boxShadow = `0 0 20px #00ff00`;
        setTimeout(() => UI.voidBarrierBar.style.boxShadow = '', 200);
    }

    clearStatusTimeout() {
        if (this.statusMessageTimeout) {
            clearTimeout(this.statusMessageTimeout);
            this.statusMessageTimeout = null;
        }
    }
}
