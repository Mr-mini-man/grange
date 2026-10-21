import { describe, expect, it } from "vitest";
import {
	MAX_BET,
	MIN_BET,
	REEL_COUNT,
	SLOT_BETS,
	SLOT_SYMBOLS,
	expectedReturn,
	maxWin,
	payoutFor,
	spinReel,
	spinReels,
	symbolDef,
	winningSymbol,
} from "./slots";

describe("slot symbols", () => {
	it("has four reel items with a common one and a rare jackpot", () => {
		expect(SLOT_SYMBOLS).toHaveLength(4);
		const cherry = symbolDef("cherry");
		const seven = symbolDef("seven");
		expect(cherry.weight).toBeGreaterThan(seven.weight);
		expect(seven.multiplier).toBeGreaterThan(cherry.multiplier);
	});

	it("uses positive weights", () => {
		for (const symbol of SLOT_SYMBOLS) {
			expect(symbol.weight).toBeGreaterThan(0);
			expect(symbol.multiplier).toBeGreaterThan(0);
		}
	});
});

describe("slot bets", () => {
	it("offers the $1/$5/$10/$15/$20/$50 spins with a $50 maximum", () => {
		expect([...SLOT_BETS]).toEqual([1, 5, 10, 15, 20, 50]);
		expect(MIN_BET).toBe(1);
		expect(MAX_BET).toBe(50);
	});
});

describe("spinReel", () => {
	it("is deterministic with an injected rng", () => {
		expect(spinReel(() => 0)).toBe("cherry");
		expect(spinReel(() => 0.5)).toBe("bell");
		expect(spinReel(() => 0.999999)).toBe("seven");
	});

	it("spins three reels per round", () => {
		expect(spinReels(() => 0)).toHaveLength(REEL_COUNT);
	});
});

describe("winningSymbol", () => {
	it("returns the shared symbol on a three-in-a-row", () => {
		expect(winningSymbol(["diamond", "diamond", "diamond"])).toBe("diamond");
	});

	it("returns null when the reels do not match", () => {
		expect(winningSymbol(["cherry", "bell", "cherry"])).toBeNull();
		expect(winningSymbol(["cherry", "cherry"])).toBeNull();
	});
});

describe("payouts", () => {
	it("pays the symbol multiplier times the stake", () => {
		expect(payoutFor("cherry", 1)).toBe(3);
		expect(payoutFor("bell", 10)).toBe(120);
		expect(payoutFor("diamond", 20)).toBe(1000);
	});

	it("caps the jackpot at $10,000 from a $50 spin", () => {
		expect(payoutFor("seven", 50)).toBe(10000);
		expect(maxWin()).toBe(10000);
	});

	it("keeps the long-run return under the stake", () => {
		const rtp = expectedReturn();
		expect(rtp).toBeGreaterThan(0.85);
		expect(rtp).toBeLessThan(1);
	});
});
