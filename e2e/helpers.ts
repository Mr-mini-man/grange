import type { Page } from "@playwright/test";

export const BASE = "http://localhost:3000";

/** Unique suffix so tests don't collide with each other or prior runs. */
export function uniqueName(base: string): string {
	return `${base}-${Math.floor(Math.random() * 1e9)}`;
}

/** Resets the server's in-memory state so each test starts clean. */
export async function resetServer(): Promise<void> {
	await fetch(`${BASE}/api/reset`, { method: "POST" });
}

/**
 * Reads back the last email the dev console mailer captured for an address.
 * Only available outside production, where real mail is sent instead.
 */
export async function mailboxFor(email: string): Promise<string> {
	const res = await fetch(
		`${BASE}/api/auth/mailbox?to=${encodeURIComponent(email)}`,
	);
	const body = (await res.json()) as { email?: { text: string } | null };
	if (!body.email) throw new Error(`no mail captured for ${email}`);
	return body.email.text;
}

/** Extracts a `token=` value from the mail line that contains `marker`. */
export function tokenFrom(text: string, marker: string): string {
	const line = text.split("\n").find((l) => l.includes(marker));
	if (!line) throw new Error(`no ${marker} link in mail`);
	const match = line.match(/token=([^\s&]+)/);
	if (!match) throw new Error("no token in link");
	return decodeURIComponent(match[1]);
}

/**
 * Registers a fresh account through the UI, follows the emailed verification
 * link, and leaves the page on the farm map. `/api/reset` wipes accounts too,
 * so the username only has to be unique within a test.
 */
export async function register(
	page: Page,
	username: string,
	password = "harvest-please",
): Promise<string> {
	const email = `${username}@example.test`;
	await page.goto(BASE);
	await page.getByTestId("toggle-mode").click();
	await page.getByTestId("username").fill(username);
	await page.getByTestId("email").fill(email);
	await page.getByTestId("password").fill(password);
	await page.getByRole("button", { name: /Create Account/i }).click();
	await page.getByTestId("auth-notice").waitFor();

	const token = tokenFrom(await mailboxFor(email), "/verify");
	await page.goto(`${BASE}/verify?token=${encodeURIComponent(token)}`);
	await page.waitForURL("**/world");
	return username;
}

/** Registers an account then signs in, leaving the page on the farm map. */
export async function login(
	page: Page,
	username: string,
	password = "harvest-please",
): Promise<void> {
	await register(page, username, password);
	await page.getByTestId("logout").click();
	await page.waitForURL(`${BASE}/`);
	await page.getByTestId("username").fill(username);
	await page.getByTestId("password").fill(password);
	await page.getByRole("button", { name: /Sign In/i }).click();
	await page.waitForURL("**/world");
}
