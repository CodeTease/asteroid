import * as UI from '../../ui.js';

/**
 * Draw the Drift overlay (orange tint + wind particles)
 * Extracted from game.js draw() L542-L556
 */
export function drawDriftOverlay(ctx, canvas) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 165, 0, 0.2)'; // Orange
    ctx.fillRect(-canvas.width, -canvas.height, canvas.width * 2, canvas.height * 2);
    
    // Wind effect particles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for(let i=0; i<20; i++) {
        const rx = Math.random() * canvas.width;
        const ry = Math.random() * canvas.height;
        ctx.fillRect(rx, ry, 20, 2);
    }
    ctx.restore();
}

/**
 * Draw the Darkness overlay (radial gradient with light holes)
 * Extracted from game.js draw() L566-L601
 */
export function drawDarknessOverlay(ctx, canvas, game) {
    ctx.save();
    ctx.fillStyle = 'black';
    ctx.globalAlpha = 0.95;
    ctx.fillRect(-canvas.width, -canvas.height, canvas.width * 2, canvas.height * 2);
    
    ctx.globalCompositeOperation = 'destination-out';
    
    // Cut hole for Player
    const drawLight = (x, y, r) => {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    };

    if (game.player && !game.player.isDestroyed) {
        drawLight(game.player.x, game.player.y, 150);
    }
    
    game.player.allies.forEach(a => drawLight(a.x, a.y, 100));
    if (game.laserAlly) drawLight(game.laserAlly.x, game.laserAlly.y, 100);
    if (game.echoAlly) drawLight(game.echoAlly.x, game.echoAlly.y, 100);
    if (game.echoAlly2) drawLight(game.echoAlly2.x, game.echoAlly2.y, 100);
    if (game.vampAlly) drawLight(game.vampAlly.x, game.vampAlly.y, 80);

    // Projectiles glow in dark
    game.projectiles.forEach(p => drawLight(p.x, p.y, 40));

    ctx.restore();
}

/**
 * Apply drift force to player position
 * Extracted from game.js update() L264-L271
 */
export function applyDriftForce(player, driftForce, dt, canvasWidth) {
    if (player && !player.isDestroyed) {
        player.x += driftForce * 60 * dt;
        // Keep in bounds
        if (player.x < player.size) player.x = player.size;
        if (player.x > canvasWidth - player.size) player.x = canvasWidth - player.size;
    }
}
