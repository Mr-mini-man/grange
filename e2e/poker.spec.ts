import { expect, test } from "@playwright/test";
import {
	register,
	resetServer,
	uniqueName,
	walkUntilPrompt,
} from "./helpers";

test("the poker table opens a playable sub-screen", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Shark"));

	const canvas = page.locator("canvas");
	const prompt = page.getByTestId("travel-prompt");
	await page.waitForLoadState("networkidle");

	// Farm -> marketplace.
	await page.keyboard.down("d");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");
	await expect(prompt).toContainText("travel to the marketplace");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Marketplace map/);

	// Marketplace -> casino.
	await page.keyboard.down("w");
	await page.keyboard.down("d");
	await page.waitForTimeout(2_900);
	await page.keyboard.up("w");
	await page.keyboard.up("d");
	await page.keyboard.down("d");
	await page.waitForTimeout(1_200);
	await page.keyboard.up("d");
	await expect(prompt).toContainText("enter the casino");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Casino map/);

	// Anchor on the blackjack prompt (same table row), drift down into the row,
	// then move left until the poker prompt shows. Polling while moving keeps
	// this reliable when slow frames shorten each fixed step.
	await walkUntilPrompt(page, ["s"], "play blackjack");
	await page.keyboard.down("s");
	await page.waitForTimeout(700);
	await page.keyboard.up("s");
	await walkUntilPrompt(page, ["a"], "play poker");
	await page.keyboard.press("e");

	const overlay = page.getByTestId("poker-overlay");
	await expect(overlay).toBeVisible();
	await expect(page.getByTestId("poker-balance")).toContainText("100");
	await expect(page.getByTestId("poker-deal")).toBeVisible();

	// Dealing posts the blinds and gives the player two hole cards.
	await page.getByTestId("poker-deal").click();
	await expect(page.getByTestId("poker-pot")).toContainText("15");
	await expect(
		page.getByTestId("poker-player-hand").locator('[role="img"]'),
	).toHaveCount(2);

	// Closing the overlay hands control back to the paused world.
	await page.getByTestId("poker-close").click();
	await expect(overlay).toHaveCount(0);
	await expect(canvas).toHaveAttribute("aria-label", /^Casino map/);
});
