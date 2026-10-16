import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "./blackjack";
import type { Bank } from "./blackjackTypes";
import { PokerTable } from "./pokerGame";
import type { DealerStrategy } from "./pokerStrategy";

const c = (rank: Rank, suit: Suit = "spades"): Card => ({ rank, suit });

const alwaysCheck: DealerStrategy = () => ({ type: "check" });
const alwaysCall: DealerStrategy = () => ({ type: "call" });
const alwaysFold: DealerStrategy = () => ({ type: "fold" });

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

/** Like `makeBank`, but the wallet can be made to reject withdrawals. */
function makeControllableBank(initial = 100): {
	bank: Bank;
	setWithdraw: (ok: boolean) => void;
	balance: () => number;
} {
	let balance = initial;
	let canWithdraw = true;
	return {
		bank: {
			getBalance: () => balance,
			withdraw: (amount) => {
				if (!canWithdraw || balance < amount) return false;
				balance -= amount;
				return true;
			},
			deposit: (amount) => {
				balance += amount;
			},
		},
		setWithdraw: (ok) => {
			canWithdraw = ok;
		},
		balance: () => balance,
	};
}

function setup(deck: readonly Card[], strategy: DealerStrategy = alwaysCheck) {
	const { bank, balance } = makeBank(100);
	const table = new PokerTable(bank, { deck, strategy, rng: () => 0.99 });
	return { table, balance };
}

/** Nine cards: player hole, dealer hole, flop, turn, river. */
const runoutDeck = [
	c("A", "spades"),
	c("A", "hearts"),
	c("2", "hearts"),
	c("7", "diamonds"),
	c("3", "clubs"),
	c("4", "clubs"),
	c("8", "hearts"),
	c("9", "spades"),
	c("J", "clubs"),
];

describe("PokerTable blinds and dealing", () => {
	it("posts blinds from both stacks and starts preflop", () => {
		const { table, balance } = setup(runoutDeck);
		expect(table.startHand()).toBe(true);
		const snap = table.snapshot();
		expect(balance()).toBe(95);
		expect(snap.dealerStack).toBe(990);
		expect(snap.pot).toBe(15);
		expect(snap.phase).toBe("playerTurn");
		expect(snap.street).toBe("preflop");
		expect(snap.callAmount).toBe(5);
		expect(snap.playerHole).toEqual([c("A", "spades"), c("A", "hearts")]);
		expect(snap.dealerHole).toEqual([c("2", "hearts"), c("7", "diamonds")]);
		expect(snap.dealerHidden).toBe(true);
	});

	it("will not start without enough for the big blind", () => {
		const { bank } = makeBank(8);
		const table = new PokerTable(bank, { deck: runoutDeck, strategy: alwaysCheck });
		expect(table.startHand()).toBe(false);
		expect(table.snapshot().message).toMatch(/big blind/);
	});

	it("will not start when the dealer can't cover the big blind", () => {
		const { bank } = makeBank(100);
		const table = new PokerTable(bank, {
			deck: runoutDeck,
			strategy: alwaysCheck,
			dealerStack: 5,
		});
		expect(table.startHand()).toBe(false);
		expect(table.snapshot().message).toMatch(/big blind/);
		expect(table.snapshot().dealerStack).toBe(5);
	});
});

