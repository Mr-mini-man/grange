import { expect, test } from "@playwright/test";
import {
	BASE,
	mailboxFor,
	register,
	resetServer,
	tokenFrom,
	uniqueName,
} from "./helpers";

test("an unverified account cannot sign in until the email is verified", async ({
	page,
}) => {
	await resetServer();
	const name = uniqueName("Sprout");
	const email = `${name}@example.test`;

	await page.goto(BASE);
	await page.getByTestId("toggle-mode").click();
	await page.getByTestId("username").fill(name);
	await page.getByTestId("email").fill(email);
	await page.getByTestId("password").fill("harvest-please");
	await page.getByRole("button", { name: /Create Account/i }).click();
	await expect(page.getByTestId("auth-notice")).toBeVisible();

	await page.getByTestId("username").fill(name);
	await page.getByTestId("password").fill("harvest-please");
	await page.getByRole("button", { name: /Sign In/i }).click();
	await expect(page.getByTestId("auth-error")).toContainText(/verify/i);
	await expect(page.getByTestId("resend-link")).toBeVisible();
	await expect(page).toHaveURL(`${BASE}/`);

	const token = tokenFrom(await mailboxFor(email), "/verify");
	await page.goto(`${BASE}/verify?token=${encodeURIComponent(token)}`);
	await page.waitForURL("**/world");
});

test("a verification link can only be used once", async ({ page }) => {
	await resetServer();
	const name = uniqueName("Sprout");
	const email = `${name}@example.test`;

	await page.goto(BASE);
	await page.getByTestId("toggle-mode").click();
	await page.getByTestId("username").fill(name);
	await page.getByTestId("email").fill(email);
	await page.getByTestId("password").fill("harvest-please");
	await page.getByRole("button", { name: /Create Account/i }).click();
	await expect(page.getByTestId("auth-notice")).toBeVisible();

	const token = tokenFrom(await mailboxFor(email), "/verify");
	const url = `${BASE}/verify?token=${encodeURIComponent(token)}`;
	await page.goto(url);
	await page.waitForURL("**/world");

	await page.getByTestId("logout").click();
	await page.waitForURL(`${BASE}/`);
	await page.goto(url);
	await expect(page.getByTestId("verify-status")).toContainText(
		/invalid or expired/i,
	);
});

test("a forgotten password can be reset through the emailed link", async ({
	page,
}) => {
	await resetServer();
	const name = uniqueName("Sprout");
	const email = `${name}@example.test`;
	await register(page, name);

	await page.getByTestId("logout").click();
	await page.waitForURL(`${BASE}/`);
	await page.getByTestId("forgot-link").click();
	await page.waitForURL("**/forgot");

	await page.getByTestId("forgot-email").fill(email);
	await page.getByTestId("forgot-submit").click();
	await expect(page.getByTestId("forgot-status")).toBeVisible();

	const token = tokenFrom(await mailboxFor(email), "/reset");
	await page.goto(`${BASE}/reset?token=${encodeURIComponent(token)}`);
	await page.getByTestId("reset-password").fill("brand-new-pass");
	await page.getByTestId("reset-submit").click();
	await expect(page.getByTestId("reset-status")).toBeVisible();

	await page.goto(BASE);
	await page.getByTestId("username").fill(name);
	await page.getByTestId("password").fill("brand-new-pass");
	await page.getByRole("button", { name: /Sign In/i }).click();
	await page.waitForURL("**/world");
});
