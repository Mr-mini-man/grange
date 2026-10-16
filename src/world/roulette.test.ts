import { describe, expect, it } from "vitest";
import {
	BLACK_NUMBERS,
	PAYOUTS,
	RED_NUMBERS,
	STRAIGHT_NUMBERS,
	WHEEL_ORDER,
	payoutFor,
	pocketColor,
	returnOnWin,
	spinPocket,
} from "./roulette";

describe("roulette pockets", () => {
	it("colours the zeros green and splits the rest red and black", () => {
		expect(pocketColor("0")).toBe("green");
		expect(pocketColor("00")).toBe("green");
		expect(pocketColor("1")).toBe("red");
		expect(pocketColor("2")).toBe("black");
		expect(pocketColor("18")).toBe("red");
		expect(pocketColor("19")).toBe("red");
		expect(pocketColor("36")).toBe("red");
	});

	it("has 18 red and 18 black numbers that partition 1-36", () => {
		expect(RED_NUMBERS).toHaveLength(18);
		expect(BLACK_NUMBERS).toHaveLength(18);
		expect(RED_NUMBERS.filter((n) => BLACK_NUMBERS.includes(n))).toEqual([]);
		expect([...RED_NUMBERS, ...BLACK_NUMBERS].sort()).toEqual(
			[...STRAIGHT_NUMBERS].sort(),
		);
	});

	it("orders all 38 pockets on the wheel exactly once", () => {
		expect(WHEEL_ORDER).toHaveLength(38);
		expect(new Set(WHEEL_ORDER).size).toBe(38);
		expect(WHEEL_ORDER).toContain("0");
		expect(WHEEL_ORDER).toContain("00");
	});

	it("balances the wheel to 18 red, 18 black, and 2 green pockets", () => {
		const counts = { red: 0, black: 0, green: 0 };
		for (const pocket of WHEEL_ORDER) counts[pocketColor(pocket)] += 1;
		expect(counts).toEqual({ red: 18, black: 18, green: 2 });
	});
});

describe("spinPocket", () => {
	it("is deterministic with an injected rng", () => {
		expect(spinPocket(() => 0)).toBe(WHEEL_ORDER[0]);
		expect(spinPocket(() => 0.999999)).toBe(WHEEL_ORDER[37]);
	});

	it("clamps an out-of-range rng", () => {
		expect(spinPocket(() => 1)).toBe(WHEEL_ORDER[37]);
	});
});

describe("payouts", () => {
	it("returns stake plus winnings, so 1:1 pays 20 on a 10 bet", () => {
		expect(returnOnWin(10, 1)).toBe(20);
		expect(payoutFor(10, "red")).toBe(20);
		expect(payoutFor(10, "odd")).toBe(20);
	});

	it("pays the straight, split, and even-money odds", () => {
		expect(payoutFor(10, "straight")).toBe(360);
		expect(payoutFor(10, "split")).toBe(180);
		expect(payoutFor(10, "five-number")).toBe(70);
		expect(payoutFor(10, "dozen")).toBe(30);
		expect(payoutFor(10, "column")).toBe(30);
	});

	it("matches the published American odds table", () => {
		expect(PAYOUTS).toEqual({
			straight: 35,
			split: 17,
			street: 11,
			corner: 8,
			"five-number": 6,
			line: 5,
			column: 2,
			dozen: 2,
			red: 1,
			black: 1,
			odd: 1,
			even: 1,
			low: 1,
			high: 1,
		});
	});
});
