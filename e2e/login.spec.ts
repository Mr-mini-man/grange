import { expect, test } from "@playwright/test";
import { register, resetServer, uniqueName } from "./helpers";

test("registering an account opens the farm map", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));

	await expect(page).toHaveURL(/\/world$/);
	await expect(page.locator("canvas[aria-label^='Farm map']")).toBeVisible();
});

test("signing in opens the farm map", async ({ page }) => {
	await resetServer();
	const name = uniqueName("Sprout");

	await register(page, name);
	await page.getByTestId("logout").click();
	await page.waitForURL("/");

	await page.getByTestId("username").fill(name);
	await page.getByTestId("password").fill("harvest-please");
	await page.getByRole("button", { name: /Sign In/i }).click();

	await expect(page).toHaveURL(/\/world$/);
	await expect(page.locator("canvas[aria-label^='Farm map']")).toBeVisible();
});
