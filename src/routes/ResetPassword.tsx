import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPassword } from "../auth";
import AuthCard, {
	buttonClass,
	inputClass,
	labelClass,
} from "../components/AuthCard";

export default function ResetPassword() {
	const [params] = useSearchParams();
	const token = params.get("token") ?? "";
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [done, setDone] = useState(false);
	const [busy, setBusy] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		setBusy(true);
		setError("");
		try {
			const res = await resetPassword(token, password);
			if (res.ok) {
				setDone(true);
				return;
			}
			setError(res.error ?? "reset failed");
		} catch {
			setError("Could not reach the server");
		} finally {
			setBusy(false);
		}
	}

	return (
		<AuthCard subtitle="RESET PASSWORD">
			{done ? (
				<p data-testid="reset-status" className="text-center text-sm text-leaf">
					Password updated. You can sign in now.
				</p>
			) : (
				<form onSubmit={submit} className="flex flex-col gap-4">
					<label className={labelClass}>
						New Password
						<input
							data-testid="reset-password"
							type="password"
							autoComplete="new-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className={inputClass}
						/>
					</label>
					<button
						type="submit"
						data-testid="reset-submit"
						disabled={busy}
						className={buttonClass}
					>
						Set New Password
					</button>
					{error && (
						<p data-testid="reset-error" className="text-center text-sm text-pumpkin">
							{error}
						</p>
					)}
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
