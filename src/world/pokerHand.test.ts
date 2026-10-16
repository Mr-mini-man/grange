import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "./blackjack";
import { bestHand, compareScores, evaluate5, rankValue } from "./pokerHand";

const card = (rank: Rank, suit: Suit = "spades"): Card => ({ rank, suit });

describe("rankValue", () => {
	it("counts aces high and faces at ten", () => {
		expect(rankValue("A")).toBe(14);
		expect(rankValue("K")).toBe(13);
		expect(rankValue("Q")).toBe(12);
		expect(rankValue("J")).toBe(11);
		expect(rankValue("10")).toBe(10);
		expect(rankValue("2")).toBe(2);
	});
});

describe("evaluate5", () => {
	it("detects a high card hand", () => {
		const score = evaluate5([
			card("A"),
			card("K", "hearts"),
			card("9", "clubs"),
			card("5", "diamonds"),
			card("3"),
		]);
		expect(score.category).toBe("highCard");
		expect(score.tiebreak).toEqual([14, 13, 9, 5, 3]);
	});

	it("detects a pair and ranks the kickers", () => {
		const score = evaluate5([
			card("8"),
			card("8", "hearts"),
			card("A", "clubs"),
			card("5", "diamonds"),
			card("3"),
		]);
		expect(score.category).toBe("pair");
		expect(score.tiebreak).toEqual([8, 14, 5, 3]);
	});

	it("detects two pair with a kicker", () => {
		const score = evaluate5([
			card("K"),
			card("K", "hearts"),
			card("4", "clubs"),
			card("4", "diamonds"),
			card("Q"),
		]);
		expect(score.category).toBe("twoPair");
		expect(score.tiebreak).toEqual([13, 4, 12]);
	});

	it("detects trips", () => {
		const score = evaluate5([
			card("7"),
			card("7", "hearts"),
			card("7", "clubs"),
			card("K", "diamonds"),
			card("2"),
		]);
		expect(score.category).toBe("trips");
		expect(score.tiebreak).toEqual([7, 13, 2]);
	});

	it("detects straights including the wheel", () => {
		expect(
			evaluate5([
				card("9"),
				card("8", "hearts"),
				card("7", "clubs"),
				card("6", "diamonds"),
				card("5"),
			]).category,
		).toBe("straight");
		const wheel = evaluate5([
			card("A"),
			card("2", "hearts"),
			card("3", "clubs"),
			card("4", "diamonds"),
			card("5"),
		]);
		expect(wheel.category).toBe("straight");
		expect(wheel.tiebreak).toEqual([5]);
	});

	it("detects a flush", () => {
		const score = evaluate5([
			card("A", "hearts"),
			card("J", "hearts"),
			card("8", "hearts"),
			card("5", "hearts"),
			card("2", "hearts"),
		]);
		expect(score.category).toBe("flush");
	});

	it("detects a full house", () => {
		const score = evaluate5([
			card("Q"),
			card("Q", "hearts"),
			card("Q", "clubs"),
			card("9", "diamonds"),
			card("9", "spades"),
		]);
		expect(score.category).toBe("fullHouse");
		expect(score.tiebreak).toEqual([12, 9]);
	});

	it("detects quads", () => {
		const score = evaluate5([
			card("4"),
			card("4", "hearts"),
			card("4", "clubs"),
			card("4", "diamonds"),
			card("A"),
		]);
		expect(score.category).toBe("quads");
		expect(score.tiebreak).toEqual([4, 14]);
	});

	it("detects a straight flush", () => {
		const score = evaluate5([
			card("9", "hearts"),
			card("8", "hearts"),
			card("7", "hearts"),
			card("6", "hearts"),
			card("5", "hearts"),
		]);
		expect(score.category).toBe("straightFlush");
		expect(score.tiebreak).toEqual([9]);
	});
});

describe("compareScores", () => {
	it("orders categories from high card up to straight flush", () => {
		const hands = [
			evaluate5([card("A"), card("K", "hearts"), card("9", "clubs"), card("5", "diamonds"), card("3")]),
			evaluate5([card("8"), card("8", "hearts"), card("A", "clubs"), card("5", "diamonds"), card("3")]),
			evaluate5([card("K"), card("K", "hearts"), card("4", "clubs"), card("4", "diamonds"), card("Q")]),
			evaluate5([card("7"), card("7", "hearts"), card("7", "clubs"), card("K", "diamonds"), card("2")]),
			evaluate5([card("9"), card("8", "hearts"), card("7", "clubs"), card("6", "diamonds"), card("5", "spades")]),
			evaluate5([card("A", "hearts"), card("J", "hearts"), card("8", "hearts"), card("5", "hearts"), card("2", "hearts")]),
			evaluate5([card("Q"), card("Q", "hearts"), card("Q", "clubs"), card("9", "diamonds"), card("9")]),
			evaluate5([card("4"), card("4", "hearts"), card("4", "clubs"), card("4", "diamonds"), card("A")]),
			evaluate5([card("9", "hearts"), card("8", "hearts"), card("7", "hearts"), card("6", "hearts"), card("5", "hearts")]),
		];
		for (let i = 1; i < hands.length; i += 1) {
			expect(compareScores(hands[i], hands[i - 1])).toBeGreaterThan(0);
		}
	});

	it("treats identical ranks as a tie", () => {
		const a = evaluate5([card("A"), card("A", "hearts"), card("K", "clubs"), card("5", "diamonds"), card("3")]);
		const b = evaluate5([card("A", "clubs"), card("A", "diamonds"), card("K", "hearts"), card("5", "spades"), card("3", "hearts")]);
		expect(compareScores(a, b)).toBe(0);
	});
});

describe("bestHand", () => {
	it("picks the best five of seven cards", () => {
		const score = bestHand([
			card("A", "hearts"),
			card("K", "hearts"),
			card("Q", "hearts"),
			card("J", "hearts"),
			card("10", "hearts"),
			card("2", "clubs"),
			card("3", "diamonds"),
		]);
		expect(score.category).toBe("straightFlush");
		expect(score.tiebreak).toEqual([14]);
	});

	it("finds a full house among seven cards", () => {
		const score = bestHand([
			card("K"),
			card("K", "hearts"),
			card("K", "clubs"),
			card("9", "diamonds"),
			card("9", "spades"),
			card("2", "hearts"),
			card("3", "clubs"),
		]);
		expect(score.category).toBe("fullHouse");
		expect(score.tiebreak).toEqual([13, 9]);
	});
});
