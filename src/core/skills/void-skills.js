import { audioManager } from '../../audio.js';
import { Monolith } from '../../enemies/index.js';

/**
 * Activate No Heat Mode
 * Extracted from game.js activateSkill() L928-L939
 */
export function activateNoHeat(game, skill) {
    const now = game.gameTime;
    if (now - skill.lastUsed >= skill.cooldown) {
        skill.active = true;
        skill.timer = skill.duration;
        skill.lastUsed = now;
        game.player.heat = 0;
        game.player.isOverheated = false;
        game.ui.updateGameStatus("NO HEAT MODE ACTIVATED!");
        audioManager.playSound('Playerupgraded');
        return true;
    } else {
        game.ui.updateGameStatus("Skill on Cooldown!");
        return false;
    }
}

/**
 * Activate Ultimate Barrage
 * Extracted from game.js activateSkill() L940-L948
 */
export function activateUltimateBarrage(game, skill) {
    const now = game.gameTime;
    if (now - skill.lastUsed >= skill.cooldown) {
        skill.lastUsed = now;
        fireUltimateBarrage(game);
        game.ui.updateGameStatus("ULTIMATE BARRAGE!");
        audioManager.playSound('finalbossExplosion');
        return true;
    } else {
        game.ui.updateGameStatus("Skill on Cooldown!");
        return false;
    }
}

/**
 * Fire Ultimate Barrage - Massive Spiral + Screen Wipe
 * Extracted from game.js fireUltimateBarrage() L952-L993
 */
export function fireUltimateBarrage(game) {
    // Ultimate Barrage Buff: Massive Spiral + Random Spread
    const count = 100;
    const playerX = game.player.x;
    const playerY = game.player.y;

    for (let i = 0; i < count; i++) {
        // Spiral Pattern
        const angle = (i / count) * Math.PI * 4; // 2 rotations
        const speed = 12 + Math.random() * 5;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        game.projectiles.push(game.projectilePool.get({
            x: playerX, y: playerY,
            vx, vy,
            size: 8,
            damage: 50,
            color: '#ff00ff',
            source: 'ultimate'
        }));
    }

    game.screenShakeDuration = 60;
    game.screenShakeIntensity = 20;
    game.createExplosion(playerX, playerY, '#ff00ff', 100);

    // Wipe Screen (kill all except bosses)
    for (let i = game.asteroids.length - 1; i >= 0; i--) {
        const a = game.asteroids[i];
        if (!a.isBoss) {
             a.health = 0;
             game.destructionHandler.handleAsteroidDestruction(a, i, game);
        } else {
            if (a instanceof Monolith) {
                 a.takeDamage(500, 'ultimate'); // Monolith absorbs/resists logic inside takeDamage
            } else {
                 a.health -= 500; // Big damage to normal bosses
            }
            game.createExplosion(a.x, a.y, a.color, 50);
        }
    }
}
