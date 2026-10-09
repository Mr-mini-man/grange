import type { AuthUser, User } from "../../shared/auth";
import {
	passwordResetEmail,
	verificationEmail,
} from "../email/templates";
import type { Mailer } from "../email/types";
import { hashPassword } from "./passwords";
import { consumeToken, issueToken } from "./tokens";
import type { UserStore } from "./store";
import { MIN_PASSWORD, toAuthUser } from "./users";
import type { Result } from "./users";

/** Emails a fresh verification link to a just-registered (or resending) user. */
export async function sendVerificationEmail(
	store: UserStore,
	mailer: Mailer,
	user: Pick<User, "id" | "email">,
): Promise<void> {
	const token = await issueToken(store, user.id, "verify_email");
	await mailer.send(verificationEmail(process.env, user.email, token));
}

/** Burns a verification token and stamps the account verified. */
export async function verifyEmail(
	store: UserStore,
	token: unknown,
): Promise<Result<AuthUser>> {
	const found = await consumeToken(store, asString(token), "verify_email");
	if (!found) {
		return { ok: false, error: "this verification link is invalid or expired" };
	}
	const user = await store.findUserById(found.userId);
	if (!user) return { ok: false, error: "account not found" };

	if (!user.emailVerifiedAt) {
		user.emailVerifiedAt = new Date().toISOString();
		await store.updateUser(user);
	}
	return { ok: true, value: toAuthUser(user) };
}

/**
 * Starts a password reset. Always resolves the same way whether or not the
 * address exists, so the endpoint cannot be used to enumerate accounts.
 */
export async function requestPasswordReset(
	store: UserStore,
	mailer: Mailer,
	email: unknown,
): Promise<void> {
	const normalized = asString(email).trim().toLowerCase();
	if (!normalized) return;
	const user = await store.findUserByEmail(normalized);
	if (!user) return;
	const token = await issueToken(store, user.id, "reset_password");
	await mailer.send(passwordResetEmail(process.env, user.email, token));
}

/**
 * Completes a reset. Validates the new password before burning the token so a
 * too-short entry does not cost the user their link, then clears every session
 * so anyone holding the old password is signed out everywhere.
 */
export async function resetPassword(
	store: UserStore,
	token: unknown,
	password: unknown,
): Promise<Result<AuthUser>> {
	const next = asString(password);
	if (next.length < MIN_PASSWORD) {
		return {
			ok: false,
			error: `password must be at least ${MIN_PASSWORD} characters`,
		};
	}
	const found = await consumeToken(store, asString(token), "reset_password");
	if (!found) {
		return { ok: false, error: "this reset link is invalid or expired" };
	}
	const user = await store.findUserById(found.userId);
	if (!user) return { ok: false, error: "account not found" };

	user.passwordHash = await hashPassword(next);
	await store.updateUser(user);
	await store.deleteSessionsForUser(user.id);
	return { ok: true, value: toAuthUser(user) };
}

function asString(value: unknown): string {
	return typeof value === "string" ? value : "";
}
