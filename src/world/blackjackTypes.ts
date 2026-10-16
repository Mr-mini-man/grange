import type { Card } from "./blackjack";

export type Phase = "betting" | "playerTurn" | "dealerTurn" | "settled";

export type HandResult =
	| "blackjack"
	| "win"
	| "push"
	| "lose"
	| "bust"
	| "surrender";

/** The slice of the economy the table needs. Injected so tests avoid it. */
export interface Bank {
	getBalance(): number;
	/** Attempts to move `amount` from the player to the table. */
	withdraw(amount: number): boolean;
	/** Moves `amount` from the table back to the player. */
	deposit(amount: number): void;
}

export interface VisibleHand {
	id: number;
	cards: Card[];
	total: number;
	soft: boolean;
	wager: number;
	result: HandResult | null;
}

export interface BlackjackSnapshot {
	phase: Phase;
	bet: number;
	balance: number;
	dealer: Card[];
	/** True while the dealer's hole card is face-down. */
	dealerHidden: boolean;
	dealerTotal: number;
	dealerSoft: boolean;
	hands: VisibleHand[];
	activeHand: number;
	message: string;
	net: number;
	betError: string | null;
	canHit: boolean;
	canStand: boolean;
	canDouble: boolean;
	canSplit: boolean;
	canSurrender: boolean;
}

export interface BlackjackOptions {
	rng?: () => number;
	bet?: number;
	/** Fixed draw order, used by tests to script exact hands. */
	deck?: readonly Card[];
}
