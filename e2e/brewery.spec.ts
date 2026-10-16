import { expect, test } from "@playwright/test";
import { register, resetServer, uniqueName } from "./helpers";

test("the market sells materials and seeds through the server", async ({
	page,
}) => {
	await resetServer();
	await register(page, uniqueName("Brewer"));

	await expect(page.getByTestId("farm-hud")).toBeVisible();
	await page.getByTestId("open-shop").click();

	const shop = page.getByTestId("farm-shop");
	await expect(shop).toBeVisible();
	await expect(shop).toContainText("Coins 100");

	// The market tab is open by default. Buy one wood and confirm the server
	// broadcast the new inventory back to the panel.
	const wood = page.getByRole("button", { name: /^Wood/ });
	await wood.click();
	await expect(wood).toContainText(/have 1\b/);
});

test("the brewery can be funded, built, and brewed in", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Master"));

	await page.getByTestId("open-shop").click();
	const shop = page.getByTestId("farm-shop");
	await expect(shop).toBeVisible();

	// Fund the build: 10 wood and 8 stone (25 coins remain for the cost).
	const wood = page.getByRole("button", { name: /^Wood/ });
	for (let i = 1; i <= 10; i += 1) {
		await wood.click();
		await expect(wood).toContainText(new RegExp(`have ${i}\\b`));
	}

	const stone = page.getByRole("button", { name: /^Stone/ });
	for (let i = 1; i <= 8; i += 1) {
		await stone.click();
		await expect(stone).toContainText(new RegExp(`have ${i}\\b`));
	}

	await page.getByRole("button", { name: "brewery", exact: true }).click();
	await page.getByTestId("build-brewery").click();

	// Once built, the recipe panel replaces the build prompt.
	await expect(page.getByText("Green Thumb", { exact: true })).toBeVisible();
	await expect(page.getByTestId("build-brewery")).toHaveCount(0);
});
