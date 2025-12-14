# Development Guide

This document provides technical details for developers contributing to Asteroid Destroyer.

## Tech Stack

*   **Language:** Vanilla JavaScript (ES6 Modules).
*   **Rendering:** HTML5 Canvas API.
*   **Build Tool:** Vite (for local development server and bundling).
*   **Testing:** Playwright (for frontend verification).
*   **Styling:** CSS3.

## Setup & Installation

1.  **Prerequisites:**
    *   Node.js (v14 or higher recommended).
    *   npm (Node Package Manager).

2.  **Installation:**
    ```bash
    git clone <repository-url>
    cd asteroid-destroyer
    npm install
    ```

3.  **Running Locally:**
    Start the Vite development server:
    ```bash
    npm run dev
    ```
    Access the game at `http://localhost:5173`.

## Project Structure

The codebase is organized for modularity and ease of access.

### Core Files (`src/`)

*   **`src/game.js`**:
    *   The entry point for the game logic.
    *   Manages the Game Loop (`requestAnimationFrame`).
    *   Handles global state (score, time, game over).
    *   Initializes inputs and core systems.

*   **`src/classes.js`**:
    *   Contains all entity class definitions.
    *   **Structure:** Parent classes (e.g., `Entity`, `Asteroid`) are defined first, followed by child classes (e.g., `Player`, `Projectile`, `Enemy variants`).
    *   **Note:** Order is strictly maintained to prevent inheritance errors.

*   **src/config.js**:
    *   Central configuration file.
    *   Exports the `CONFIG` constant.
    *   Contains tunable parameters for:
        *   Enemy spawn rates and types.
        *   Player stats (speed, heat generation).
        *   Boss timings and health.
        *   Colors and UI settings.

*   **`src/ui.js`**:
    *   Manages the HUD and User Interface elements.
    *   Handles the Skill Selection modal.
    *   Updates health bars, timers, and score displays.

*   **`src/pool.js`**:
    *   Implements the Object Pool pattern.
    *   Manages reuse of high-frequency objects like `Projectiles` and `Particles` to optimize garbage collection.

*   **`src/debug.js`**:
    *   Standalone debug module.
    *   Injects a control panel for testing (God Mode, Spawn Entities, Kill All).
    *   Uses monkey-patching to hook into the main game loop.
