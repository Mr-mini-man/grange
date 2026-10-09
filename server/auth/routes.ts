import { Router } from "express";
import type { Request, Response } from "express";
import type { AuthMe, AuthUser } from "../../shared/auth";
import { ConsoleMailer } from "../email/console";
import type { Mailer } from "../email/types";
import {
	requestPasswordReset,
	resetPassword,
	sendVerificationEmail,
	verifyEmail,
} from "./email";
import { authenticate, register } from "./users";
import {
	COOKIE_NAME,
	createSessionFor,
	destroySession,
	readCookie,
	resolveSession,
} from "./sessions";
import type { UserStore } from "./store";

const SECURE = process.env.NODE_ENV === "production";

/** Resolves the signed-in user for a request, or undefined. */
export async function currentUser(
	store: UserStore,
	cookieHeader: string | undefined,
): Promise<AuthUser | undefined> {
	const user = await resolveSession(store, readCookie(cookieHeader, COOKIE_NAME));
	if (!user) return undefined;
	return {
		id: user.id,
		username: user.username,
		email: user.email,
		emailVerifiedAt: user.emailVerifiedAt,
		createdAt: user.createdAt,
	};
}

function setSessionCookie(res: Response, token: string): void {
	res.cookie(COOKIE_NAME, token, {
		httpOnly: true,
		sameSite: "lax",
		secure: SECURE,
		path: "/",
		maxAge: 30 * 24 * 60 * 60 * 1000,
	});
}

/** Best-effort send: a mail outage must not make the account appear missing. */
async function trySend(
	send: () => Promise<void>,
): Promise<{ sent: boolean }> {
	try {
		await send();
		return { sent: true };
	} catch (err) {
		console.error("[mail] send failed:", err);
		return { sent: false };
	}
}

export function authRouter(store: UserStore, mailer: Mailer): Router {
	const router = Router();

	router.post("/register", async (req, res) => {
		const result = await register(store, req.body ?? {});
		if (!result.ok) {
			res.status(400).json({ ok: false, error: result.error });
			return;
		}
		// No session yet: the account is locked until the emailed link is used.
		const { sent } = await trySend(() =>
			sendVerificationEmail(store, mailer, result.value),
		);
		res.status(201).json({
			ok: true,
			pending: true,
			emailSent: sent,
			message: "check your email to verify your account",
		});
	});

	router.post("/login", async (req, res) => {
		const result = await authenticate(store, req.body ?? {});
		if (!result.ok) {
			// A verified-email problem is actionable, so it is distinguished from
			// the generic credential failure; both still withhold a session.
			const status = result.code === "unverified" ? 403 : 401;
			res
				.status(status)
				.json({ ok: false, error: result.error, code: result.code });
			return;
		}
		const { token } = await createSessionFor(store, result.value.id);
		setSessionCookie(res, token);
		res.json({ ok: true, user: result.value });
	});

	router.post("/logout", async (req, res) => {
		await destroySession(store, readCookie(req.headers.cookie, COOKIE_NAME));
		res.clearCookie(COOKIE_NAME, { path: "/" });
		res.json({ ok: true });
	});

	router.get("/me", async (req, res) => {
		const user = await currentUser(store, req.headers.cookie);
		if (!user) {
			res.status(401).json({ ok: false, error: "not signed in" });
			return;
		}
		const body: AuthMe = { user };
		res.json({ ok: true, ...body });
	});

	router.post("/verify-email", async (req, res) => {
		const result = await verifyEmail(store, req.body?.token);
		if (!result.ok) {
			res.status(400).json({ ok: false, error: result.error });
			return;
		}
		// Verifying is proof enough to start a session, so the user lands signed in.
		const { token } = await createSessionFor(store, result.value.id);
		setSessionCookie(res, token);
		res.json({ ok: true, user: result.value });
	});

	router.post("/resend-verification", async (req, res) => {
		const email = String(req.body?.email ?? "")
			.trim()
			.toLowerCase();
		const user = email ? await store.findUserByEmail(email) : null;
		if (user && !user.emailVerifiedAt) {
			await trySend(() => sendVerificationEmail(store, mailer, user));
		}
		// Uniform response either way, so it cannot probe for accounts.
		res.json({ ok: true });
	});

	router.post("/request-password-reset", async (req, res) => {
		await requestPasswordReset(store, mailer, req.body?.email);
		res.json({ ok: true });
	});

	router.post("/reset-password", async (req, res) => {
		const result = await resetPassword(
			store,
			req.body?.token,
			req.body?.password,
		);
		if (!result.ok) {
			res.status(400).json({ ok: false, error: result.error });
			return;
		}
		res.json({ ok: true, user: result.value });
	});

	// Test/dev seam: read back the last email a ConsoleMailer captured. Absent
	// whenever real mail is configured, so production never exposes tokens.
	if (mailer instanceof ConsoleMailer) {
		router.get("/mailbox", (req: Request, res: Response) => {
			const to = String(req.query.to ?? "").toLowerCase();
			const email = to ? (mailer.latestTo(to) ?? null) : null;
			res.json({ ok: true, email });
		});
	}

	return router;
}
