import { expect, test } from "@playwright/test";
import { register, resetServer, uniqueName } from "./helpers";

test("a farmer can till, plant, water, and shop at the market", async ({
	page,
}) => {
	await resetServer();
	await register(page, uniqueName("Brewer"));

	const hud = page.getByTestId("farm-hud");
	await expect(hud).toBeVisible();
	await expect(hud).toContainText("Coins 100");

	// Till an empty plot.
	await page.getByRole("button", { name: "till", exact: true }).click();
	await page.getByTestId("farm-cell-0-0").click();
	await expect(page.getByTestId("farm-cell-0-0")).toHaveAttribute(
		"title",
		/tilled soil/i,
	);

	// Plant a tomato, then water it.
	await page.getByRole("button", { name: "plant", exact: true }).click();
	await page.getByTestId("farm-cell-0-0").click();
	await expect(page.getByTestId("farm-cell-0-0")).toHaveAttribute(
		"title",
		/planted seed/i,
	);

	await page.getByRole("button", { name: "water", exact: true }).click();
	await page.getByTestId("farm-cell-0-0").click();
	await expect(page.getByTestId("farm-cell-0-0")).toHaveAttribute(
		"title",
		/watered/i,
	);

	// The market sells materials for grangecoins.
	await expect(page.getByTestId("market-panel")).toBeVisible();
	await page.getByRole("button", { name: /^Wood/ }).click();
	await expect(hud).toContainText("Wood 1");
});

test("the brewery can be built and a potion brewed", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Master"));

	const hud = page.getByTestId("farm-hud");
	await expect(hud).toBeVisible();

	// Fund the build: 10 wood and 8 stone (25 coins are left for the cost).
	const wood = page.getByRole("button", { name: /^Wood/ });
	for (let i = 0; i < 10; i += 1) await wood.click();
	const stone = page.getByRole("button", { name: /^Stone/ });
	for (let i = 0; i < 8; i += 1) await stone.click();

	await page.getByRole("button", { name: "brewery", exact: true }).click();
	await page.getByTestId("build-brewery").click();

	// Once built, the recipe panel replaces the build prompt.
	await expect(page.getByText("Green Thumb", { exact: true })).toBeVisible();
	await expect(page.getByTestId("build-brewery")).toHaveCount(0);
});
