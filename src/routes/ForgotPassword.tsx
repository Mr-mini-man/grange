import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../auth";
import AuthCard, {
	buttonClass,
	inputClass,
	labelClass,
} from "../components/AuthCard";

export default function ForgotPassword() {
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);
	const [busy, setBusy] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		setBusy(true);
		try {
			// Always succeeds server-side, so the response never reveals whether
			// the address is registered.
			await requestPasswordReset(email.trim());
			setSent(true);
		} finally {
			setBusy(false);
		}
	}

	return (
		<AuthCard subtitle="RESET PASSWORD">
			{sent ? (
				<p data-testid="forgot-status" className="text-center text-sm text-leaf">
					If that email is registered, a reset link is on its way.
				</p>
			) : (
				<form onSubmit={submit} className="flex flex-col gap-4">
					<label className={labelClass}>
						Email
						<input
							data-testid="forgot-email"
							type="email"
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className={inputClass}
						/>
					</label>
					<button
						type="submit"
						data-testid="forgot-submit"
						disabled={busy}
						className={buttonClass}
					>
						Send Reset Link
					</button>
				</form>
			)}

			<Link
				to="/"
				className="mt-4 block text-center text-xs tracking-wider text-husk underline-offset-2 hover:text-leaf hover:underline"
			>
				Back to sign in
			</Link>
		</AuthCard>
	);
}
