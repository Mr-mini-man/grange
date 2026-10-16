import { type Card, createDeck, shuffle } from "./blackjack";
import type { Bank } from "./blackjackTypes";
import type { HandScore } from "./pokerHand";
import { type DealerStrategy, defaultDealerStrategy } from "./pokerStrategy";
import type {
	HandWinner,
	PokerActor,
	PokerOptions,
	PokerPhase,
	Street,
} from "./pokerTypes";

export const SMALL_BLIND = 5;
export const BIG_BLIND = 10;
export const DEALER_START_STACK = 1000;

/**
 * Shared poker-table state and betting actions. Bets are clamped to what the
 * opponent can cover, which keeps every pot side-pot-free. `PokerTable` adds
 * the round flow and showdown; the split keeps each file reviewable.
 */
export abstract class PokerTableBase {
	protected readonly bank: Bank;
	protected readonly rng: () => number;
	protected readonly riggedDeck?: readonly Card[];
	protected readonly smallBlind: number;
	protected readonly bigBlind: number;
	protected readonly strategy: DealerStrategy;
	protected deck: Card[];
	protected phase: PokerPhase;
	protected street: Street;
	protected playerHole: Card[];
	protected dealerHole: Card[];
	protected community: Card[];
	protected playerStreet: number;
	protected dealerStreet: number;
	protected playerTotal: number;
	protected dealerTotal: number;
	protected currentBet: number;
	protected minRaise: number;
	protected playerActed: boolean;
	protected dealerActed: boolean;
	protected dealerStack: number;
	protected message: string;
	protected net: number;
	protected winner: HandWinner | null;
	protected playerScore: HandScore | null;
	protected dealerScore: HandScore | null;

	constructor(bank: Bank, options: PokerOptions = {}) {
		this.bank = bank;
		this.rng = options.rng ?? Math.random;
		this.riggedDeck = options.deck;
		this.smallBlind = options.smallBlind ?? SMALL_BLIND;
		this.bigBlind = options.bigBlind ?? BIG_BLIND;
		this.strategy = options.strategy ?? defaultDealerStrategy;
		this.deck = [];
		this.phase = "idle";
		this.street = "preflop";
		this.playerHole = [];
		this.dealerHole = [];
		this.community = [];
		this.playerStreet = 0;
		this.dealerStreet = 0;
		this.playerTotal = 0;
		this.dealerTotal = 0;
		this.currentBet = 0;
		this.minRaise = this.bigBlind;
		this.playerActed = false;
		this.dealerActed = false;
		this.dealerStack = options.dealerStack ?? DEALER_START_STACK;
		this.message = "Press Deal to post the blinds.";
		this.net = 0;
		this.winner = null;
		this.playerScore = null;
		this.dealerScore = null;
	}

	/** Chips in the middle, from both seats. */
	get pot(): number {
		return this.playerTotal + this.dealerTotal;
	}

	fold(): boolean {
		if (!this.canAct()) return false;
		const actor = this.actor();
		const winning: PokerActor = this.other(actor);
		this.winner = winning === "player" ? "player" : "dealer";
		if (winning === "player") {
			this.bank.deposit(this.pot);
			this.net = this.pot - this.playerTotal;
		} else {
			this.net = -this.playerTotal;
		}
		const folded = actor === "player" ? "You" : "The dealer";
		const taker = winning === "player" ? "You win" : "The dealer wins";
		this.message = `${folded} folded. ${taker} $${this.pot}.`;
		this.phase = "settled";
		return true;
	}

	/**
	 * The player walks away mid-hand. Settle it as if they folded so the pot and
	 * committed chips don't linger half-played; unlike `fold`, this always
	 * forfeits the player's hand even when it is the dealer's turn.
	 */
	forfeit(): boolean {
		if (!this.canAct()) return false;
		this.winner = "dealer";
		this.net = -this.playerTotal;
		this.message = `You left the table. The dealer takes $${this.pot}.`;
		this.phase = "settled";
		return true;
	}