describe("PokerTable betting", () => {
	it("awards the pot when the player folds", () => {
		const { table, balance } = setup(runoutDeck);
		table.startHand();
		expect(table.fold()).toBe(true);
		const snap = table.snapshot();
		expect(snap.winner).toBe("dealer");
		expect(snap.net).toBe(-5);
		expect(balance()).toBe(95);
		expect(snap.phase).toBe("settled");
	});

	it("advances to the flop once both players match", () => {
		const { table, balance } = setup(runoutDeck);
		table.startHand();
		expect(table.call()).toBe(true);
		const snap = table.snapshot();
		expect(snap.street).toBe("flop");
		expect(snap.community).toHaveLength(3);
		expect(snap.phase).toBe("playerTurn");
		expect(snap.pot).toBe(20);
		expect(balance()).toBe(90);
	});

	it("rejects a raise below the minimum", () => {
		const { table, balance } = setup(runoutDeck, alwaysFold);
		table.startHand();
		expect(table.raiseTo(12)).toBe(false);
		expect(table.raiseTo(20)).toBe(true);
		const snap = table.snapshot();
		expect(snap.currentBet).toBe(20);
		expect(snap.winner).toBe("player");
		expect(balance()).toBe(110);
	});

	it("aborts the action when the withdrawal fails", () => {
		const { bank, setWithdraw } = makeControllableBank(100);
		const table = new PokerTable(bank, {
			deck: runoutDeck,
			strategy: alwaysCheck,
		});
		expect(table.startHand()).toBe(true);
		// The wallet stops honouring withdrawals after the blind is posted.
		setWithdraw(false);
		expect(table.call()).toBe(false);
		const snap = table.snapshot();
		expect(snap.playerCommitted).toBe(5);
		expect(snap.pot).toBe(15);
		expect(snap.phase).toBe("playerTurn");
	});

	it("never bets more than the opponent can cover", () => {
		const { table, balance } = setup(runoutDeck, alwaysCall);
		table.startHand();
		expect(table.raiseTo(1_000_000)).toBe(true);
		const snap = table.snapshot();
		// Both stacks are capped to the player's whole stack, so no side pot.
		expect(snap.playerTotal).toBe(100);
		expect(snap.dealerTotal).toBe(100);
		expect(snap.pot).toBe(200);
		expect(balance()).toBe(200);
	});
});

describe("PokerTable showdown", () => {
	it("pays the pot to the player with the better hand", () => {
		const { table, balance } = setup(runoutDeck);
		table.startHand();
		table.call();
		table.check();
		table.check();
		table.check();
		const snap = table.snapshot();
		expect(snap.phase).toBe("settled");
		expect(snap.street).toBe("river");
		expect(snap.community).toHaveLength(5);
		expect(snap.winner).toBe("player");
		expect(snap.playerBest).toBe("pair");
		expect(snap.net).toBe(10);
		expect(balance()).toBe(110);
	});

	it("splits when both players play the board", () => {
		const deck = [
			c("2", "spades"),
			c("3", "spades"),
			c("4", "hearts"),
			c("5", "hearts"),
			c("A", "clubs"),
			c("K", "diamonds"),
			c("Q", "hearts"),
			c("J", "spades"),
			c("10", "clubs"),
		];
		const { table, balance } = setup(deck);
		table.startHand();
		table.call();
		table.check();
		table.check();
		table.check();
		const snap = table.snapshot();
		expect(snap.winner).toBe("split");
		expect(snap.net).toBe(0);
		expect(balance()).toBe(100);
	});

	it("runs out the board when the player is all-in", () => {
		const { table, balance } = setup(runoutDeck, alwaysCall);
		table.startHand();
		expect(table.raiseTo(1_000_000)).toBe(true);
		const snap = table.snapshot();
		expect(snap.phase).toBe("settled");
		expect(snap.community).toHaveLength(5);
		expect(snap.winner).toBe("player");
		expect(balance()).toBe(200);
	});

	it("settles as a fold when the player leaves mid-hand", () => {
		const { table, balance } = setup(runoutDeck);
		table.startHand();
		expect(table.forfeit()).toBe(true);
		const snap = table.snapshot();
		expect(snap.phase).toBe("settled");
		expect(snap.winner).toBe("dealer");
		expect(snap.net).toBe(-5);
		expect(balance()).toBe(95);
	});

	it("lets the player take the pot when the dealer folds", () => {
		const { table, balance } = setup(runoutDeck, alwaysFold);
		table.startHand();
		expect(table.raiseTo(30)).toBe(true);
		const snap = table.snapshot();
		expect(snap.winner).toBe("player");
		expect(snap.net).toBe(10);
		expect(balance()).toBe(110);
	});
});

describe("PokerTable rounds", () => {
	it("starts a fresh hand after settling", () => {
		const { table } = setup(runoutDeck);
		table.startHand();
		table.fold();
		expect(table.startHand()).toBe(true);
		const snap = table.snapshot();
		expect(snap.phase).toBe("playerTurn");
		expect(snap.community).toHaveLength(0);
		expect(snap.pot).toBe(15);
	});
});
