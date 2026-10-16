import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { economy } from "./EconomyManager";
import { MIN_BET, pocketColor } from "./roulette";
import { RouletteBetGrid } from "./RouletteBetGrid";
import { RouletteChip } from "./RouletteChip";
import { RouletteTable } from "./rouletteGame";
import { BET_SPOT_BY_ID } from "./rouletteLayout";
import type { Bank, BetSpot, RouletteSnapshot } from "./rouletteTypes";
import { RouletteWheel } from "./RouletteWheel";
import "./roulette.css";

const CHIPS = [5, 25, 100];

const LEGEND: Array<[string, string]> = [
	["Straight", "35:1"],
	["Split", "17:1"],
	["Street", "11:1"],
	["Corner", "8:1"],
	["Five number (0-00-1-2-3)", "6:1"],
	["Line", "5:1"],
	["Column / Dozen", "2:1"],
	["Red / Black / Odd / Even / 1-18 / 19-36", "1:1"],
];

interface RouletteOverlayProps {
	onClose: () => void;
}

export function RouletteOverlay({ onClose }: RouletteOverlayProps) {
	const bank = useMemo<Bank>(
		() => ({
			getBalance: () => economy.getBalance(),
			withdraw: (amount) => economy.buy(amount).success,
			deposit: (amount) => {
				economy.sell(amount);
			},
		}),
		[],
	);
	const [table] = useState(() => new RouletteTable(bank));
	const [snapshot, setSnapshot] = useState<RouletteSnapshot>(() =>
		table.snapshot(),
	);
	const [dialogSpot, setDialogSpot] = useState<BetSpot | null>(null);
	const [amountInput, setAmountInput] = useState(String(MIN_BET));
	const trayRef = useRef<HTMLDivElement>(null);

	const refresh = useCallback(() => setSnapshot(table.snapshot()), [table]);

	const betting = snapshot.phase === "betting";
	const spinning = snapshot.phase === "spinning";
	const settled = snapshot.phase === "settled";

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !spinning) onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose, spinning]);

	const amountError = (): string | null => {
		const amount = Number(amountInput);
		if (amountInput.trim() === "" || !Number.isFinite(amount)) {
			return "Enter a bet.";
		}
		if (amount < MIN_BET) return `Minimum bet is ${MIN_BET}.`;
		if (amount > snapshot.available) return "Not enough Grangecoin.";
		return null;
	};

	const onSpotClick = (spot: BetSpot) => {
		if (!betting) return;
		if (snapshot.bets.some((bet) => bet.spotId === spot.id)) {
			table.removeBet(spot.id);
			refresh();
			return;
		}
		setAmountInput(String(MIN_BET));
		setDialogSpot(spot);
	};

	const confirmBet = () => {
		if (!dialogSpot || amountError() !== null) return;
		const ok = table.placeBet(dialogSpot, Number(amountInput));
		refresh();
		if (ok) setDialogSpot(null);
	};

	const spin = () => {
		table.spin();
		refresh();
	};

	const onLanded = useCallback(() => setSnapshot(table.settle()), [table]);

	const playAgain = () => {
		table.newRound();
		refresh();
	};

	const resultLabel =
		settled && snapshot.result
			? `${snapshot.result} ${pocketColor(snapshot.result)}`
			: "—";

	return (
		<div className="rl-overlay" data-testid="roulette-overlay">
			<div className="rl-panel" role="dialog" aria-label="Roulette table">
				<header className="rl-header">
					<h2 className="rl-title">Roulette</h2>
					<span className="rl-balance" data-testid="roulette-balance">
						${snapshot.balance.toLocaleString()}
					</span>
					<span className="rl-staked" data-testid="roulette-staked">
						On table: ${snapshot.totalStaked}
					</span>
					{betting && (
						<span className="rl-available" data-testid="roulette-available">
							Available: ${snapshot.available}
						</span>
					)}
					<div className="rl-tray" ref={trayRef} aria-hidden="true">
						<span className="rl-tray-chip">$</span>
					</div>
					<button
						type="button"
						className="rl-close"
						data-testid="roulette-close"
						disabled={spinning}
						onClick={onClose}
					>
						Leave
					</button>
				</header>

				<div className="rl-body">
					<div className="rl-wheel-col">
						<RouletteWheel
							phase={snapshot.phase}
							result={snapshot.result}
							onLanded={onLanded}
						/>
						<div className="rl-result" data-testid="roulette-result">
							{resultLabel}
						</div>
						<button
							type="button"
							className="rl-spin"
							data-testid="roulette-spin"
							disabled={!betting || snapshot.bets.length === 0}
							onClick={spin}
						>
							Spin
						</button>
					</div>

					<div className="rl-felt-col">
						<div className="rl-felt">
							<RouletteBetGrid
								bets={snapshot.bets}
								disabled={!betting}
								result={settled ? snapshot.result : null}
								onSpotClick={onSpotClick}
							/>
							<div className="rl-chip-layer">
								{snapshot.bets.map((bet) => {
									const spot = BET_SPOT_BY_ID.get(bet.spotId);
									if (!spot) return null;
									return (
										<RouletteChip
											key={bet.spotId}
											bet={bet}
											spot={spot}
											trayRef={trayRef}
											settled={settled}
										/>
									);
								})}
							</div>
						</div>
						<p className="rl-message" data-testid="roulette-message">
							{snapshot.message}
						</p>
						{settled && (
							<div className="rl-actions">
								<button
									type="button"
									className="rl-action rl-primary"
									data-testid="roulette-play-again"
									onClick={playAgain}
								>
									Play again
								</button>
								<button
									type="button"
									className="rl-action"
									data-testid="roulette-leave"
									onClick={onClose}
								>
									Leave table
								</button>
							</div>
						)}
					</div>
				</div>

				<details className="rl-legend" data-testid="roulette-legend">
					<summary>Payouts</summary>
					<ul>
						{LEGEND.map(([label, odds]) => (
							<li key={label}>
								<span>{label}</span>
								<span>{odds}</span>
							</li>
						))}
					</ul>
				</details>

				{dialogSpot && (
					<div className="rl-dialog-backdrop">
						<div
							className="rl-dialog"
							role="dialog"
							data-testid="roulette-bet-dialog"
						>
							<h3>Bet on {dialogSpot.label}</h3>
							<p className="rl-dialog-hint">
								Pays {dialogSpot.payout}:1 — win ${dialogSpot.payout + 1} per
								$1.
							</p>
							<div className="rl-dialog-chips">
								{CHIPS.map((chip) => (
									<button
										key={chip}
										type="button"
										className="rl-chip-button"
										data-testid={`roulette-dialog-chip-${chip}`}
										disabled={chip > snapshot.available}
										onClick={() => setAmountInput(String(chip))}
									>
										${chip}
									</button>
								))}
								<button
									type="button"
									className="rl-chip-button"
									data-testid="roulette-dialog-chip-all"
									disabled={snapshot.available < MIN_BET}
									onClick={() => setAmountInput(String(snapshot.available))}
								>
									All-in
								</button>
							</div>
							<label className="rl-amount-field">
								Amount
								<input
									type="number"
									min={MIN_BET}
									value={amountInput}
									data-testid="roulette-amount"
									onChange={(event) => setAmountInput(event.target.value)}
								/>
							</label>
							{amountError() !== null && (
								<span className="rl-error" data-testid="roulette-amount-error">
									{amountError()}
								</span>
							)}
							<div className="rl-dialog-actions">
								<button
									type="button"
									className="rl-action rl-primary"
									data-testid="roulette-confirm"
									disabled={amountError() !== null}
									onClick={confirmBet}
								>
									Place bet
								</button>
								<button
									type="button"
									className="rl-action"
									data-testid="roulette-cancel"
									onClick={() => setDialogSpot(null)}
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
