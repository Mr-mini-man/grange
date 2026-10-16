import { expect, test } from "@playwright/test";
import {
	BASE,
	enterFarm,
	register,
	registerAccount,
	resetServer,
	uniqueName,
} from "./helpers";

test("registering an account opens the farm map", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));

	await expect(page).toHaveURL(/\/world$/);
	await expect(page.locator("canvas[aria-label^='Farm map']")).toBeVisible();
});

test("signing in returns to the main menu, then opens the farm", async ({
	page,
}) => {
	await resetServer();
	const name = uniqueName("Sprout");
	await registerAccount(page, name);

	await page.getByTestId("menu-logout").click();
	await page.getByTestId("menu-login").click();
	await page.waitForURL("**/login");
	await page.getByTestId("username").fill(name);
	await page.getByTestId("password").fill("harvest-please");
	await page.getByRole("button", { name: /Sign In/i }).click();

	await expect(page).toHaveURL(`${BASE}/`);
	await expect(page.getByTestId("menu-user")).toContainText(name);

	await enterFarm(page);
	await expect(page).toHaveURL(/\/world$/);
	await expect(page.locator("canvas[aria-label^='Farm map']")).toBeVisible();
});