	check(): boolean {
		if (!this.canAct()) return false;
		const actor = this.actor();
		if (this.streetOf(actor) !== this.currentBet) return false;
		this.setActed(actor, true);
		this.message = `${this.nameFor(actor)} checks.`;
		this.endAction();
		return true;
	}

	call(): boolean {
		if (!this.canAct()) return false;
		const actor = this.actor();
		const need = this.currentBet - this.streetOf(actor);
		if (need <= 0) return false;
		if (!this.commit(actor, need)) return false;
		this.setActed(actor, true);
		this.message = `${this.nameFor(actor)} calls $${need}.`;
		this.endAction();
		return true;
	}

	raiseTo(target: number): boolean {
		if (!this.canAct()) return false;
		const actor = this.actor();
		const opponent = this.other(actor);
		const myMax = this.streetOf(actor) + this.stackOf(actor);
		const oppMax = this.streetOf(opponent) + this.stackOf(opponent);
		const amount = Math.min(Math.floor(target), myMax, oppMax);
		if (amount <= this.currentBet) return false;
		const minTarget = this.currentBet + this.minRaise;
		// Short all-ins are allowed; any other raise must meet the minimum.
		if (amount < minTarget && amount !== myMax && amount !== oppMax) {
			return false;
		}
		if (!this.commit(actor, amount - this.streetOf(actor))) return false;
		const raiseSize = amount - this.currentBet;
		if (raiseSize > this.minRaise) this.minRaise = raiseSize;
		this.currentBet = amount;
		this.setActed(actor, true);
		this.setActed(opponent, false);
		this.message = `${this.nameFor(actor)} raises to $${amount}.`;
		this.endAction();
		return true;
	}

	protected abstract advanceStreet(): void;

	protected abstract runDealer(): void;

	protected canAct(): boolean {
		return this.phase === "playerTurn" || this.phase === "dealerTurn";
	}

	protected actor(): PokerActor {
		return this.phase === "playerTurn" ? "player" : "dealer";
	}

	protected other(actor: PokerActor): PokerActor {
		return actor === "player" ? "dealer" : "player";
	}

	protected nameFor(actor: PokerActor): string {
		return actor === "player" ? "You" : "The dealer";
	}

	protected stackOf(actor: PokerActor): number {
		return actor === "player" ? this.bank.getBalance() : this.dealerStack;
	}

	protected streetOf(actor: PokerActor): number {
		return actor === "player" ? this.playerStreet : this.dealerStreet;
	}

	protected setActed(actor: PokerActor, value: boolean): void {
		if (actor === "player") this.playerActed = value;
		else this.dealerActed = value;
	}

	/**
	 * Moves chips from a seat into the pot. Returns false (and leaves the state
	 * untouched) when the seat cannot cover the amount, so a failed withdrawal
	 * can never silently create chips out of nothing.
	 */
	protected commit(actor: PokerActor, amount: number): boolean {
		if (amount <= 0) return true;
		if (actor === "player") {
			if (!this.bank.withdraw(amount)) return false;
			this.playerStreet += amount;
			this.playerTotal += amount;
		} else {
			if (this.dealerStack < amount) return false;
			this.dealerStack -= amount;
			this.dealerStreet += amount;
			this.dealerTotal += amount;
		}
		return true;
	}

	protected draw(): Card {
		if (this.deck.length === 0) this.deck = shuffle(createDeck(), this.rng);
		return this.deck.shift() as Card;
	}

	protected endAction(): void {
		if (!this.canAct()) return;
		if (this.bettingRoundComplete()) {
			this.advanceStreet();
			return;
		}
		if (this.phase === "playerTurn") {
			this.phase = "dealerTurn";
			this.runDealer();
		} else {
			this.phase = "playerTurn";
			this.message = this.turnMessage();
		}
	}

	protected bettingRoundComplete(): boolean {
		return (
			this.playerActed &&
			this.dealerActed &&
			this.playerStreet === this.dealerStreet
		);
	}

	protected turnMessage(): string {
		const callAmount = this.currentBet - this.playerStreet;
		if (callAmount > 0) return `Your move. Call $${callAmount} or raise.`;
		return "Your move. Check or bet.";
	}
}
