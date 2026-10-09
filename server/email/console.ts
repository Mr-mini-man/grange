import type { Mailer, OutgoingEmail } from "./types";

/**
 * Dev/test mailer. Instead of sending anything it logs the message and keeps it
 * in memory so the dev mailbox endpoint (and e2e tests) can read the link back
 * out. Never wired up when NODE_ENV=production and Mailjet is configured.
 */
export class ConsoleMailer implements Mailer {
	readonly sent: OutgoingEmail[] = [];

	async send(email: OutgoingEmail): Promise<void> {
		this.sent.push(email);
		console.log(
			`[mail] to=${email.to} subject=${JSON.stringify(email.subject)}\n${email.text}`,
		);
	}

	/** Most recent message for an address, or undefined. */
	latestTo(to: string): OutgoingEmail | undefined {
		for (let i = this.sent.length - 1; i >= 0; i--) {
			if (this.sent[i].to === to) return this.sent[i];
		}
		return undefined;
	}
}
