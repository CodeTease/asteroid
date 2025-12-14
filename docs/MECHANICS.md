# Game Mechanics

Detailed information on the core systems that drive gameplay in Asteroid Destroyer.

## Heat System

The Heat System manages the player's firing rate and punishes spamming.

*   **Generation:** Every shot fired generates a specific amount of Heat.
*   **Cooling:** Heat dissipates naturally over time when not firing.
*   **Overheat:** If Heat reaches 100%, the ship enters an **Overheat** state. During this time:
    *   Weapons are disabled.
    *   Movement speed is reduced.
    *   The player is vulnerable until the system cools down completely.
*   **Enemy Interactions:**
    *   *Sizzlers:* These enemies increase your heat upon contact or proximity.
    *   *Vamp Ally:* Killing enemies with the Vamp Ally active can trigger "Heat Dissipation" (30% reduction) or a complete reset when killing Elite enemies.

## Upgrades & Allies

As the game progresses, players can acquire automated allies to assist in combat.

*   **AI Ally:** A basic drone that fires standard projectiles at nearby enemies.
*   **Laser Ally:** Fires a continuous or burst laser beam, effective against grouped enemies.
*   **Echo Ally:** Mimics the player's shots, effectively doubling firepower.
*   **Vamp Ally:** Acquired after defeating the **Behemoth**.
    *   *Passive:* Heals the Void Barrier when enemies are destroyed. 
    *   *Passive:* Helps manage player Heat. (Active on Crisis)

## Void Skills

Upon entering Void Mode (after defeating the Initial Final Boss), players are presented with a choice of one unique Ultimate Skill. This choice persists for the remainder of the run.

1.  **No Heat Mode:**
    *   Removes the Heat generation mechanic entirely.
    *   Allows for continuous, uninterrupted fire.

2.  **Permanent Echo:**
    *   Spawns a permanent Echo Ally that never despawns.
    *    significantly increases total DPS.

3.  **Ultimate Barrage:**
    *   Unlocks a devastating area-of-effect attack with a cooldown.
    *   Clears large swaths of enemies instantly.

## Void Barrier

The Void Barrier is a critical survival mechanic introduced in **Void Mode: Extended**.

*   **Function:** It acts as a secondary health bar specifically for the Void environment.
*   **Maintenance:** The barrier slowly decays and takes damage from enemy hits.
*   **Healing:** The **Vamp Ally** is the primary method of repairing the barrier (heals on enemy kills).
*   **Crisis Mode:** During Crisis Mode, the Barrier is capped at **50% maximum integrity**, making survival significantly harder.
*   **Consequence:** If the Barrier breaks, the player is exposed to immediate lethal damage from the Void environment and enemies.
