import { useEffect, useState } from "react";
import { CROPS } from "../../shared/farm";
import { useGameStore } from "../store";
import BarPanel from "./BarPanel";
import BreweryPanel from "./BreweryPanel";
import MarketPanel from "./MarketPanel";
import { CROP_COLORS, CROP_ORDER, EFFECT_LABEL, cropName } from "./farmUi";

type Tab = "market" | "brewery" | "bar";

/** Re-renders once a second so effect countdowns tick down. */
function useNow(): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);
	return now;
}

/**
 * The market / brewery / bar overlay for the owner's farm, plus the button
 * that opens it. Buying seeds and materials, brewing, and selling all go
 * through the server-authoritative farm channel; this only renders the state
 * broadcast back.
 */
export default function FarmShop() {
	const farm = useGameStore((s) => s.activeFarm);
	const username = useGameStore((s) => s.username);
	const crop = useGameStore((s) => s.crop);
	const setCrop = useGameStore((s) => s.setCrop);
	const [tab, setTab] = useState<Tab>("market");
	const [open, setOpen] = useState(false);
	const now = useNow();

	if (!farm || farm.owner !== username) return null;

	if (!open) {
		return (
			<button
				type="button"
				data-testid="open-shop"
				className="farm-shop-toggle"
				onClick={() => setOpen(true)}
			>
				Shop
			</button>
		);
	}

	const inv = farm.inventory;
	const effects = farm.brewery.effects.filter((e) => e.expiresAt > now);

	return (
		<div className="farm-shop" data-testid="farm-shop">
			<header className="farm-shop-head">
				<h2 className="farm-shop-title">Farm Shop</h2>
				<button
					type="button"
					data-testid="farm-shop-close"
					className="farm-secondary"
					onClick={() => setOpen(false)}
				>
					Close
				</button>
			</header>

			<div className="farm-status">
				<span className="farm-coin">Coins {inv.coins}</span>
				<span>Wood {inv.wood}</span>
				<span>Stone {inv.stone}</span>
			</div>

			{effects.length > 0 && (
				<div className="farm-effects" data-testid="farm-effects">
					{effects.map((e) => (
						<span key={e.kind} className="farm-effect">
							{EFFECT_LABEL[e.kind]} · {Math.ceil((e.expiresAt - now) / 1000)}s
						</span>
					))}
				</div>
			)}

			<h4 className="farm-subtitle">Planting crop</h4>
			<div className="farm-seeds">
				{CROP_ORDER.map((c) => (
					<button
						key={c}
						type="button"
						className={`farm-seed ${crop === c ? "farm-seed--active" : ""}`}
						style={{ borderColor: CROP_COLORS[c] }}
						onClick={() => setCrop(c)}
					>
						{cropName(c)} ({inv[CROPS[c].seedKey]})
					</button>
				))}
			</div>

			<nav className="farm-tabs">
				{(["market", "brewery", "bar"] as Tab[]).map((t) => (
					<button
						key={t}
						type="button"
						className={`farm-tab ${tab === t ? "farm-tab--active" : ""}`}
						onClick={() => setTab(t)}
					>
						{t}
					</button>
				))}
			</nav>

			{tab === "market" && <MarketPanel />}
			{tab === "brewery" && <BreweryPanel />}
			{tab === "bar" && <BarPanel />}
		</div>
	);
}
