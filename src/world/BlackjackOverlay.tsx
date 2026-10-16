import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MIN_BET } from "./blackjack";
import { BlackjackTable } from "./blackjackGame";
import type {
	Bank,
	BlackjackSnapshot,
	HandResult,
} from "./blackjackTypes";
import { buildDealerSlots, cardCode } from "./cardSlots";
import { Deck } from "./Deck";
import { economy } from "./EconomyManager";
import { PlayingCard } from "./PlayingCard";
import "./blackjack.css";

const RESULT_LABEL: Record<HandResult, string> = {
	blackjack: "Blackjack",
	win: "Win",
	push: "Push",
	lose: "Lose",
	bust: "Bust",
	surrender: "Surrender",
};

const CHIPS = [5, 25, 100];

function totalLabel(total: number, soft: boolean): string {
	if (total > 21) return `${total} (bust)`;
	if (soft && total !== 21) return `${total} (soft)`;
	return String(total);
}

interface BlackjackOverlayProps {
	onClose: () => void;
}

export function BlackjackOverlay({ onClose }: BlackjackOverlayProps) {
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
	const [table] = useState(() => new BlackjackTable(bank));
	const [snapshot, setSnapshot] = useState<BlackjackSnapshot>(() =>
		table.snapshot(),
	);
	const [betInput, setBetInput] = useState(() => String(table.snapshot().bet));

	const deckRef = useRef<HTMLDivElement>(null);
	const seen = useRef<Set<string>>(new Set());

	const slots = buildDealerSlots(snapshot.dealer, snapshot.dealerHidden);
	const codes = [
		...slots.map((slot) => slot.code),
		...snapshot.hands.flatMap((hand) => hand.cards.map(cardCode)),
	];
	const isNew = (code: string) => !seen.current.has(code);

	// Remember what has already been shown so only fresh draws animate in.
	useEffect(() => {
		seen.current = new Set(codes);
	});

	const refresh = useCallback(() => setSnapshot(table.snapshot()), [table]);

	const run = useCallback(
		(action: () => void) => {
			action();
			setSnapshot(table.snapshot());
		},
		[table],
	);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const chooseBet = (amount: number) => {
		setBetInput(String(amount));
		run(() => table.setBet(amount));
	};

	const onBetChange = (value: string) => {
		setBetInput(value);
		run(() => table.setBet(value === "" ? Number.NaN : Number(value)));
	};

	const playAgain = () => {
		table.newRound();
		setBetInput(String(table.snapshot().bet));
		refresh();
	};

	const active = snapshot.phase === "playerTurn";
	const betting = snapshot.phase === "betting";

	return (
		<div className="bj-overlay" data-testid="blackjack-overlay">
			<div className="bj-panel" role="dialog" aria-label="Blackjack table">
				<header className="bj-header">
					<h2 className="bj-title">Blackjack</h2>
					<span className="bj-balance" data-testid="blackjack-balance">
						${snapshot.balance.toLocaleString()}
					</span>
					<button
						type="button"
						className="bj-close"
						data-testid="blackjack-close"
						onClick={onClose}
					>
						Leave
					</button>
				</header>

				<div className="bj-deck-row">
					<span className="bj-deck-label">Deck</span>
					<Deck deckRef={deckRef} />
				</div>

				<section className="bj-seat bj-dealer" data-testid="blackjack-dealer">
					<span className="bj-seat-name">Dealer</span>
					<div className="bj-hand">
						{slots.map((slot, i) => (
							<PlayingCard
								key={slot.key}
								card={slot.card}
								faceDown={slot.faceDown}
								deal={isNew(slot.code)}
								dealDelay={i * 90}
								deckRef={deckRef}
							/>
						))}
					</div>
					<span className="bj-total">
						{snapshot.dealerHidden
							? `${snapshot.dealerTotal} + ?`
							: totalLabel(snapshot.dealerTotal, snapshot.dealerSoft)}
					</span>
				</section>

				<section className="bj-players">
					{snapshot.hands.map((hand, index) => (
						<div
							key={hand.id}
							className={
								active && index === snapshot.activeHand
									? "bj-seat bj-player bj-player-active"
									: "bj-seat bj-player"
							}
							data-testid="blackjack-player-hand"
						>
							<span className="bj-seat-name">
								{snapshot.hands.length > 1 ? `Hand ${index + 1}` : "You"}
							</span>
							<div className="bj-hand">
								{hand.cards.map((card, i) => (
									<PlayingCard
										key={cardCode(card)}
										card={card}
										deal={isNew(cardCode(card))}
										dealDelay={i * 90}
										deckRef={deckRef}
									/>
								))}
							</div>
							<span className="bj-total">
								{totalLabel(hand.total, hand.soft)}
							</span>
							<span className="bj-wager">${hand.wager}</span>
							{hand.result && (
								<span className="bj-result">{RESULT_LABEL[hand.result]}</span>
							)}
						</div>
					))}
					{snapshot.hands.length === 0 && (
						<p className="bj-empty">No cards dealt yet.</p>
					)}
				</section>

				<p className="bj-message" data-testid="blackjack-message">
					{snapshot.message}
				</p>

				{betting && (
					<div className="bj-betting">
						<div className="bj-chips">
							{CHIPS.map((chip) => (
								<button
									key={chip}
									type="button"
									className="bj-chip"
									data-testid={`blackjack-chip-${chip}`}
									disabled={chip > snapshot.balance}
									onClick={() => chooseBet(chip)}
								>
									${chip}
								</button>
							))}
							<button
								type="button"
								className="bj-chip"
								data-testid="blackjack-chip-all"
								disabled={snapshot.balance < MIN_BET}
								onClick={() => chooseBet(snapshot.balance)}
							>
								All-in
							</button>
						</div>
						<label className="bj-bet-field">
							Bet
							<input
								type="number"
								min={MIN_BET}
								value={betInput}
								data-testid="blackjack-bet-input"
								onChange={(event) => onBetChange(event.target.value)}
							/>
						</label>
						{snapshot.betError && (
							<span className="bj-error" data-testid="blackjack-bet-error">
								{snapshot.betError}
							</span>
						)}
						<button
							type="button"
							className="bj-action bj-primary"
							data-testid="blackjack-deal"
							disabled={snapshot.betError !== null}
							onClick={() => run(() => table.deal())}
						>
							Deal
						</button>
					</div>
				)}

				{active && (
					<div className="bj-actions">
						<button
							type="button"
							className="bj-action"
							data-testid="blackjack-hit"
							disabled={!snapshot.canHit}
							onClick={() => run(() => table.hit())}
						>
							Hit
						</button>
						<button
							type="button"
							className="bj-action"
							data-testid="blackjack-stand"
							disabled={!snapshot.canStand}
							onClick={() => run(() => table.stand())}
						>
							Stand
						</button>
						<button
							type="button"
							className="bj-action"
							data-testid="blackjack-double"
							disabled={!snapshot.canDouble}
							onClick={() => run(() => table.double())}
						>
							Double
						</button>
						<button
							type="button"
							className="bj-action"
							data-testid="blackjack-split"
							disabled={!snapshot.canSplit}
							onClick={() => run(() => table.split())}
						>
							Split
						</button>
						<button
							type="button"
							className="bj-action"
							data-testid="blackjack-forfeit"
							disabled={!snapshot.canSurrender}
							onClick={() => run(() => table.surrender())}
						>
							Forfeit
						</button>
					</div>
				)}

				{snapshot.phase === "settled" && (
					<div className="bj-actions">
						<button
							type="button"
							className="bj-action bj-primary"
							data-testid="blackjack-play-again"
							onClick={playAgain}
						>
							Play again
						</button>
						<button
							type="button"
							className="bj-action"
							data-testid="blackjack-leave"
							onClick={onClose}
						>
							Leave table
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
