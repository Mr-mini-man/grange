import type { Bank } from "./blackjackTypes";
import type { SlotSymbol } from "./slots";

export type { Bank };

export type SlotsPhase = "betting" | "spinning" | "settled";

export interface SlotsSnapshot {
	phase: SlotsPhase;
	bet: number;
	balance: number;
	/** Faces currently showing on the reels; empty before the first spin. */
	reels: SlotSymbol[];
	/** The three-in-a-row symbol once the round settles, else null. */
	winningSymbol: SlotSymbol | null;
	/** Money returned to the player when the round settles. */
	payout: number;
	net: number;
	message: string;
	betError: string | null;
}

export interface SlotsOptions {
	rng?: () => number;
	bet?: number;
}
