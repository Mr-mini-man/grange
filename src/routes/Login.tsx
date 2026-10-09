import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, register } from "../auth";
import AuthCard, { buttonClass, inputClass, labelClass } from "../components/AuthCard";

type Mode = "signin" | "signup";

export default function Login() {
	const [mode, setMode] = useState<Mode>("signin");
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [unverified, setUnverified] = useState(false);
	const [busy, setBusy] = useState(false);
	const navigate = useNavigate();

	function switchMode(next: Mode) {
		setMode(next);
		setError("");
		setNotice("");
		setUnverified(false);
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (busy) return;
		setBusy(true);
		setError("");
		setNotice("");
		setUnverified(false);
		try {
			if (mode === "signup") {
				const res = await register({
					username: username.trim(),
					email: email.trim(),
					password,
				});
				if (res.ok) {
					// Account exists but is locked until the link is used.
					setMode("signin");
					setNotice(
						res.emailSent === false
							? "Account created, but we couldn't send the email. Use “Resend verification”."
							: "Check your email to verify your account, then sign in.",
					);
					return;
				}
				setError(res.error ?? "Something went wrong");
				return;
			}

			const res = await login({ username: username.trim(), password });
			if (res.ok && res.user) {
				// login() already stored the user and rebound the socket.
				navigate("/world");
				return;
			}
			setUnverified(res.code === "unverified");
			setError(res.error ?? "Something went wrong");
		} catch {
			setError("Could not reach the server");
		} finally {
			setBusy(false);
		}
	}

	return (
		<AuthCard>
			<form onSubmit={submit} className="flex flex-col gap-4">
				<label className={labelClass}>
					Username
					<input
						data-testid="username"
						autoComplete="username"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						className={inputClass}
					/>
				</label>

				{mode === "signup" && (
					<label className={labelClass}>
						Email
						<input
							data-testid="email"
							type="email"
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className={inputClass}
						/>
					</label>
				)}

				<label className={labelClass}>
					Password
					<input
						data-testid="password"
						type="password"
						autoComplete={
							mode === "signin" ? "current-password" : "new-password"
						}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className={inputClass}
					/>
				</label>

				<button type="submit" disabled={busy} className={buttonClass}>
					{mode === "signin" ? "Sign In" : "Create Account"}
				</button>

				{notice && (
					<p data-testid="auth-notice" className="text-center text-sm text-leaf">
						{notice}
					</p>
				)}

				{error && (
					<p data-testid="auth-error" className="text-center text-sm text-pumpkin">
						{error}
					</p>
				)}

				{unverified && (
					<Link
						to="/verify"
						data-testid="resend-link"
						className="text-center text-xs tracking-wider text-husk underline-offset-2 hover:text-leaf hover:underline"
					>
						Resend verification email
					</Link>
				)}

				{mode === "signin" && (
					<Link
						to="/forgot"
						data-testid="forgot-link"
						className="text-center text-xs tracking-wider text-husk underline-offset-2 hover:text-leaf hover:underline"
					>
						Forgot password?
					</Link>
				)}
			</form>

			<button
				type="button"
				data-testid="toggle-mode"
				onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
				className="mt-4 w-full text-center text-xs tracking-wider text-husk underline-offset-2 hover:text-leaf hover:underline"
			>
				{mode === "signin"
					? "No account yet? Create one"
					: "Already registered? Sign in"}
			</button>
		</AuthCard>
	);
}
