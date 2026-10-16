import type { Bank } from "./blackjackTypes";
import type { BetKind, PocketId } from "./roulette";

export type { Bank };

export type RoulettePhase = "betting" | "spinning" | "settled";

/** One clickable region on the felt, with the numbers it covers. */
export interface BetSpot {
	id: string;
	label: string;
	kind: BetKind;
	numbers: PocketId[];
	/** Winnings-to-stake multiplier, copied from `PAYOUTS`. */
	payout: number;
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface PlacedBet {
	spotId: string;
	label: string;
	kind: BetKind;
	numbers: PocketId[];
	amount: number;
	payout: number;
	/** Null until the round settles. */
	won: boolean | null;
	/** Total returned to the player on a win, 0 otherwise. */
	returned: number;
}

export interface RouletteSnapshot {
	phase: RoulettePhase;
	balance: number;
	/** Balance not yet committed to a bet (betting phase only). */
	available: number;
	bets: PlacedBet[];
	totalStaked: number;
	result: PocketId | null;
	net: number;
	message: string;
}

export interface RouletteOptions {
	rng?: () => number;
}
