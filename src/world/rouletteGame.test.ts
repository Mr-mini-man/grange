import { describe, expect, it } from "vitest";
import { type PocketId, WHEEL_ORDER } from "./roulette";
import { RouletteTable } from "./rouletteGame";
import { BET_SPOT_BY_ID } from "./rouletteLayout";
import type { Bank } from "./rouletteTypes";

function makeBank(initial = 100): { bank: Bank; balance: () => number } {
	let balance = initial;
	return {
		bank: {
			getBalance: () => balance,
			withdraw: (amount) => {
				if (balance < amount) return false;
				balance -= amount;
				return true;
			},
			deposit: (amount) => {
				balance += amount;
			},
		},
		balance: () => balance,
	};
}

/** An rng that forces `spinPocket` to land on the given pocket. */
function rngFor(pocket: PocketId): () => number {
	const index = WHEEL_ORDER.indexOf(pocket);
	return () => (index + 0.5) / WHEEL_ORDER.length;
}

function spot(id: string) {
	const found = BET_SPOT_BY_ID.get(id);
	if (!found) throw new Error(`missing spot ${id}`);
	return found;
}

function setup(result: PocketId, initial = 100) {
	const { bank, balance } = makeBank(initial);
	const table = new RouletteTable(bank, { rng: rngFor(result) });
	return { table, balance };
}

describe("RouletteTable betting", () => {
	it("rejects bets below the minimum", () => {
		const { table } = setup("17");
		expect(table.placeBet(spot("n:17"), 1)).toBe(false);
		expect(table.snapshot().message).toMatch(/Minimum/);
	});

	it("rejects bets above the available balance", () => {
		const { table } = setup("17");
		expect(table.placeBet(spot("n:17"), 100)).toBe(true);
		expect(table.placeBet(spot("n:18"), 5)).toBe(false);
		expect(table.snapshot().message).toMatch(/Not enough/);
	});

	it("accumulates chips placed on the same spot", () => {
		const { table } = setup("17");
		table.placeBet(spot("n:17"), 10);
		table.placeBet(spot("n:17"), 25);
		const snapshot = table.snapshot();
		expect(snapshot.bets).toHaveLength(1);
		expect(snapshot.bets[0].amount).toBe(35);
		expect(snapshot.totalStaked).toBe(35);
		expect(snapshot.available).toBe(65);
	});

	it("removes a bet and frees the balance again", () => {
		const { table } = setup("17");
		table.placeBet(spot("n:17"), 10);
		expect(table.removeBet("n:17")).toBe(true);
		expect(table.snapshot().bets).toHaveLength(0);
		expect(table.snapshot().available).toBe(100);
	});
});

describe("RouletteTable spinning", () => {
	it("withdraws the stake only on spin", () => {
		const { table, balance } = setup("17");
		table.placeBet(spot("n:17"), 10);
		expect(balance()).toBe(100);
		expect(table.spin()).toBe(true);
		expect(balance()).toBe(90);
		expect(table.snapshot().phase).toBe("spinning");
	});

	it("refuses to spin with no bets", () => {
		const { table } = setup("17");
		expect(table.spin()).toBe(false);
		expect(table.snapshot().message).toMatch(/Place a bet/);
	});

	it("pays 1:1 on a winning colour", () => {
		const { table, balance } = setup("18");
		table.placeBet(spot("outside:red"), 10);
		table.spin();
		table.settle();
		expect(balance()).toBe(110);
		expect(table.snapshot().net).toBe(10);
		expect(table.snapshot().bets[0].won).toBe(true);
	});

	it("loses a colour bet on the other colour", () => {
		const { table, balance } = setup("2");
		table.placeBet(spot("outside:red"), 10);
		table.spin();
		table.settle();
		expect(balance()).toBe(90);
		expect(table.snapshot().net).toBe(-10);
		expect(table.snapshot().bets[0].won).toBe(false);
	});

	it("pays 35:1 straight up", () => {
		const { table, balance } = setup("17");
		table.placeBet(spot("n:17"), 10);
		table.spin();
		table.settle();
		expect(balance()).toBe(450);
		expect(table.snapshot().net).toBe(350);
	});

	it("loses every outside bet when the wheel lands on 0", () => {
		const { table, balance } = setup("0");
		table.placeBet(spot("outside:red"), 10);
		table.placeBet(spot("outside:odd"), 10);
		table.placeBet(spot("outside:high"), 10);
		table.spin();
		table.settle();
		expect(balance()).toBe(70);
		expect(table.snapshot().net).toBe(-30);
	});

	it("can win several bets at once", () => {
		const { table, balance } = setup("9");
		table.placeBet(spot("outside:red"), 10);
		table.placeBet(spot("outside:odd"), 10);
		table.placeBet(spot("outside:low"), 10);
		table.spin();
		table.settle();
		expect(balance()).toBe(130);
		expect(table.snapshot().net).toBe(30);
	});

	it("ignores placement and removal outside the betting phase", () => {
		const { table } = setup("17");
		table.placeBet(spot("n:17"), 10);
		table.spin();
		expect(table.placeBet(spot("n:18"), 10)).toBe(false);
		expect(table.removeBet("n:17")).toBe(false);
		table.settle();
		expect(table.placeBet(spot("n:18"), 10)).toBe(false);
	});
});

describe("RouletteTable rounds", () => {
	it("clears the table and keeps the balance on a new round", () => {
		const { table, balance } = setup("17");
		table.placeBet(spot("n:17"), 10);
		table.spin();
		table.settle();
		const settled = balance();
		table.newRound();
		const snapshot = table.snapshot();
		expect(snapshot.phase).toBe("betting");
		expect(snapshot.bets).toHaveLength(0);
		expect(snapshot.result).toBeNull();
		expect(balance()).toBe(settled);
	});
});
