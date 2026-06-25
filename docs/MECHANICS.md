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
    *   *Sizzlers:* These enemies affect heat generation and cooling rates.
    *   *Vamp Ally:* Killing enemies with the Vamp Ally active can trigger "Heat Dissipation" (30% reduction) or a complete reset when killing Elite enemies.

## Aim Mode

Unlocked after defeating the **Initial Final Boss**.

*   **Function:** Allows the player to aim and fire projectiles in any direction using the mouse cursor.
*   **Mechanic:** Changes the gameplay from fixed forward firing to full 360-degree combat flexibility.
*   **Heat Interaction:** Heat generation is active while Aim Mode is unlocked.

## Upgrades & Allies

As the game progresses, players can acquire automated allies to assist in combat.

*   **AI Ally:** A basic drone that fires standard projectiles at nearby enemies.
*   **Laser Ally:** Fires a continuous or burst laser beam, effective against grouped enemies.
*   **Echo Ally:** Mimics the player's shots, effectively doubling firepower.
*   **Vamp Ally:** Acquired after defeating the **Behemoth**.
    *   *Passive:* Heals the Void Barrier when enemies are destroyed (20% chance, increases to 100% in Crisis Mode).
    *   *Passive:* Helps manage player Heat: Killing normal enemies reduces heat by 30%, while killing Elite enemies resets heat entirely.

## Void Power

*   **Void Damage Buff:** Upon reaching 100 seconds in Void Time, the player's damage is doubled globally.

## Void Skills

After surviving **100 seconds in Void Mode**, players are presented with a choice of one unique Ultimate Skill. This choice persists for the remainder of the run.

1.  **No Heat Mode:**
    *   Removes the Heat generation mechanic for 60 seconds.
    *   Allows for continuous, uninterrupted fire.
    *   Cooldown: 120 seconds.

2.  **Permanent Echo:**
    *   Spawns a permanent Echo Ally that never despawns.
    *   Significantly increases total DPS.

3.  **Ultimate Barrage:**
    *   Unlocks a devastating area-of-effect attack with a 120s cooldown.
    *   Clears large swaths of enemies instantly.

## Void Barrier

The Void Barrier is a critical survival mechanic introduced in **Void Mode: Extended**.

*   **Function:** It acts as a secondary health bar specifically for the Void environment.
*   **Maintenance:** The barrier takes damage from enemy hits and when enemies escape past the player.
*   **Healing:** The **Vamp Ally** is the primary method of repairing the barrier (heals on enemy kills).
*   **Crisis Mode:** During Crisis Mode, the Barrier is capped at **50% maximum integrity**, making survival significantly harder.
*   **Consequence:** If the Barrier breaks, the player is exposed to immediate lethal damage from the Void environment and enemies.
