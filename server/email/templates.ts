import { ConsoleMailer } from "./console";
import { MailjetMailer } from "./mailjet";
import type { Mailer } from "./types";

function appUrl(env: NodeJS.ProcessEnv): string {
	return (env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function verifyLink(env: NodeJS.ProcessEnv, token: string): string {
	return `${appUrl(env)}/verify?token=${encodeURIComponent(token)}`;
}

export function resetLink(env: NodeJS.ProcessEnv, token: string): string {
	return `${appUrl(env)}/reset?token=${encodeURIComponent(token)}`;
}

export function verificationEmail(
	env: NodeJS.ProcessEnv,
	to: string,
	token: string,
): { to: string; subject: string; text: string } {
	return {
		to,
		subject: "Verify your Grange email",
		text: [
			"Welcome to Grange!",
			"",
			"Confirm this address to finish setting up your account:",
			verifyLink(env, token),
			"",
			"This link expires in 24 hours. If you didn't sign up, ignore this email.",
		].join("\n"),
	};
}

export function passwordResetEmail(
	env: NodeJS.ProcessEnv,
	to: string,
	token: string,
): { to: string; subject: string; text: string } {
	return {
		to,
		subject: "Reset your Grange password",
		text: [
			"We received a request to reset your Grange password.",
			"",
			"Choose a new password here:",
			resetLink(env, token),
			"",
			"This link expires in 1 hour. If you didn't ask for this, ignore this email.",
		].join("\n"),
	};
}

/**
 * Picks the production provider when credentials are present. Otherwise, in
 * non-production, falls back to the console mailer. Production with no
 * credentials is a hard error: silently dropping verification mail would lock
 * every account out.
 */
export function createMailer(env: NodeJS.ProcessEnv = process.env): Mailer {
	const key = env.MAILJET_API_KEY;
	const secret = env.MAILJET_API_SECRET;
	const from = env.MAIL_FROM_EMAIL;
	if (key && secret && from) {
		return new MailjetMailer(key, secret, from, env.MAIL_FROM_NAME ?? "Grange");
	}
	if (env.NODE_ENV === "production") {
		throw new Error(
			"Email is not configured: set MAILJET_API_KEY, MAILJET_API_SECRET and MAIL_FROM_EMAIL",
		);
	}
	return new ConsoleMailer();
}
