import { expect, test } from "@playwright/test";
import {
	BASE,
	registerFast,
	uniqueName,
	useDoor,
	waitForWorld,
	walkToTrainDepot,
	walkUntilPrompt,
	worldUrl,
} from "./helpers";

test("the train depot sells engine and cart upgrades", async ({ page }) => {
	await registerFast(page, uniqueName("Engineer"), { area: "marketplace" });

	// Top up so the depot is affordable (the economy endpoint trusts deltas),
	// then reload so the client reads the new balance from the account.
	const topUp = await page.request.post(`${BASE}/api/economy/transaction`, {
		data: { delta: 1000 },
	});
	expect(topUp.ok()).toBeTruthy();
	await page.goto(worldUrl("marketplace"));
	await waitForWorld(page);

	await walkToTrainDepot(page);
	await useDoor(page);

	const depot = page.getByTestId("market-window");
	await expect(depot).toBeVisible();
	await expect(page.getByTestId("market-title")).toHaveText("Train Depot");
	await expect(page.getByTestId("market-subtab-train")).toBeVisible();
	await expect(page.getByTestId("train-depot-summary")).toContainText("Mk 1");
	await expect(page.getByTestId("train-depot-summary")).toContainText("1 cart");

	// The engine upgrade goes faster and pulls one more cart, for $400.
	await page.getByTestId("market-action-train-engine").click();
	await expect(page.getByTestId("train-depot-summary")).toContainText("Mk 2", {
		timeout: 15_000,
	});
	await expect(page.getByTestId("farm-balance")).toContainText("700");

	// With engine Mk 2 an extra cart is allowed; it lands in the summary.
	await page.getByTestId("market-action-train-cart").click();
	await expect(page.getByTestId("train-depot-summary")).toContainText(
		"2 carts",
		{ timeout: 15_000 },
	);
	await expect(page.getByTestId("farm-balance")).toContainText("400");

	await page.getByTestId("market-close").click();
	await expect(depot).toHaveCount(0);
});

test("the owner loads and unloads a cart's cargo", async ({ page }) => {
	await registerFast(page, uniqueName("Hauler"));
	await expect(page).toHaveURL(/\/world$/);
	await waitForWorld(page);

	// Walk to the cart end of the train and open the cargo window with C.
	await walkUntilPrompt(page, ["d"], "load the train", 20_000);
	await page.keyboard.press("c");

	const cargo = page.getByTestId("train-cargo-window");
	await expect(cargo).toBeVisible();
	await expect(page.getByTestId("train-cart-1")).toContainText("Cart 1");

	// Select the seed bag (hotbar slot 2) and quick-load it with Shift+E.
	await page.keyboard.press("2");
	await page.keyboard.press("Shift+E");
	await expect(page.getByTestId("train-cargo-slot-1-0")).toHaveAttribute(
		"data-item",
		"seed-bag",
		{ timeout: 15_000 },
	);

	// Clicking the loaded slot unloads it back into the hotbar.
	await page.getByTestId("train-cargo-slot-1-0").click();
	await expect(page.getByTestId("train-cargo-slot-1-0")).toHaveAttribute(
		"data-item",
		"",
		{ timeout: 15_000 },
	);
	await expect(
		page
			.getByTestId("train-cargo-player-hotbar")
			.getByTestId("slot-hotbar-1"),
	).toHaveAttribute("data-count", "10", { timeout: 15_000 });

	await page.getByTestId("train-cargo-close").click();
	await expect(cargo).toHaveCount(0);
});
