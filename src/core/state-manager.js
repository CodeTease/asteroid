import { Mothership } from '../entities/mothership.js';
import { CONFIG } from '../config.js';

export class StateManager {
    constructor() {
        this.states = {};
        this.currentState = null;
    }

    register(name, state) {
        this.states[name] = state;
    }

    transition(name, game) {
        const nextState = this.states[name];
        if (!nextState) {
            console.error(`State ${name} not registered`);
            return;
        }
        if (this.currentState && this.currentState.exit) {
            this.currentState.exit(game);
        }
        this.currentState = nextState;
        if (this.currentState.enter) {
            this.currentState.enter(game);
        }
    }

    update(dt, game) {
        // Automatic state transition detection
        if (this.currentState === this.states['Normal'] && game.finalBossDefeated) {
            this.transition('Void', game);
        } else if (this.currentState === this.states['Void'] && game.crisisMode) {
            this.transition('Crisis', game);
        }

        if (this.currentState && this.currentState.update) {
            this.currentState.update(dt, game);
        }
    }

    draw(ctx, game) {
        if (this.currentState && this.currentState.draw) {
            this.currentState.draw(ctx, game);
        }
    }
}

export class NormalState {
    enter(game) {
        game.ui.hideVoidBarrier();
        game.ui.hideHeatGroup();
        game.ui.setTimerLabel("⏱️");
    }

    update(dt, game) {
        if (!game.isGameOver) {
            // Freezing time handled by main update loop
            game.spawner.handleSpawning();
        }
    }

    draw(ctx, game) {
        // Normal State has no special environment overlays to draw
    }
}

export class VoidState {
    enter(game) {
        game.ui.showHeatGroup();
        game.ui.setTimerLabel("Void Time");
    }

    update(dt, game) {
        if (!game.isGameOver) {
            game.spawner.handleSpawning();
        }
        
        // Handle environment events (Darkness, Overload, etc.)
        game.eventManager.update(dt, game);
        
        // Handle skills (cooldowns, modal activation)
        game.skillManager.update(dt, game);
    }

    draw(ctx, game) {
        game.eventManager.draw(ctx, game);
    }
}

export class CrisisState {
    enter(game) {
        game.ui.showHeatGroup();
        game.ui.setTimerLabel("Void Time");
        // Limit Barrier Max Health to 50
        game.voidBarrierHealth = Math.min(game.voidBarrierHealth, 50);
        game.maxVoidBarrierHealth = 50;
    }

    update(dt, game) {
        if (!game.isGameOver) {
            game.spawner.handleSpawning();
        }

        // Handle environmental events
        game.eventManager.update(dt, game);

        // Handle skills
        game.skillManager.update(dt, game);
    }

    draw(ctx, game) {
        game.eventManager.draw(ctx, game);
    }
}

export class AbyssState {
    enter(game) {
        game.isAbyssMode = true;
        game.abyssStartTime = game.gameTime;
        game.ui.setTimerLabel("Abyss Time");
        game.ui.hideVoidBarrier();
        
        // Recalculate world boundaries
        if (game.ui.canvas) {
            game.worldWidth = game.ui.canvas.width * CONFIG.ABYSS.WORLD_WIDTH_MULTIPLIER;
            game.worldHeight = game.ui.canvas.height * CONFIG.ABYSS.WORLD_HEIGHT_MULTIPLIER;
        }
        
        // Spawn Mothership at center of the expanded world
        game.mothership = new Mothership(game.worldWidth / 2, game.worldHeight / 2);
        
        // Relocate player to near mothership
        if (game.player) {
            game.player.x = game.worldWidth / 2;
            game.player.y = game.worldHeight / 2 + 100;
        }

        // Show UI elements (assume heat group is needed)
        game.ui.showHeatGroup();
    }

    update(dt, game) {
        if (!game.isGameOver) {
            // Re-use standard spawner for now (as requested)
            game.spawner.handleSpawning();
        }

        game.eventManager.update(dt, game);
        game.skillManager.update(dt, game);
    }

    draw(ctx, game) {
        game.eventManager.draw(ctx, game);
    }
}
