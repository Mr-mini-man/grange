import type { Mailer, OutgoingEmail } from "./types";

const ENDPOINT = "https://api.mailjet.com/v3.1/send";

/**
 * Sends through Mailjet's REST API using fetch, so no SMTP dependency is
 * needed. Mailjet offers a free low-volume tier, which is why it is the default
 * production provider.
 */
export class MailjetMailer implements Mailer {
	constructor(
		private readonly apiKey: string,
		private readonly apiSecret: string,
		private readonly fromEmail: string,
		private readonly fromName: string,
	) {}

	async send(email: OutgoingEmail): Promise<void> {
		const auth = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString(
			"base64",
		);
		const res = await fetch(ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				Messages: [
					{
						From: { Email: this.fromEmail, Name: this.fromName },
						To: [{ Email: email.to }],
						Subject: email.subject,
						TextPart: email.text,
					},
				],
			}),
		});
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			throw new Error(`Mailjet send failed: ${res.status} ${detail}`);
		}
	}
}
