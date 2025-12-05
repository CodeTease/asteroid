// DOM Elements
export const canvas = document.getElementById('gameCanvas');
export const ctx = canvas.getContext('2d');
export const messageBox = document.getElementById('message-box');
export const messageTitle = document.getElementById('message-title');
export const messageText = document.getElementById('message-text');
export const messageButton = document.getElementById('message-button');
export const backToMenuButton = document.getElementById('back-to-menu-button');
export const playButton = document.getElementById('play-button');
export const howToPlayButton = document.getElementById('how-to-play-button');
export const mainContainer = document.getElementById('main-container');
export const loadingContainer = document.getElementById('loading-container');
export const gameArea = document.getElementById('game-area');
export const scoreDisplay = document.getElementById('score');
export const shieldDisplay = document.getElementById('shields');
export const gameStatus = document.getElementById('game-status');
export const timerDisplay = document.getElementById('timer');
export const upgradePointsDisplay = document.getElementById('upgrade-points');
export const upgradeModal = document.getElementById('upgrade-modal');
export const upgradePointsCount = document.getElementById('upgrade-points-count');
export const upgradeFirerateBtn = document.getElementById('upgrade-firerate');
export const upgradeDoubleshotBtn = document.getElementById('upgrade-doubleshot');
export const upgradeProjectilespeedBtn = document.getElementById('upgrade-projectilespeed');
export const firerateLevelDisplay = document.getElementById('firerate-level');
export const continueButton = document.getElementById('continue-button');
export const autoUpgradeCheckbox = document.getElementById('auto-upgrade-checkbox');
export const finalBossHealthContainer = document.getElementById('final-boss-health-container');
export const finalBossHealthBar = document.getElementById('final-boss-health-bar');
export const laserAllyUpgradesContainer = document.getElementById('laser-ally-upgrades');
export const upgradeLaserDamageBtn = document.getElementById('upgrade-laser-damage');
export const upgradeLaserCooldownBtn = document.getElementById('upgrade-laser-cooldown');
export const laserDamageLevelDisplay = document.getElementById('laser-damage-level');
export const laserCooldownLevelDisplay = document.getElementById('laser-cooldown-level');
export const howToPlayModal = document.getElementById('how-to-play-modal');
export const closeHowToPlayButton = document.getElementById('close-how-to-play-button');

// Heat Elements
export const heatGroup = document.getElementById('heat-group');
export const heatBar = document.getElementById('heat-bar');
export const overheatText = document.getElementById('overheat-text');


export function showMessage(title, text) {
    gameStatus.innerText = title;
    messageTitle.innerText = title;
    messageText.innerText = text;
    messageBox.classList.add('visible');
}

export function hideMessage(onHiddenCallback) {
    messageBox.classList.remove('visible');
    // Wait for animation to finish before restarting
    setTimeout(onHiddenCallback, 300);
}

export function updateUpgradePoints(points) {
    upgradePointsDisplay.innerText = `${points}`;
    upgradePointsCount.innerText = `${points}`;
}

export function updateUpgradeModal(points, upgrades, hasLaserAlly) {
    updateUpgradePoints(points);
    firerateLevelDisplay.innerText = `${upgrades.fireRateLevel}/5`;

    upgradeFirerateBtn.disabled = points < 1 || upgrades.fireRateLevel >= 5;
    upgradeDoubleshotBtn.disabled = points < 1 || upgrades.hasDoubleShot;
    upgradeProjectilespeedBtn.disabled = points < 1 || upgrades.hasFasterProjectiles;

    upgradeDoubleshotBtn.innerText = upgrades.hasDoubleShot ? "Purchased" : "Double Shot";
    upgradeProjectilespeedBtn.innerText = upgrades.hasFasterProjectiles ? "Purchased" : "Faster Projectiles";

    if (hasLaserAlly) {
        laserAllyUpgradesContainer.style.display = 'block';
        laserDamageLevelDisplay.innerText = `${upgrades.laserDamageLevel}/5`;
        laserCooldownLevelDisplay.innerText = `${upgrades.laserCooldownLevel}/5`;
        upgradeLaserDamageBtn.disabled = points < 3 || upgrades.laserDamageLevel >= 5;
        upgradeLaserCooldownBtn.disabled = points < 4 || upgrades.laserCooldownLevel >= 5;
    } else {
        laserAllyUpgradesContainer.style.display = 'none';
    }
}