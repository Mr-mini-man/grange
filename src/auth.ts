import type { AuthUser } from "../shared/auth";
import { economy } from "./world/EconomyManager";
import { rebindAuth, setAuthToken } from "./socket";
import { useGameStore } from "./store";

export interface AuthResponse {
	ok: boolean;
	error?: string;
	user?: AuthUser;
	token?: string;
}

async function post(
	path: string,
	body: unknown,
): Promise<{ status: number; data: AuthResponse }> {
	const res = await fetch(`/api/auth${path}`, {
		method: "POST",
		credentials: "same-origin",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return { status: res.status, data: await res.json() };
}

function accept(data: AuthResponse): AuthResponse {
	if (data.ok && data.user) {
		useGameStore.getState().setUser(data.user);
		// The account owns the balance; adopt it so a fresh account starts at
		// the opening amount instead of inheriting the previous session's total.
		economy.setBalance(data.user.balance);
		setAuthToken(data.token ?? null);
		rebindAuth();
	}
	return data;
}

/**
 * Mirrors a balance change to the signed-in account. Best-effort: local play
 * continues even if the request fails, and it is re-synced on next auth.
 */
export async function saveBalanceDelta(delta: number): Promise<void> {
	if (!Number.isFinite(delta) || delta === 0) return;
	try {
		await fetch("/api/economy/transaction", {
			method: "POST",
			credentials: "same-origin",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ delta }),
		});
	} catch {
		// Ignore: a dropped sync must not break local gameplay.
	}
}

export async function register(input: {
	username: string;
	email: string;
	password: string;
}): Promise<AuthResponse> {
	return accept((await post("/register", input)).data);
}

export async function login(input: {
	username: string;
	password: string;
}): Promise<AuthResponse> {
	return accept((await post("/login", input)).data);
}

export async function logout(): Promise<void> {
	await post("/logout", {});
	useGameStore.getState().clearUser();
	setAuthToken(null);
	rebindAuth();
}

/** Resolves the session on page load. Returns null when there is no valid session. */
export async function fetchMe(): Promise<AuthUser | null> {
	const res = await fetch("/api/auth/me", { credentials: "same-origin" });
	if (!res.ok) {
		useGameStore.getState().clearUser();
		setAuthToken(null);
		return null;
	}
	const { user, token } = (await res.json()) as {
		user: AuthUser;
		token: string;
	};
	useGameStore.getState().setUser(user);
	economy.setBalance(user.balance);
	setAuthToken(token);
	rebindAuth();
	return user;
}
