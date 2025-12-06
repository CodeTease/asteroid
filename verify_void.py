from playwright.sync_api import sync_playwright
import time

def verify_void_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/index.html")

        # 1. Start Game
        page.get_by_role("button", name="Play Now!").click()
        time.sleep(1)

        # 2. Open Debug Panel
        page.locator("#debug-toggle").click()

        # 3. Summon Boss
        page.locator("#debug-summon-boss").click()
        time.sleep(1)

        # 4. Kill Boss
        page.evaluate("game.finalBoss.health = 0")
        time.sleep(2)

        # 5. Close Upgrade Modal if it appeared (it likely did)
        # Check if visible
        if page.locator("#upgrade-modal").is_visible():
            page.locator("#continue-button").click()
            time.sleep(1)

        # 6. Fast Forward Time to 100s
        page.evaluate("game.gameTime = 100")
        time.sleep(1) # Wait for update loop

        # 7. Screenshot Modal
        page.screenshot(path="verification/void_skill_modal.png")

        # 8. Select Skill
        page.locator("#skill-no-heat").click()
        time.sleep(0.5)

        # 9. Verify HUD Button appeared
        page.screenshot(path="verification/hud_button.png")

        browser.close()

if __name__ == "__main__":
    verify_void_ui()
