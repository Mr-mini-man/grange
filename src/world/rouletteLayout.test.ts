import { describe, expect, it } from "vitest";
import {
	BLACK_NUMBERS,
	PAYOUTS,
	RED_NUMBERS,
	STRAIGHT_NUMBERS,
} from "./roulette";
import { BET_SPOTS, BET_SPOT_BY_ID } from "./rouletteLayout";

function spot(id: string) {
	const found = BET_SPOT_BY_ID.get(id);
	if (!found) throw new Error(`missing spot ${id}`);
	return found;
}

const sorted = (id: string) => [...spot(id).numbers].sort();

describe("roulette felt layout", () => {
	it("has a straight spot for every pocket", () => {
		for (const number of STRAIGHT_NUMBERS) {
			expect(spot(`n:${number}`).numbers).toEqual([number]);
		}
		expect(spot("n:0").numbers).toEqual(["0"]);
		expect(spot("n:00").numbers).toEqual(["00"]);
	});

	it("gives every spot a unique id, a payout, and covered numbers", () => {
		const ids = BET_SPOTS.map((entry) => entry.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const entry of BET_SPOTS) {
			expect(entry.payout).toBe(PAYOUTS[entry.kind]);
			expect(entry.numbers.length).toBeGreaterThan(0);
			expect(entry.w).toBeGreaterThan(0);
			expect(entry.h).toBeGreaterThan(0);
		}
	});

	it("covers the right numbers for the even-money bets", () => {
		expect(sorted("outside:red")).toEqual([...RED_NUMBERS].sort());
		expect(sorted("outside:black")).toEqual([...BLACK_NUMBERS].sort());
		expect(sorted("outside:low")).toEqual(
			[...STRAIGHT_NUMBERS.slice(0, 18)].sort(),
		);
		expect(sorted("outside:high")).toEqual(
			[...STRAIGHT_NUMBERS.slice(18)].sort(),
		);
		expect(spot("outside:even").numbers).toHaveLength(18);
		expect(spot("outside:odd").numbers).toHaveLength(18);
	});

	it("covers the right numbers for dozens and columns", () => {
		expect(sorted("dozen:0")).toEqual(
			[...STRAIGHT_NUMBERS.slice(0, 12)].sort(),
		);
		expect(sorted("dozen:1")).toEqual(
			[...STRAIGHT_NUMBERS.slice(12, 24)].sort(),
		);
		expect(sorted("dozen:2")).toEqual(
			[...STRAIGHT_NUMBERS.slice(24, 36)].sort(),
		);
		expect(spot("column:0").numbers).toEqual([
			"3",
			"6",
			"9",
			"12",
			"15",
			"18",
			"21",
			"24",
			"27",
			"30",
			"33",
			"36",
		]);
		expect(spot("column:2").numbers).toEqual([
			"1",
			"4",
			"7",
			"10",
			"13",
			"16",
			"19",
			"22",
			"25",
			"28",
			"31",
			"34",
		]);
	});

	it("builds the combination bets with the right numbers", () => {
		expect(BET_SPOTS.filter((entry) => entry.kind === "street")).toHaveLength(
			12,
		);
		expect(BET_SPOTS.filter((entry) => entry.kind === "line")).toHaveLength(11);
		expect(BET_SPOTS.filter((entry) => entry.kind === "corner")).toHaveLength(
			22,
		);
		expect(sorted("street:0")).toEqual(["1", "2", "3"]);
		expect(sorted("line:0")).toEqual(["1", "2", "3", "4", "5", "6"]);
		expect(sorted("corner:0:0")).toEqual(["2", "3", "5", "6"]);
		expect(sorted("corner:0:1")).toEqual(["1", "2", "4", "5"]);
		expect(sorted("five:0")).toEqual(["0", "00", "1", "2", "3"]);
		expect(spot("split-h:0:2").numbers).toEqual(["1", "4"]);
	});
});
