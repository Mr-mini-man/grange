import { beforeEach, describe, expect, it } from "vitest";
import { hashToken } from "./sessions";
import { InMemoryUserStore } from "./store";
import { consumeToken, issueToken } from "./tokens";

let store: InMemoryUserStore;
let userId: string;

beforeEach(async () => {
	store = new InMemoryUserStore();
	userId = (
		await store.createUser({
			username: "farmer_jo",
			email: "jo@example.com",
			passwordHash: "$argon2id$fake",
		})
	).id;
});

describe("issueToken / consumeToken", () => {
	it("persists only the hash and resolves the raw token", async () => {
		const token = await issueToken(store, userId, "verify_email");
		expect(await store.findAuthTokenByHash(token)).toBeNull();

		const found = await consumeToken(store, token, "verify_email");
		expect(found?.userId).toBe(userId);
		expect(found?.purpose).toBe("verify_email");
	});

	it("burns the token so a link only works once", async () => {
		const token = await issueToken(store, userId, "verify_email");
		expect(await consumeToken(store, token, "verify_email")).not.toBeNull();
		expect(await consumeToken(store, token, "verify_email")).toBeNull();
	});

	it("rejects a token presented for a different purpose", async () => {
		const token = await issueToken(store, userId, "verify_email");
		expect(await consumeToken(store, token, "reset_password")).toBeNull();
	});

	it("rejects unknown and empty tokens", async () => {
		expect(await consumeToken(store, "garbage", "verify_email")).toBeNull();
		expect(await consumeToken(store, undefined, "verify_email")).toBeNull();
	});

	it("rejects an expired token", async () => {
		const token = await issueToken(store, userId, "reset_password");
		const stored = await store.findAuthTokenByHash(hashToken(token));
		if (!stored) throw new Error("token missing");
		stored.expiresAt = new Date(Date.now() - 1000).toISOString();
		expect(await consumeToken(store, token, "reset_password")).toBeNull();
	});

	it("replaces an earlier token of the same purpose", async () => {
		const first = await issueToken(store, userId, "verify_email");
		const second = await issueToken(store, userId, "verify_email");
		expect(await consumeToken(store, first, "verify_email")).toBeNull();
		expect(await consumeToken(store, second, "verify_email")).not.toBeNull();
	});
});
