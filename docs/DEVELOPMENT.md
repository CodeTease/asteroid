# Development Guide

This document provides technical details for developers contributing to Asteroid Destroyer.

## Tech Stack

*   **Language:** Vanilla JavaScript (ES6 Modules).
*   **Rendering:** HTML5 Canvas API.
*   **Build Tool:** Vite (for local development server and bundling).
*   **Runtime:** Bun.
*   **Styling:** CSS3.

## Setup & Installation

1.  **Prerequisites:**
    *   [Bun](https://bun.sh/) (latest version recommended).

2.  **Installation:**
    ```bash
    git clone https://github.com/CodeTease/asteroid
    cd asteroid
    bun install
    ```

3.  **Running Locally:**
    Start the Vite development server:
    ```bash
    bun run dev
    ```
    Access the game at `http://localhost:5173`.

## Project Structure

The codebase is organized into modular directories for scalability and separation of concerns.

```
src/
├── main.js              # Application entry point
├── config.js            # Central configuration (CONFIG constant)
├── ui.js                # HUD, skill selection modal, health bars
├── pool.js              # Object Pool pattern for projectiles & particles
├── audio.js             # Sound effects and audio management
├── debug.js             # Debug panel (God Mode, Spawn Entities, Kill All)
├── index.css            # Global styles
├── core/
│   ├── game.js          # Game loop, global state, phase management
│   ├── spawner.js       # Enemy & item spawn logic
│   ├── collisions.js    # Collision detection & resolution
│   └── upgrades.js      # Upgrade/skill definitions
├── entities/
│   ├── player.js        # Player class
│   ├── projectiles.js   # Projectile classes
│   ├── particles.js     # Particle effects
│   └── items.js         # Collectible items
├── enemies/
│   ├── index.js         # Enemy barrel exports
│   ├── basic/
│   │   ├── asteroid.js  # Asteroid variants
│   │   └── static-mine.js
│   └── bosses/
│       ├── afterimage-boss.js
│       ├── behemoth.js
│       ├── breacher.js
│       ├── final-boss.js
│       ├── ghost-asteroid.js
│       └── monolith.js
└── allies/
    ├── index.js         # Ally barrel exports
    ├── ai-ally.js       # AI companion ally
    ├── echo-ally.js     # Echo ally
    ├── laser-ally.js    # Laser ally
    ├── solid-decoy.js   # Decoy ally
    └── vamp-ally.js     # Vampire ally
```

### Key Modules

*   **`src/main.js`** — Application entry point. Initializes the canvas, input handlers, and kicks off the game loop.

*   **`src/config.js`** — Central configuration file. Exports the `CONFIG` constant with tunable parameters for enemy spawn rates, player stats, boss timings, colors, and UI settings.

*   **`src/core/game.js`** — Core game loop (`requestAnimationFrame`), global state management (score, time, game over), and phase transitions.

*   **`src/core/spawner.js`** — Controls when and how enemies and items are spawned based on the current game phase and difficulty curve.

*   **`src/core/collisions.js`** — Collision detection and resolution between all game entities.

*   **`src/core/upgrades.js`** — Definitions for player upgrades and skills offered between phases.

*   **`src/entities/`** — Player, projectiles, particles, and collectible items. Each entity type lives in its own file.

*   **`src/enemies/`** — All enemy types, split into `basic/` (asteroids, mines) and `bosses/` (phase-end bosses with unique mechanics).

*   **`src/allies/`** — AI-controlled ally units the player can unlock, each with distinct behavior (laser, echo, vampire drain, decoy).

*   **`src/ui.js`** — Manages the HUD, skill selection modal, health bars, timers, and score displays.

*   **`src/pool.js`** — Implements the Object Pool pattern. Manages reuse of high-frequency objects like `Projectiles` and `Particles` to optimize garbage collection.

*   **`src/audio.js`** — Sound effect playback and audio management.

*   **`src/debug.js`** — Standalone debug module. Injects a control panel for testing (God Mode, Spawn Entities, Kill All). Uses monkey-patching to hook into the main game loop.
