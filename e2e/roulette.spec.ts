import { expect, test } from "@playwright/test";
import { register, resetServer, uniqueName, walkToCasino } from "./helpers";

test("the roulette table opens a playable sub-screen", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Spinner"));

	const canvas = page.locator("canvas");
	const prompt = page.getByTestId("travel-prompt");
	await page.waitForLoadState("networkidle");
	await walkToCasino(page);

	// Walk to the roulette table on the right and open the sub-screen.
	await page.keyboard.down("s");
	await page.keyboard.down("d");
	await page.waitForTimeout(1_800);
	await page.keyboard.up("s");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");
	await expect(prompt).toContainText("play roulette");
	await page.keyboard.press("e");

	const overlay = page.getByTestId("roulette-overlay");
	await expect(overlay).toBeVisible();
	await expect(page.getByTestId("roulette-balance")).toContainText("100");
	await expect(page.getByTestId("roulette-spin")).toBeDisabled();

	// Place 25 on red and see the chip land on the felt.
	await page.getByTestId("roulette-spot-outside:red").click();
	await expect(page.getByTestId("roulette-bet-dialog")).toBeVisible();
	await page.getByTestId("roulette-dialog-chip-25").click();
	await page.getByTestId("roulette-confirm").click();
	await expect(page.getByTestId("roulette-chip-outside:red")).toContainText(
		"25",
	);
	await expect(page.getByTestId("roulette-staked")).toContainText("25");

	// Spin and wait for the wheel to settle into a result.
	await page.getByTestId("roulette-spin").click();
	await expect(page.getByTestId("roulette-message")).toContainText("Spinning");
	await expect(page.getByTestId("roulette-play-again")).toBeVisible({
		timeout: 8_000,
	});
	await expect(page.getByTestId("roulette-result")).not.toHaveText("—");

	// Closing the overlay hands control back to the paused world.
	await page.getByTestId("roulette-close").click();
	await expect(overlay).toHaveCount(0);
	await expect(canvas).toHaveAttribute("aria-label", /^Casino map/);
});
