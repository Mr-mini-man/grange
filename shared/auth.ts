export interface User {
	id: string;
	username: string;
	email: string;
	passwordHash: string;
	emailVerifiedAt: string | null;
	createdAt: string;
}

export type AuthUser = Omit<User, "passwordHash">;

export interface NewUser {
	username: string;
	email: string;
	passwordHash: string;
}

export interface Session {
	id: string;
	userId: string;
	tokenHash: string;
	expiresAt: string;
	createdAt: string;
}

/** A one-time, hashed token mailed to the user. */
export type TokenPurpose = "verify_email" | "reset_password";

export interface AuthToken {
	id: string;
	userId: string;
	purpose: TokenPurpose;
	tokenHash: string;
	expiresAt: string;
	createdAt: string;
}

export type AuthMe = {
	user: AuthUser;
};
