from playwright.sync_api import sync_playwright
import time

def verify_behemoth_and_buffs():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/index.html")

        # 1. Start Game
        page.get_by_role("button", name="Play Now!").click()
        time.sleep(1)

        # 2. Open Debug Panel
        page.locator("#debug-toggle").click()

        # 3. Summon Boss to kill it
        page.locator("#debug-summon-boss").click()
        time.sleep(1)
        page.evaluate("game.finalBoss.health = 0")
        time.sleep(2)

        # Close Upgrade Modal if visible
        if page.locator("#upgrade-modal").is_visible():
            page.locator("#continue-button").click()
            time.sleep(1)

        # 4. Handle Skill Selection (at 100s)
        # Advance time to 100s
        page.evaluate("game.gameTime += 105")
        time.sleep(1)

        # Select Ultimate Barrage
        page.locator("#skill-ultimate-barrage").click()
        time.sleep(0.5)

        # Screenshot Skill Button (Should say BARRAGE)
        page.screenshot(path="verification/behemoth_1_skill_ready.png")

        # Use Skill
        page.locator("#hud-skill-button").click()
        time.sleep(0.5)

        # Screenshot Skill Button (Should be Cooldown)
        page.screenshot(path="verification/behemoth_2_skill_cooldown.png")

        # 5. Spawn Behemoth (Debug Spawn)
        # Select Behemoth
        page.locator("#debug-enemy-select").select_option(value="behemoth")
        page.locator("#debug-spawn-enemy").click()
        time.sleep(2) # Wait for entry

        # Screenshot Behemoth
        page.screenshot(path="verification/behemoth_3_spawned.png")

        # 6. Verify Orbiter (Spawn Orbiter)
        page.locator("#debug-enemy-select").select_option(value="orbiter")
        page.locator("#debug-spawn-enemy").click()
        time.sleep(3) # Wait for orbit

        # Check if orbiter still alive
        count = page.evaluate("game.asteroids.filter(a => a.type === 'orbiter').length")
        print(f"Orbiter Count: {count}")

        browser.close()

if __name__ == "__main__":
    verify_behemoth_and_buffs()
