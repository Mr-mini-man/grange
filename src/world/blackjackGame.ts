import {
	type Card,
	MIN_BET,
	createDeck,
	dealerShouldHit,
	handValue,
	isBlackjack,
	isSplittable,
	shuffle,
} from "./blackjack";
import { payoutFor } from "./blackjackPayouts";
import type {
	Bank,
	BlackjackOptions,
	BlackjackSnapshot,
	HandResult,
	Phase,
} from "./blackjackTypes";

/** A player can split at most three times, ending with four hands. */
export const MAX_HANDS = 4;

interface PlayerHand {
	id: number;
	cards: Card[];
	wager: number;
	doubled: boolean;
	surrendered: boolean;
	fromSplit: boolean;
	done: boolean;
	result: HandResult | null;
}

/** Standard blackjack vs. the dealer. The deck is reshuffled every hand. */
export class BlackjackTable {
	private readonly bank: Bank;
	private readonly rng: () => number;
	private readonly riggedDeck?: readonly Card[];
	private deck: Card[];
	private phase: Phase;
	private bet: number;
	private dealer: Card[];
	private hands: PlayerHand[];
	private activeHand: number;
	private message: string;
	private net: number;
	private nextHandId: number;

	constructor(bank: Bank, options: BlackjackOptions = {}) {
		this.bank = bank;
		this.rng = options.rng ?? Math.random;
		this.riggedDeck = options.deck;
		this.deck = [];
		this.phase = "betting";
		this.bet = options.bet ?? MIN_BET;
		this.dealer = [];
		this.hands = [];
		this.activeHand = 0;
		this.message = "Place your bet.";
		this.net = 0;
		this.nextHandId = 0;
	}

	setBet(amount: number): void {
		if (this.phase !== "betting") return;
		this.bet = amount;
	}

	betError(): string | null {
		if (!Number.isFinite(this.bet)) return "Enter a bet";
		if (this.bet < MIN_BET) return `Minimum bet is ${MIN_BET}`;
		if (this.bet > this.bank.getBalance()) return "Not enough Grangecoin";
		return null;
	}

	deal(): boolean {
		if (this.phase !== "betting") return false;
		const error = this.betError();
		if (error) {
			this.message = error;
			return false;
		}
		const wager = Math.floor(this.bet);
		if (!this.bank.withdraw(wager)) {
			this.message = "Not enough Grangecoin";
			return false;
		}
		this.deck = this.riggedDeck
			? [...this.riggedDeck]
			: shuffle(createDeck(), this.rng);
		this.dealer = [this.draw(), this.draw()];
		this.hands = [this.makeHand([this.draw(), this.draw()], wager, false)];
		this.activeHand = 0;
		this.net = 0;
		this.message = "Hit or stand?";
		if (isBlackjack(this.dealer) || isBlackjack(this.hands[0].cards)) {
			this.settle();
			return true;
		}
		this.phase = "playerTurn";
		return true;
	}

	hit(): boolean {
		const hand = this.playable();
		if (!hand) return false;
		hand.cards.push(this.draw());
		if (handValue(hand.cards).total >= 21) {
			hand.done = true;
			this.advance();
		}
		return true;
	}

	stand(): boolean {
		const hand = this.playable();
		if (!hand) return false;
		hand.done = true;
		this.advance();
		return true;
	}

	double(): boolean {
		const hand = this.playable();
		if (hand?.cards.length !== 2) return false;
		if (!this.bank.withdraw(hand.wager)) {
			this.message = "Not enough Grangecoin to double";
			return false;
		}
		hand.wager *= 2;
		hand.doubled = true;
		hand.cards.push(this.draw());
		hand.done = true;
		this.advance();
		return true;
	}

	split(): boolean {
		const hand = this.playable();
		if (hand?.cards.length !== 2) return false;
		if (!isSplittable(hand.cards)) return false;
		if (this.hands.length >= MAX_HANDS) {
			this.message = "No more splits";
			return false;
		}
		if (!this.bank.withdraw(hand.wager)) {
			this.message = "Not enough Grangecoin to split";
			return false;
		}
		const [first, second] = hand.cards;
		const aces = first.rank === "A" && second.rank === "A";
		hand.cards = [first, this.draw()];
		hand.fromSplit = true;
		const next = this.makeHand([second, this.draw()], hand.wager, true);
		this.hands.splice(this.activeHand + 1, 0, next);
		this.message = "Hand split.";
		if (aces) {
			hand.done = true;
			next.done = true;
			this.advance();
		}
		return true;
	}

