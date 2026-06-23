
import * as UI from '../ui.js';
import { audioManager } from '../audio.js';
import { CONFIG } from '../config.js';

export class UpgradeSystem {
    constructor(game) {
        this.game = game;
    }

    checkUpgrades() {
        if (this.game.score >= 250 && this.game.player.projectileSize < 7) {
            this.game.player.projectileSize = 7;
            this.game.player.projectileDamage = 2;
            this.game.updateGameStatus('Upgrade! Larger Bullets!');
            audioManager.playSound('Playerupgraded');
        }
        if (this.game.score >= 500 && this.game.player.fireRate < 2) {
            this.game.player.fireRate = 2;
            this.game.updateGameStatus('Upgrade! Double Shot!');
            audioManager.playSound('Playerupgraded');
        }
        if (this.game.score >= 2000 && this.game.player.allies.length === 0) {
            this.game.player.allies.push(new AIAlly('left'));
            this.game.player.allies.push(new AIAlly('right'));
            this.game.updateGameStatus('Upgrade! AI Allies!');
            audioManager.playSound('Playerupgraded', 0.8);
        }
        if (this.game.score >= 5000 && !this.game.laserAlly) {
            this.game.laserAlly = new LaserAlly();
            this.game.laserAlly.applyUpgrades(this);
            this.game.updateGameStatus('Laser Ally joined the battle!');
            audioManager.playSound('Playerupgraded', 0.8);
        }
        if (this.game.score >= this.game.nextShieldScore) {
            this.game.player.shieldCharges += 3;
            this.game.nextShieldScore += 1500;
            this.game.updateGameStatus('Shield Recharged!');
            audioManager.playSound('Playerupgraded');
        }
    }

    triggerAllyUpgradeEffect(ally) {
        this.game.createExplosion(ally.x, ally.y, '#ffd700', 30);
    }

    showUpgradeModal() {
        this.game.isPaused = true;
        this.updateUpgradeModalUI();
        UI.upgradeModal.classList.add('visible');
    }

    hideUpgradeModal() {
        UI.upgradeModal.classList.remove('visible');
        this.game.isPaused = false;
        this.game.lastTime = performance.now();
        this.game.lastSpawnTime = performance.now();
    }

    updateUpgradeModalUI() {
        UI.updateUpgradeModal(this.game.upgradePoints, this.game.allyUpgrades, !!this.game.laserAlly);
    }

    areAllUpgradesMaxed() {
        return this.game.allyUpgrades.fireRateLevel >= 5 &&
               this.game.allyUpgrades.hasDoubleShot &&
               this.game.allyUpgrades.hasFasterProjectiles &&
               (!this.game.laserAlly || (this.game.allyUpgrades.laserDamageLevel >= 5 && this.game.allyUpgrades.laserCooldownLevel >= 5));
    }

    autoUpgradeAllies() {
        let upgraded = false;
        while (this.game.upgradePoints > 0 && !this.areAllUpgradesMaxed()) {
             if (this.game.allyUpgrades.fireRateLevel < 5 && this.game.upgradePoints >= 1) {
                this.upgradeAlly('firerate'); upgraded = true;
            } else if (!this.game.allyUpgrades.hasDoubleShot && this.game.upgradePoints >= 1) {
                this.upgradeAlly('doubleshot'); upgraded = true;
            } else if (!this.game.allyUpgrades.hasFasterProjectiles && this.game.upgradePoints >= 1) {
                this.upgradeAlly('projectilespeed'); upgraded = true;
            } else if (this.game.laserAlly && this.game.allyUpgrades.laserDamageLevel < 5 && this.game.upgradePoints >= 3) {
                this.upgradeAlly('laserDamage'); upgraded = true;
            } else if (this.game.laserAlly && this.game.allyUpgrades.laserCooldownLevel < 5 && this.game.upgradePoints >= 4) {
                 this.upgradeAlly('laserCooldown'); upgraded = true;
            } else {
                break;
            }
        }
    }

    upgradeAlly(type) {
        let cost = 0;
        switch (type) {
            case 'firerate': cost = 1; if (this.game.allyUpgrades.fireRateLevel < 5) { this.game.upgradePoints -= cost; this.game.allyUpgrades.fireRateLevel++; } break;
            case 'doubleshot': cost = 1; if (!this.game.allyUpgrades.hasDoubleShot) { this.game.upgradePoints -= cost; this.game.allyUpgrades.hasDoubleShot = true; } break;
            case 'projectilespeed': cost = 1; if (!this.game.allyUpgrades.hasFasterProjectiles) { this.game.upgradePoints -= cost; this.game.allyUpgrades.hasFasterProjectiles = true; } break;
            case 'laserDamage': cost = 3; if (this.game.allyUpgrades.laserDamageLevel < 5) { this.game.upgradePoints -= cost; this.game.allyUpgrades.laserDamageLevel++; } break;
            case 'laserCooldown': cost = 4; if (this.game.allyUpgrades.laserCooldownLevel < 5) { this.game.upgradePoints -= cost; this.game.allyUpgrades.laserCooldownLevel++; } break;
        }

        if (cost > 0) {
             audioManager.playSound('AIupgraded');
        }

        if (type.startsWith('laser')) {
            if (this.game.laserAlly) { this.game.laserAlly.applyUpgrades(this); this.triggerAllyUpgradeEffect(this.game.laserAlly); }
        } else {
            this.game.player.allies.forEach(ally => this.triggerAllyUpgradeEffect(ally));
        }
    }
}
