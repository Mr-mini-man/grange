import { describe, expect, it } from "vitest";
import {
	type Card,
	type Rank,
	cardValue,
	createDeck,
	dealerShouldHit,
	handValue,
	isBlackjack,
	isBust,
	isSoft17,
	isSplittable,
	shuffle,
} from "./blackjack";

function card(rank: Rank): Card {
	return { rank, suit: "spades" };
}

/** Deterministic LCG so shuffle tests are reproducible. */
function seededRng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0;
		return state / 4294967296;
	};
}

const code = (c: Card) => `${c.rank}-${c.suit}`;
const byCode = (a: Card, b: Card) => code(a).localeCompare(code(b));

describe("createDeck", () => {
	it("produces the 52 unique standard cards", () => {
		const deck = createDeck();
		expect(deck).toHaveLength(52);
		expect(new Set(deck.map(code)).size).toBe(52);
	});
});

describe("shuffle", () => {
	it("preserves the cards without mutating the input", () => {
		const deck = createDeck();
		const shuffled = shuffle(deck, seededRng(12345));
		expect(shuffled).toHaveLength(52);
		expect([...shuffled].sort(byCode).map(code)).toEqual(
			[...deck].sort(byCode).map(code),
		);
		expect(deck.map(code)).toEqual(createDeck().map(code));
	});

	it("is deterministic for a given rng", () => {
		const a = shuffle(createDeck(), seededRng(7));
		const b = shuffle(createDeck(), seededRng(7));
		expect(a.map(code)).toEqual(b.map(code));
	});
});

describe("cardValue", () => {
	it("scores aces, faces, and pips", () => {
		expect(cardValue("A")).toBe(11);
		expect(cardValue("K")).toBe(10);
		expect(cardValue("Q")).toBe(10);
		expect(cardValue("J")).toBe(10);
		expect(cardValue("10")).toBe(10);
		expect(cardValue("7")).toBe(7);
	});
});

describe("handValue", () => {
	it("totals a hard hand", () => {
		expect(handValue([card("10"), card("7")])).toEqual({
			total: 17,
			soft: false,
		});
	});

	it("keeps an ace as soft 11 when it fits", () => {
		expect(handValue([card("A"), card("6")])).toEqual({
			total: 17,
			soft: true,
		});
	});

	it("downgrades aces to avoid busting", () => {
		expect(handValue([card("A"), card("6"), card("10")])).toEqual({
			total: 17,
			soft: false,
		});
		expect(handValue([card("A"), card("A"), card("9")])).toEqual({
			total: 21,
			soft: true,
		});
	});
});

describe("hand classification", () => {
	it("only calls a two-card 21 a blackjack", () => {
		expect(isBlackjack([card("A"), card("K")])).toBe(true);
		expect(isBlackjack([card("7"), card("7"), card("7")])).toBe(false);
	});

	it("detects busts", () => {
		expect(isBust([card("K"), card("Q"), card("5")])).toBe(true);
		expect(isBust([card("K"), card("Q")])).toBe(false);
	});

	it("detects soft 17", () => {
		expect(isSoft17([card("A"), card("6")])).toBe(true);
		expect(isSoft17([card("A"), card("A"), card("5")])).toBe(true);
		expect(isSoft17([card("10"), card("7")])).toBe(false);
	});

	it("splits equal-value pairs including ten-values", () => {
		expect(isSplittable([card("8"), card("8")])).toBe(true);
		expect(isSplittable([card("A"), card("A")])).toBe(true);
		expect(isSplittable([card("10"), card("K")])).toBe(true);
		expect(isSplittable([card("8"), card("9")])).toBe(false);
	});
});

describe("dealerShouldHit", () => {
	it("hits below 17 and stands on hard 17 or more", () => {
		expect(dealerShouldHit([card("10"), card("6")])).toBe(true);
		expect(dealerShouldHit([card("10"), card("7")])).toBe(false);
		expect(dealerShouldHit([card("10"), card("8")])).toBe(false);
	});

	it("hits on soft 17", () => {
		expect(dealerShouldHit([card("A"), card("6")])).toBe(true);
		expect(dealerShouldHit([card("A"), card("7")])).toBe(false);
	});
});
