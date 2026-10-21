import { describe, expect, it } from "vitest";
import { SlotMachine } from "./slotsGame";
import type { Bank } from "./slotsTypes";

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

/** An rng that always lands the given fractional reel position. */
const constantRng = (value: number) => () => value;
const alwaysSeven = constantRng(0.999);
const alwaysCherry = constantRng(0);

/** Plays a fixed sequence of reel rolls, cycling forever. */
function scriptedRng(values: number[]): () => number {
	let index = 0;
	return () => {
		const value = values[index % values.length];
		index += 1;
		return value;
	};
}

function setup(rng: () => number = alwaysCherry, initial = 100) {
	const { bank, balance } = makeBank(initial);
	const machine = new SlotMachine(bank, { rng });
	return { machine, balance };
}

describe("SlotMachine betting", () => {
	it("only accepts the listed spin sizes", () => {
		const { machine } = setup();
		expect(machine.setBet(10)).toBe(true);
		expect(machine.snapshot().bet).toBe(10);
		expect(machine.setBet(7)).toBe(false);
		expect(machine.snapshot().message).toMatch(/Bet must/);
	});

	it("rejects a bet above $50", () => {
		const { machine } = setup();
		expect(machine.setBet(100)).toBe(false);
		expect(machine.snapshot().bet).toBe(1);
	});

	it("reports when the balance cannot cover the bet", () => {
		const { machine } = setup(alwaysCherry, 10);
		machine.setBet(50);
		expect(machine.betError()).toMatch(/Not enough/);
		expect(machine.spin()).toBe(false);
	});
});

describe("SlotMachine spinning", () => {
	it("withdraws the stake only on spin", () => {
		const { machine, balance } = setup(alwaysCherry, 100);
		machine.setBet(10);
		expect(balance()).toBe(100);
		expect(machine.spin()).toBe(true);
		expect(balance()).toBe(90);
		expect(machine.snapshot().phase).toBe("spinning");
	});

	it("pays three cherries at the easy multiplier", () => {
		const { machine, balance } = setup(alwaysCherry, 100);
		machine.setBet(1);
		machine.spin();
		const snapshot = machine.settle();
		expect(snapshot.reels).toEqual(["cherry", "cherry", "cherry"]);
		expect(snapshot.net).toBe(2);
		expect(balance()).toBe(102);
	});

	it("pays the $10,000 jackpot on a $50 seven spin", () => {
		const { machine, balance } = setup(alwaysSeven, 100);
		machine.setBet(50);
		machine.spin();
		const snapshot = machine.settle();
		expect(snapshot.winningSymbol).toBe("seven");
		expect(snapshot.payout).toBe(10000);
		expect(snapshot.message).toMatch(/JACKPOT/);
		expect(balance()).toBe(10050);
	});

	it("loses the stake when the reels do not match", () => {
		const { machine, balance } = setup(scriptedRng([0, 0.5, 0.9]), 100);
		machine.setBet(20);
		machine.spin();
		const snapshot = machine.settle();
		expect(snapshot.winningSymbol).toBeNull();
		expect(snapshot.payout).toBe(0);
		expect(snapshot.net).toBe(-20);
		expect(balance()).toBe(80);
	});

	it("ignores actions outside the betting phase", () => {
		const { machine } = setup(alwaysCherry);
		machine.spin();
		expect(machine.spin()).toBe(false);
		expect(machine.setBet(5)).toBe(false);
		machine.settle();
		expect(machine.spin()).toBe(false);
	});
});

describe("SlotMachine rounds", () => {
	it("clears the reels and keeps the balance on a new round", () => {
		const { machine, balance } = setup(alwaysCherry, 100);
		machine.spin();
		machine.settle();
		const settled = balance();
		machine.newRound();
		const snapshot = machine.snapshot();
		expect(snapshot.phase).toBe("betting");
		expect(snapshot.reels).toEqual([]);
		expect(snapshot.winningSymbol).toBeNull();
		expect(balance()).toBe(settled);
	});
});

describe("SlotMachine rigging", () => {
	it("forces the next spin to the rigged symbol", () => {
		const { machine, balance } = setup(alwaysCherry, 100);
		machine.setBet(50);
		machine.rigNextSpin("seven");
		expect(machine.spin()).toBe(true);
		const snapshot = machine.settle();
		expect(snapshot.reels).toEqual(["seven", "seven", "seven"]);
		expect(snapshot.payout).toBe(10000);
		expect(balance()).toBe(10050);
	});

	it("defaults the rig to the jackpot symbol", () => {
		const { machine } = setup(alwaysCherry, 100);
		machine.rigNextSpin();
		machine.spin();
		expect(machine.settle().winningSymbol).toBe("seven");
	});

	it("consumes the rig after a single spin", () => {
		const { machine } = setup(alwaysCherry, 100);
		machine.rigNextSpin("seven");
		machine.spin();
		machine.settle();
		machine.newRound();
		machine.spin();
		expect(machine.settle().reels).toEqual(["cherry", "cherry", "cherry"]);
	});

	it("spins for free with force, so a broke player still gets the jackpot", () => {
		const { machine, balance } = setup(alwaysCherry, 0);
		machine.setBet(50);
		machine.rigNextSpin("seven");
		expect(machine.spin(true)).toBe(true);
		const snapshot = machine.settle();
		expect(snapshot.payout).toBe(10000);
		expect(balance()).toBe(10000);
	});
});
