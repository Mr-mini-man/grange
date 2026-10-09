import { beforeEach, describe, expect, it } from "vitest";
import type { AuthUser } from "../../shared/auth";
import { ConsoleMailer } from "../email/console";
import {
	requestPasswordReset,
	resetPassword,
	sendVerificationEmail,
	verifyEmail,
} from "./email";
import { createSessionFor, resolveSession } from "./sessions";
import { InMemoryUserStore } from "./store";
import { authenticate, register } from "./users";

const good = {
	username: "farmer_jo",
	email: "jo@example.com",
	password: "correct-horse",
};

let store: InMemoryUserStore;
let mail: ConsoleMailer;
let user: AuthUser;

beforeEach(async () => {
	store = new InMemoryUserStore();
	mail = new ConsoleMailer();
	const res = await register(store, good);
	if (!res.ok) throw new Error("register failed");
	user = res.value;
	// Verify on a throwaway mailer so `mail` stays empty for each test.
	const setupMail = new ConsoleMailer();
	await sendVerificationEmail(store, setupMail, user);
	await verifyEmail(store, tokenFrom(setupMail, good.email, "/verify"));
});

/** Pulls the token out of the last link the given mailer captured. */
function tokenFrom(
	source: ConsoleMailer,
	to: string,
	marker: string,
): string {
	const email = source.latestTo(to);
	if (!email) throw new Error(`no mail for ${to}`);
	const line = email.text.split("\n").find((l) => l.includes(marker));
	if (!line) throw new Error(`no ${marker} link in mail`);
	const match = line.match(/token=([^\s&]+)/);
	if (!match) throw new Error("no token in link");
	return decodeURIComponent(match[1]);
}

describe("verification", () => {
	it("emails a link that unlocks sign-in", async () => {
		const fresh = new InMemoryUserStore();
		const res = await register(fresh, {
			...good,
			username: "sprout_jo",
			email: "sprout@example.com",
		});
		if (!res.ok) throw new Error("register failed");
		await sendVerificationEmail(fresh, mail, res.value);
		expect(mail.latestTo("sprout@example.com")?.subject).toMatch(/verify/i);

		const result = await verifyEmail(
			fresh,
			tokenFrom(mail, "sprout@example.com", "/verify"),
		);
		expect(result.ok).toBe(true);

		const login = await authenticate(fresh, {
			username: "sprout_jo",
			password: good.password,
		});
		expect(login.ok).toBe(true);
	});

	it("rejects a link that has already been used", async () => {
		await sendVerificationEmail(store, mail, user);
		const token = tokenFrom(mail, good.email, "/verify");
		expect((await verifyEmail(store, token)).ok).toBe(true);
		expect((await verifyEmail(store, token)).ok).toBe(false);
	});

	it("rejects an unknown token", async () => {
		expect((await verifyEmail(store, "not-a-token")).ok).toBe(false);
	});
});

describe("password reset", () => {
	it("only mails a known address", async () => {
		await requestPasswordReset(store, mail, "nobody@example.com");
		expect(mail.sent).toHaveLength(0);

		await requestPasswordReset(store, mail, good.email);
		expect(mail.latestTo(good.email)?.subject).toMatch(/reset/i);
	});

	it("changes the password and invalidates the old one", async () => {
		await requestPasswordReset(store, mail, good.email);
		const token = tokenFrom(mail, good.email, "/reset");
		expect((await resetPassword(store, token, "brand-new-pass")).ok).toBe(true);

		expect(
			(
				await authenticate(store, {
					username: good.username,
					password: "brand-new-pass",
				})
			).ok,
		).toBe(true);
		expect(
			(
				await authenticate(store, {
					username: good.username,
					password: good.password,
				})
			).ok,
		).toBe(false);
	});

	it("clears existing sessions after a reset", async () => {
		const { token: sessionToken } = await createSessionFor(store, user.id);
		await requestPasswordReset(store, mail, good.email);
		const token = tokenFrom(mail, good.email, "/reset");
		await resetPassword(store, token, "brand-new-pass");
		expect(await resolveSession(store, sessionToken)).toBeNull();
	});

	it("does not burn the link on a too-short password", async () => {
		await requestPasswordReset(store, mail, good.email);
		const token = tokenFrom(mail, good.email, "/reset");
		expect((await resetPassword(store, token, "short")).ok).toBe(false);
		expect((await resetPassword(store, token, "long-enough-pass")).ok).toBe(true);
	});
});
