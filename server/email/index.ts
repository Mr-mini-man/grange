export { ConsoleMailer } from "./console";
export { MailjetMailer } from "./mailjet";
export {
	createMailer,
	passwordResetEmail,
	resetLink,
	verificationEmail,
	verifyLink,
} from "./templates";
export type { Mailer, OutgoingEmail } from "./types";
