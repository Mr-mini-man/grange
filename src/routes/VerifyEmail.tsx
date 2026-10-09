import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resendVerification, verifyEmail } from "../auth";
import AuthCard, {
	buttonClass,
	inputClass,
	labelClass,
} from "../components/AuthCard";

type Status = "working" | "error" | "idle";

export default function VerifyEmail() {
	const [params] = useSearchParams();
	const token = params.get("token") ?? "";
	const navigate = useNavigate();
	const [status, setStatus] = useState<Status>(token ? "working" : "idle");
	const [error, setError] = useState("");
	const [email, setEmail] = useState("");
	const [resent, setResent] = useState(false);
	const [busy, setBusy] = useState(false);
	// The token is single-use, and StrictMode runs effects twice on mount, so
	// the ref guarantees exactly one request per page load.
	const attempted = useRef(false);

	useEffect(() => {
		if (!token || attempted.current) return;
		attempted.current = true;
		verifyEmail(token)
			.then((res) => {
				if (res.ok && res.user) {
					navigate("/world");
					return;
				}
				setStatus("error");
				setError(res.error ?? "verification failed");
			})
			.catch(() => {
				setStatus("error");
				setError("Could not reach the server");
			});
	}, [token, navigate]);

	async function resend(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		setBusy(true);
		setResent(false);
		try {
			await resendVerification(email.trim());
			setResent(true);
		} finally {
			setBusy(false);
		}
	}

	return (
		<AuthCard subtitle="EMAIL VERIFICATION">
			{status === "working" && (
				<p data-testid="verify-status" className="text-center text-sm text-leaf">
					Verifying your email…
				</p>
			)}

			{status === "error" && (
				<p data-testid="verify-status" className="mb-4 text-center text-sm text-pumpkin">
					{error}
				</p>
			)}

			{status !== "working" && (
				<form onSubmit={resend} className="flex flex-col gap-4">
					<p className="text-center text-sm text-cream">
						Enter your email and we'll send a fresh verification link.
					</p>
					<label className={labelClass}>
						Email
						<input
							data-testid="resend-email"
							type="email"
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className={inputClass}
						/>
					</label>
					<button type="submit" disabled={busy} className={buttonClass}>
						Resend Verification
					</button>
					{resent && (
						<p data-testid="resend-status" className="text-center text-sm text-leaf">
							If that account exists and is unverified, a new link is on its way.
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
