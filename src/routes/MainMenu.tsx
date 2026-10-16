import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logout } from "../auth";
import { GAME_VERSION, TEAM_WATERMARK } from "../config";
import { useGameStore } from "../store";
import { useSession } from "../useSession";
import "./mainMenu.css";

interface MenuButton {
	label: string;
	onClick: () => void;
}

export default function MainMenu() {
	const { ready } = useSession();
	const user = useGameStore((s) => s.user);
	const signedIn = Boolean(user);
	const username = useGameStore((s) => s.username);
	const navigate = useNavigate();
	const location = useLocation();
	const arrivingNotice =
		(location.state as { notice?: string } | null)?.notice ?? null;
	const [note, setNote] = useState<string | null>(arrivingNotice);

	function enterFarm() {
		navigate(signedIn ? "/world" : "/login");
	}

	function joinFarm() {
		navigate(signedIn ? "/dashboard" : "/login");
	}

	async function quitToDesktop() {
		await logout();
		setNote("Signed out. You may now close this tab.");
	}

	const buttons: MenuButton[] = [
		{ label: "Continue / Load Farm", onClick: enterFarm },
		{ label: "New Farm", onClick: enterFarm },
		{ label: "Join Farm", onClick: joinFarm },
		{
			label: "Settings",
			onClick: () => setNote("Settings are coming soon."),
		},
		{ label: "Quit to Desktop", onClick: quitToDesktop },
	];

	return (
		<main className="menu-root">
			<div className="menu-art" aria-hidden="true" />

			<header className="menu-topbar">
				<h1 className="menu-logo" data-testid="menu-logo">
					GRANGE
				</h1>
				<div className="menu-account">
					{ready && signedIn ? (
						<>
							<span className="menu-username" data-testid="menu-user">
								{username}
							</span>
							<button
								type="button"
								data-testid="menu-logout"
								className="menu-account-button"
								onClick={quitToDesktop}
							>
								Log out
							</button>
						</>
					) : (
						<button
							type="button"
							data-testid="menu-login"
							className="menu-account-button"
							onClick={() => navigate("/login")}
						>
							Login
						</button>
					)}
				</div>
			</header>

			<nav className="menu-nav" aria-label="Main menu">
				{buttons.map((button) => (
					<button
						key={button.label}
						type="button"
						className="menu-button"
						onClick={button.onClick}
					>
						{button.label}
					</button>
				))}
			</nav>

			{note && (
				<p className="menu-note" data-testid="menu-note">
					{note}
				</p>
			)}

			<footer className="menu-footer">
				<span>v{GAME_VERSION}</span>
				<span className="menu-watermark">{TEAM_WATERMARK}</span>
			</footer>
		</main>
	);
}
