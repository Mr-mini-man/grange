import type { Card } from "./blackjack";
import type { HandCategory } from "./pokerHand";
import type { DealerStrategy } from "./pokerStrategy";

export type PokerPhase = "idle" | "playerTurn" | "dealerTurn" | "settled";

export type Street = "preflop" | "flop" | "turn" | "river";

export type PokerActor = "player" | "dealer";

export type HandWinner = "player" | "dealer" | "split";

export interface PokerSnapshot {
	phase: PokerPhase;
	street: Street;
	balance: number;
	dealerStack: number;
	pot: number;
	playerHole: Card[];
	dealerHole: Card[];
	/** True while the dealer's hole cards are face-down. */
	dealerHidden: boolean;
	community: Card[];
	/** Chips this street, per seat. */
	playerCommitted: number;
	dealerCommitted: number;
	/** Chips this whole hand, per seat. */
	playerTotal: number;
	dealerTotal: number;
	currentBet: number;
	callAmount: number;
	minRaiseTo: number;
	maxRaiseTo: number;
	playerBest: HandCategory | null;
	dealerBest: HandCategory | null;
	message: string;
	net: number;
	winner: HandWinner | null;
	canCheck: boolean;
	canCall: boolean;
	canRaise: boolean;
	canFold: boolean;
}

export interface PokerOptions {
	rng?: () => number;
	/** Fixed draw order, used by tests to script exact deals. */
	deck?: readonly Card[];
	smallBlind?: number;
	bigBlind?: number;
	dealerStack?: number;
	strategy?: DealerStrategy;
}
