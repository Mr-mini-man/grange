/** A message the server can hand to any provider. */
export interface OutgoingEmail {
	to: string;
	subject: string;
	text: string;
}

/**
 * The only thing auth code knows about email. Swapping providers means writing
 * one more implementation; no caller changes.
 */
export interface Mailer {
	send(email: OutgoingEmail): Promise<void>;
}
