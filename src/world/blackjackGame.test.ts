import { describe, expect, it } from "vitest";
import type { Card, Rank } from "./blackjack";
import { BlackjackTable } from "./blackjackGame";
import type { Bank } from "./blackjackTypes";

const c = (rank: Rank): Card => ({ rank, suit: "spades" });

function makeBank(initial = 100): {
	bank: Bank;
	balance: () => number;
} {
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

function setup(deck: readonly Card[], bet = 10, initial = 100) {
	const { bank, balance } = makeBank(initial);
	const table = new BlackjackTable(bank, { deck, bet });
	return { table, balance };
}

describe("BlackjackTable betting", () => {
	it("deducts the wager on deal", () => {
		const { table, balance } = setup([c("9"), c("9"), c("10"), c("J")]);
		expect(table.deal()).toBe(true);
		expect(balance()).toBe(90);
		expect(table.snapshot().phase).toBe("playerTurn");
	});

	it("rejects bets outside the allowed range", () => {
		const { table } = setup([c("9"), c("9"), c("10"), c("J")]);
		table.setBet(1);
		expect(table.betError()).toMatch(/Minimum/);
		table.setBet(500);
		expect(table.betError()).toMatch(/Not enough/);
		expect(table.deal()).toBe(false);
		table.setBet(10);
		expect(table.betError()).toBeNull();
	});

	it("ignores actions outside the player's turn", () => {
		const { table } = setup([c("9"), c("9"), c("10"), c("J")]);
		expect(table.hit()).toBe(false);
		expect(table.stand()).toBe(false);
		expect(table.double()).toBe(false);
		expect(table.split()).toBe(false);
		expect(table.surrender()).toBe(false);
		expect(table.deal()).toBe(true);
		expect(table.deal()).toBe(false);
	});
});

describe("BlackjackTable outcomes", () => {
	it("pays 1:1 on a win", () => {
		const { table, balance } = setup([c("9"), c("9"), c("10"), c("J")]);
		table.deal();
		expect(table.stand()).toBe(true);
		const snap = table.snapshot();
		expect(snap.phase).toBe("settled");
		expect(snap.hands[0].result).toBe("win");
		expect(balance()).toBe(110);
		expect(snap.net).toBe(10);
	});

	it("pays 3:2 on a natural blackjack", () => {
		const { table, balance } = setup([c("9"), c("8"), c("A"), c("K")]);
		table.deal();
		const snap = table.snapshot();
		expect(snap.phase).toBe("settled");
		expect(snap.hands[0].result).toBe("blackjack");
		expect(balance()).toBe(115);
		expect(snap.net).toBe(15);
	});

	it("reveals the dealer once a natural settles", () => {
		const { table } = setup([c("9"), c("8"), c("A"), c("K")]);
		table.deal();
		const snap = table.snapshot();
		expect(snap.dealerHidden).toBe(false);
		expect(snap.dealer).toHaveLength(2);
	});

	it("pushes equal totals and returns the wager", () => {
		const { table, balance } = setup([c("9"), c("9"), c("10"), c("8")]);
		table.deal();
		table.stand();
		const snap = table.snapshot();
		expect(snap.hands[0].result).toBe("push");
		expect(balance()).toBe(100);
		expect(snap.net).toBe(0);
	});

	it("pushes two naturals", () => {
		const { table, balance } = setup([c("A"), c("K"), c("A"), c("K")]);
		table.deal();
		const snap = table.snapshot();
		expect(snap.hands[0].result).toBe("push");
		expect(balance()).toBe(100);
	});

	it("loses a busted hand", () => {
		const { table, balance } = setup([
			c("9"),
			c("9"),
			c("10"),
			c("6"),
			c("10"),
		]);
		table.deal();
		expect(table.hit()).toBe(true);
		const snap = table.snapshot();
		expect(snap.phase).toBe("settled");
		expect(snap.hands[0].result).toBe("bust");
		expect(balance()).toBe(90);
	});

	it("returns half the wager on surrender", () => {
		const { table, balance } = setup([c("9"), c("9"), c("10"), c("6")]);
		table.deal();
		expect(table.snapshot().canSurrender).toBe(true);
		expect(table.surrender()).toBe(true);
		const snap = table.snapshot();
		expect(snap.hands[0].result).toBe("surrender");
		expect(balance()).toBe(95);
		expect(snap.net).toBe(-5);
	});
});

describe("BlackjackTable double and split", () => {
	it("doubles the wager and draws exactly one card", () => {
		const { table, balance } = setup([
			c("9"),
			c("9"),
			c("5"),
			c("6"),
			c("10"),
		]);
		table.deal();
		expect(table.snapshot().canDouble).toBe(true);
		expect(table.double()).toBe(true);
		const snap = table.snapshot();
		expect(snap.hands[0].cards).toHaveLength(3);
		expect(snap.hands[0].wager).toBe(20);
		expect(snap.hands[0].result).toBe("win");
		expect(balance()).toBe(120);
		expect(snap.net).toBe(20);
	});

	it("disables double when the balance is short", () => {
		const { table } = setup([c("9"), c("9"), c("5"), c("6")], 100, 100);
		table.deal();
		expect(table.snapshot().canDouble).toBe(false);
	});

	it("splits a pair into two independent hands", () => {
		const { table, balance } = setup([
			c("9"),
			c("9"),
			c("8"),
			c("8"),
			c("10"),
			c("3"),
		]);
		table.deal();
		expect(table.snapshot().canSplit).toBe(true);
		expect(table.split()).toBe(true);
		let snap = table.snapshot();
		expect(snap.hands).toHaveLength(2);
		expect(snap.activeHand).toBe(0);
		expect(snap.hands[0].total).toBe(18);
		expect(snap.hands[1].total).toBe(11);
		table.stand();
		snap = table.snapshot();
		expect(snap.activeHand).toBe(1);
		table.stand();
		snap = table.snapshot();
		expect(snap.hands[0].result).toBe("push");
		expect(snap.hands[1].result).toBe("lose");
		expect(balance()).toBe(90);
		expect(snap.net).toBe(-10);
	});

	it("splits aces into two auto-stood hands", () => {
		const { table, balance } = setup([
			c("9"),
			c("9"),
			c("A"),
			c("A"),
			c("10"),
			c("5"),
		]);
		table.deal();
		expect(table.split()).toBe(true);
		const snap = table.snapshot();
		expect(snap.phase).toBe("settled");
		expect(snap.hands[0].result).toBe("win");
		expect(snap.hands[1].result).toBe("lose");
		expect(balance()).toBe(100);
	});

	it("does not offer a split on a non-pair", () => {
		const { table } = setup([c("9"), c("9"), c("8"), c("9")]);
		table.deal();
		expect(table.snapshot().canSplit).toBe(false);
	});
});

describe("BlackjackTable dealer rules", () => {
	it("hits on a soft 17", () => {
		const { table, balance } = setup([
			c("A"),
			c("6"),
			c("10"),
			c("8"),
			c("3"),
		]);
		table.deal();
		table.stand();
		const snap = table.snapshot();
		expect(snap.dealerTotal).toBe(20);
		expect(snap.hands[0].result).toBe("lose");
		expect(balance()).toBe(90);
	});

	it("stands on a hard 17", () => {
		const { table, balance } = setup([c("10"), c("7"), c("10"), c("8")]);
		table.deal();
		table.stand();
		expect(table.snapshot().hands[0].result).toBe("win");
		expect(balance()).toBe(110);
	});
});

describe("BlackjackTable rounds", () => {
	it("starts a fresh round without touching the balance", () => {
		const { table, balance } = setup([c("9"), c("9"), c("10"), c("J")]);
		table.deal();
		table.stand();
		const settled = balance();
		table.newRound();
		const snap = table.snapshot();
		expect(snap.phase).toBe("betting");
		expect(snap.hands).toHaveLength(0);
		expect(snap.dealer).toHaveLength(0);
		expect(balance()).toBe(settled);
	});
});