	/** Surrender is only offered on the opening hand, before any action. */
	surrender(): boolean {
		const hand = this.playable();
		if (!hand || this.hands.length !== 1) return false;
		if (hand.cards.length !== 2 || hand.doubled) return false;
		hand.surrendered = true;
		hand.done = true;
		this.advance();
		return true;
	}

	newRound(): void {
		if (this.phase !== "settled") return;
		this.phase = "betting";
		this.dealer = [];
		this.hands = [];
		this.activeHand = 0;
		this.net = 0;
		this.message = "Place your bet.";
		this.bet = Math.min(this.bet, this.bank.getBalance());
	}

	snapshot(): BlackjackSnapshot {
		const hand = this.active();
		const hideHole = this.phase === "playerTurn" && this.dealer.length > 1;
		const dealer = hideHole ? this.dealer.slice(0, 1) : this.dealer.slice();
		const dealerValue = handValue(dealer);
		return {
			phase: this.phase,
			bet: this.bet,
			balance: this.bank.getBalance(),
			dealer,
			dealerHidden: hideHole,
			dealerTotal: dealerValue.total,
			dealerSoft: dealerValue.soft,
			hands: this.hands.map((h) => {
				const value = handValue(h.cards);
				return {
					id: h.id,
					cards: h.cards.slice(),
					total: value.total,
					soft: value.soft,
					wager: h.wager,
					result: h.result,
				};
			}),
			activeHand: this.activeHand,
			message: this.message,
			net: this.net,
			betError: this.phase === "betting" ? this.betError() : null,
			canHit: this.canAct(hand),
			canStand: this.canAct(hand),
			canDouble: this.canAct(hand) && this.canAfford(hand),
			canSplit:
				this.canAct(hand) &&
				this.canAfford(hand) &&
				isSplittable(hand.cards) &&
				this.hands.length < MAX_HANDS,
			canSurrender:
				this.canAct(hand) &&
				this.hands.length === 1 &&
				hand.cards.length === 2 &&
				!hand.doubled,
		};
	}

	private canAct(hand: PlayerHand | null): hand is PlayerHand {
		return this.phase === "playerTurn" && !!hand && !hand.done;
	}

	private canAfford(hand: PlayerHand | null): boolean {
		return (
			!!hand &&
			hand.cards.length === 2 &&
			this.bank.getBalance() >= hand.wager
		);
	}

	private active(): PlayerHand | null {
		return this.hands[this.activeHand] ?? null;
	}

	private playable(): PlayerHand | null {
		const hand = this.active();
		return this.canAct(hand) ? hand : null;
	}

	private makeHand(
		cards: Card[],
		wager: number,
		fromSplit: boolean,
	): PlayerHand {
		return {
			id: this.nextHandId++,
			cards,
			wager,
			doubled: false,
			surrendered: false,
			fromSplit,
			done: false,
			result: null,
		};
	}

	private draw(): Card {
		if (this.deck.length === 0) this.deck = shuffle(createDeck(), this.rng);
		return this.deck.shift() as Card;
	}

	private advance(): void {
		const next = this.hands.findIndex((h, i) => i > this.activeHand && !h.done);
		if (next !== -1) {
			this.activeHand = next;
			this.message = "Hit or stand?";
			return;
		}
		this.phase = "dealerTurn";
		while (dealerShouldHit(this.dealer)) this.dealer.push(this.draw());
		this.settle();
	}

	private settle(): void {
		const dealerTotal = handValue(this.dealer).total;
		let net = 0;
		for (const hand of this.hands) {
			hand.result = this.resultFor(hand, dealerTotal);
			const payout = payoutFor(hand.wager, hand.result);
			this.bank.deposit(payout);
			net += payout - hand.wager;
		}
		this.net = net;
		this.phase = "settled";
		const sign = net > 0 ? "+" : "";
		this.message = `Round over (${sign}${net}).`;
	}

	private resultFor(hand: PlayerHand, dealerTotal: number): HandResult {
		if (hand.surrendered) return "surrender";
		const total = handValue(hand.cards).total;
		if (total > 21) return "bust";
		if (isBlackjack(hand.cards) && !hand.fromSplit) {
			return isBlackjack(this.dealer) ? "push" : "blackjack";
		}
		if (dealerTotal > 21 || total > dealerTotal) return "win";
		if (total === dealerTotal) return "push";
		return "lose";
	}
}
