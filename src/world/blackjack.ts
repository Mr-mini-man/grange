export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank =
	| "A"
	| "2"
	| "3"
	| "4"
	| "5"
	| "6"
	| "7"
	| "8"
	| "9"
	| "10"
	| "J"
	| "Q"
	| "K";

export interface Card {
	rank: Rank;
	suit: Suit;
}

export const SUITS: readonly Suit[] = [
	"hearts",
	"diamonds",
	"clubs",
	"spades",
];

export const RANKS: readonly Rank[] = [
	"A",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K",
];

/** Smallest allowed wager. */
export const MIN_BET = 5;
/** A natural pays 3:2, i.e. the player gets 2.5x their wager back. */
export const NATURAL_MULTIPLIER = 2.5;
/** A normal win pays 1:1, i.e. the player gets 2x their wager back. */
export const WIN_MULTIPLIER = 2;
/** A push returns the wager untouched. */
export const PUSH_MULTIPLIER = 1;
/** Surrendering returns half the wager. */
export const SURRENDER_MULTIPLIER = 0.5;

/** Builds the standard 52-card deck, one entry per card. */
export function createDeck(): Card[] {
	const deck: Card[] = [];
	for (const suit of SUITS) {
		for (const rank of RANKS) deck.push({ rank, suit });
	}
	return deck;
}

/** Fisher-Yates shuffle. `rng` is injectable so tests stay deterministic. */
export function shuffle<T>(
	items: readonly T[],
	rng: () => number = Math.random,
): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

export function cardValue(rank: Rank): number {
	if (rank === "A") return 11;
	if (rank === "J" || rank === "Q" || rank === "K" || rank === "10") return 10;
	return Number(rank);
}

/**
 * Totals a hand, counting aces as 11 until that would bust, then as 1. `soft`
 * is true when at least one ace is still counted as 11, which is what the
 * dealer's "hits on soft 17" rule keys off of.
 */
export function handValue(hand: readonly Card[]): {
	total: number;
	soft: boolean;
} {
	let total = 0;
	let softAces = 0;
	for (const card of hand) {
		total += cardValue(card.rank);
		if (card.rank === "A") softAces += 1;
	}
	while (total > 21 && softAces > 0) {
		total -= 10;
		softAces -= 1;
	}
	return { total, soft: softAces > 0 };
}

export function isBlackjack(hand: readonly Card[]): boolean {
	return hand.length === 2 && handValue(hand).total === 21;
}

export function isBust(hand: readonly Card[]): boolean {
	return handValue(hand).total > 21;
}

export function isSoft17(hand: readonly Card[]): boolean {
	const value = handValue(hand);
	return value.soft && value.total === 17;
}

/** Any two cards of equal value (rank or ten-value) may be split. */
export function isSplittable(hand: readonly Card[]): boolean {
	return (
		hand.length === 2 &&
		cardValue(hand[0].rank) === cardValue(hand[1].rank)
	);
}

/** The dealer draws below 17 and on every soft 17. */
export function dealerShouldHit(hand: readonly Card[]): boolean {
	return handValue(hand).total < 17 || isSoft17(hand);
}
