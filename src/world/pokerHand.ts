import type { Card, Rank } from "./blackjack";

export type HandCategory =
	| "highCard"
	| "pair"
	| "twoPair"
	| "trips"
	| "straight"
	| "flush"
	| "fullHouse"
	| "quads"
	| "straightFlush";

const CATEGORY_RANK: Record<HandCategory, number> = {
	highCard: 0,
	pair: 1,
	twoPair: 2,
	trips: 3,
	straight: 4,
	flush: 5,
	fullHouse: 6,
	quads: 7,
	straightFlush: 8,
};

const RANK_VALUE: Record<Rank, number> = {
	A: 14,
	K: 13,
	Q: 12,
	J: 11,
	"10": 10,
	"9": 9,
	"8": 8,
	"7": 7,
	"6": 6,
	"5": 5,
	"4": 4,
	"3": 3,
	"2": 2,
};

const RANK_NAME: Record<number, string> = {
	14: "A",
	13: "K",
	12: "Q",
	11: "J",
	10: "10",
	9: "9",
	8: "8",
	7: "7",
	6: "6",
	5: "5",
	4: "4",
	3: "3",
	2: "2",
};

export const CATEGORY_LABEL: Record<HandCategory, string> = {
	highCard: "High card",
	pair: "Pair",
	twoPair: "Two pair",
	trips: "Three of a kind",
	straight: "Straight",
	flush: "Flush",
	fullHouse: "Full house",
	quads: "Four of a kind",
	straightFlush: "Straight flush",
};

/** Numeric strength of a rank, aces high (2-14). */
export function rankValue(rank: Rank): number {
	return RANK_VALUE[rank];
}

/** Human label for a numeric rank value, e.g. 14 -> "A". */
export function rankLabel(value: number): string {
	return RANK_NAME[value] ?? String(value);
}

export interface HandScore {
	category: HandCategory;
	/** Ordered tiebreakers, compared high to low. */
	tiebreak: number[];
}

/** Compares two scores: >0 when `a` is stronger, <0 when `b` is, 0 on a tie. */
export function compareScores(a: HandScore, b: HandScore): number {
	const byCategory = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
	if (byCategory !== 0) return byCategory;
	const length = Math.max(a.tiebreak.length, b.tiebreak.length);
	for (let i = 0; i < length; i += 1) {
		const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

/** High card of a five-card straight, or 0 when the ranks are not consecutive. */
function straightHigh(values: readonly number[]): number {
	if (values.length !== 5) return 0;
	if (values[0] - values[4] === 4) return values[0];
	// The wheel: A-2-3-4-5 plays as a five-high straight.
	if (values[0] === 14 && values[1] === 5) return 5;
	return 0;
}

function kickers(groups: Array<[number, number]>, from: number): number[] {
	return groups.slice(from).map((group) => group[0]);
}

/** Scores exactly five cards. */
export function evaluate5(cards: readonly Card[]): HandScore {
	if (cards.length !== 5) {
		throw new Error(`evaluate5 expects 5 cards, got ${cards.length}`);
	}
	const values = cards
		.map((card) => rankValue(card.rank))
		.sort((a, b) => b - a);
	const isFlush = cards.every((card) => card.suit === cards[0].suit);
	const counts = new Map<number, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	const groups = [...counts.entries()].sort(
		(a, b) => b[1] - a[1] || b[0] - a[0],
	);
	const high = straightHigh(
		[...counts.keys()].sort((a, b) => b - a),
	);

	if (isFlush && high) return { category: "straightFlush", tiebreak: [high] };
	if (groups[0][1] === 4) {
		return { category: "quads", tiebreak: [groups[0][0], groups[1][0]] };
	}
	if (groups[0][1] === 3 && groups[1]?.[1] === 2) {
		return { category: "fullHouse", tiebreak: [groups[0][0], groups[1][0]] };
	}
	if (isFlush) return { category: "flush", tiebreak: values };
	if (high) return { category: "straight", tiebreak: [high] };
	if (groups[0][1] === 3) {
		return {
			category: "trips",
			tiebreak: [groups[0][0], ...kickers(groups, 1)],
		};
	}
	if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
		return {
			category: "twoPair",
			tiebreak: [groups[0][0], groups[1][0], groups[2][0]],
		};
	}
	if (groups[0][1] === 2) {
		return {
			category: "pair",
			tiebreak: [groups[0][0], ...kickers(groups, 1)],
		};
	}
	return { category: "highCard", tiebreak: values };
}

/** Every size-`k` combination of indices in `[0, n)`. */
function combinations(n: number, k: number): number[][] {
	const result: number[][] = [];
	const pick: number[] = [];
	const walk = (start: number) => {
		if (pick.length === k) {
			result.push([...pick]);
			return;
		}
		for (let i = start; i <= n - (k - pick.length); i += 1) {
			pick.push(i);
			walk(i + 1);
			pick.pop();
		}
	};
	walk(0);
	return result;
}

/** Best five-card score drawn from five to seven cards. */
export function bestHand(cards: readonly Card[]): HandScore {
	if (cards.length < 5) {
		throw new Error(`bestHand needs at least 5 cards, got ${cards.length}`);
	}
	let best: HandScore | null = null;
	for (const combo of combinations(cards.length, 5)) {
		const score = evaluate5(combo.map((index) => cards[index]));
		if (!best || compareScores(score, best) > 0) best = score;
	}
	return best as HandScore;
}
