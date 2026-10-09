import { randomBytes } from "node:crypto";
import type { AuthToken, TokenPurpose } from "../../shared/auth";
import { hashToken } from "./sessions";
import type { UserStore } from "./store";

const TOKEN_BYTES = 32;

/** Verification is lenient; a reset link is short-lived because it changes a password. */
const TTL_MS: Record<TokenPurpose, number> = {
	verify_email: 24 * 60 * 60 * 1000,
	reset_password: 60 * 60 * 1000,
};

/**
 * Issues a fresh one-time token for the given purpose, replacing any earlier
 * token of the same kind so only the newest emailed link works. Returns the raw
 * token; only its hash is persisted.
 */
export async function issueToken(
	store: UserStore,
	userId: string,
	purpose: TokenPurpose,
): Promise<string> {
	await store.deleteAuthTokensForUser(userId, purpose);
	const token = randomBytes(TOKEN_BYTES).toString("base64url");
	const now = Date.now();
	const authToken: AuthToken = {
		id: crypto.randomUUID(),
		userId,
		purpose,
		tokenHash: hashToken(token),
		expiresAt: new Date(now + TTL_MS[purpose]).toISOString(),
		createdAt: new Date(now).toISOString(),
	};
	await store.createAuthToken(authToken);
	return token;
}

/**
 * Validates and burns a token. Returns the stored record on success, or null if
 * it is missing, expired, or for a different purpose. Consumption is atomic-ish:
 * the token is deleted before expiry is checked, so a used link never works twice.
 */
export async function consumeToken(
	store: UserStore,
	token: string | undefined,
	purpose: TokenPurpose,
): Promise<AuthToken | null> {
	if (!token) return null;
	const found = await store.findAuthTokenByHash(hashToken(token));
	if (!found || found.purpose !== purpose) return null;
	await store.deleteAuthTokenByHash(found.tokenHash);
	if (new Date(found.expiresAt).getTime() <= Date.now()) return null;
	return found;
}
