import { CATEGORY_LABEL, bestHand, compareScores, rankValue } from "./pokerHand";
import { CATEGORY_STRENGTH, type DealerContext } from "./pokerStrategy";
import { PokerTableBase } from "./pokerTableBase";
import type { PokerSnapshot } from "./pokerTypes";

/**
 * Heads-up Texas Hold'em against the house. The player's chips are the
 * economy balance; the dealer is a virtual stack. The engine is a
 * deterministic, self-contained class so it can be moved server-side when the
 * game becomes multiplayer.
 */
export class PokerTable extends PokerTableBase {
	startHand(): boolean {
		if (this.phase !== "idle" && this.phase !== "settled") return false;
		if (this.bank.getBalance() < this.bigBlind) {
			this.message = "Not enough Grangecoin for the big blind.";
			return false;
		}
		// The dealer is the house; if its virtual stack can't cover the blind the
		// table would post a negative bet and corrupt every later raise. Refuse
		// the hand instead (the house is "busted" until a rebuy is added).
		if (this.dealerStack < this.bigBlind) {
			this.message = "The dealer can't cover the big blind.";
			return false;
		}
		this.deck = this.riggedDeck ? [...this.riggedDeck] : [];
		this.playerHole = [this.draw(), this.draw()];
		this.dealerHole = [this.draw(), this.draw()];
		this.community = [];
		this.playerStreet = 0;
		this.dealerStreet = 0;
		this.playerTotal = 0;
		this.dealerTotal = 0;
		this.net = 0;
		this.winner = null;
		this.playerScore = null;
		this.dealerScore = null;
		this.currentBet = this.bigBlind;
		this.minRaise = this.bigBlind;
		this.playerActed = false;
		this.dealerActed = false;
		if (
			!this.commit("player", this.smallBlind) ||
			!this.commit("dealer", this.bigBlind)
		) {
			// Unreachable while the guards above hold, but never post a blind we
			// cannot cover: bail out to a clean idle state.
			this.phase = "idle";
			this.message = "Could not post the blinds.";
			return false;
		}
		this.street = "preflop";
		this.phase = "playerTurn";
		this.message = `You posted $${this.smallBlind}. Call $${this.currentBet - this.playerStreet} to see a flop.`;
		return true;
	}

	snapshot(): PokerSnapshot {
		const playerTurn = this.phase === "playerTurn";
		const callAmount = this.currentBet - this.playerStreet;
		const maxRaiseTo = Math.min(
			this.playerStreet + this.bank.getBalance(),
			this.dealerStreet + this.dealerStack,
		);
		const minRaiseTo = Math.min(this.currentBet + this.minRaise, maxRaiseTo);
		return {
			phase: this.phase,
			street: this.street,
			balance: this.bank.getBalance(),
			dealerStack: this.dealerStack,
			pot: this.pot,
			playerHole: this.playerHole.slice(),
			dealerHole: this.dealerHole.slice(),
			dealerHidden: this.phase !== "settled",
			community: this.community.slice(),
			playerCommitted: this.playerStreet,
			dealerCommitted: this.dealerStreet,
			playerTotal: this.playerTotal,
			dealerTotal: this.dealerTotal,
			currentBet: this.currentBet,
			callAmount: playerTurn ? Math.max(0, callAmount) : 0,
			minRaiseTo,
			maxRaiseTo,
			playerBest: this.playerScore?.category ?? null,
			dealerBest: this.dealerScore?.category ?? null,
			message: this.message,
			net: this.net,
			winner: this.winner,
			canCheck: playerTurn && callAmount <= 0,
			canCall: playerTurn && callAmount > 0,
			canRaise: playerTurn && maxRaiseTo > this.currentBet,
			canFold: playerTurn,
		};
	}

	protected advanceStreet(): void {
		if (this.street === "river") {
			this.showdown();
			return;
		}
		if (this.stackOf("player") <= 0 || this.stackOf("dealer") <= 0) {
			this.runOut();
			return;
		}
		if (this.street === "preflop") {
			this.community.push(this.draw(), this.draw(), this.draw());
			this.street = "flop";
		} else if (this.street === "flop") {
			this.community.push(this.draw());
			this.street = "turn";
		} else {
			this.community.push(this.draw());
			this.street = "river";
		}
		this.playerStreet = 0;
		this.dealerStreet = 0;
		this.currentBet = 0;
		this.minRaise = this.bigBlind;
		this.playerActed = false;
		this.dealerActed = false;
		this.phase = "dealerTurn";
		this.message = `${this.street[0].toUpperCase()}${this.street.slice(1)}. The dealer acts first.`;
		this.runDealer();
	}

	protected runDealer(): void {
		if (this.phase !== "dealerTurn") return;
		const callAmount = this.currentBet - this.dealerStreet;
		const context: DealerContext = {
			callAmount,
			canCheck: callAmount <= 0,
			currentBet: this.currentBet,
			minRaiseTo: this.currentBet + this.minRaise,
			maxRaiseTo: Math.min(
				this.dealerStreet + this.dealerStack,
				this.playerStreet + this.bank.getBalance(),
			),
			pot: this.pot,
			strength: this.dealerStrength(),
			rng: this.rng,
		};
		const action = this.strategy(context);
		if (action.type === "fold") {
			this.fold();
			return;
		}
		if (action.type === "check") {
			if (!this.check()) this.call();
			return;
		}
		if (action.type === "call") {
			if (!this.call()) this.check();
			return;
		}
		if (!this.raiseTo(action.amount)) {
			if (!this.call()) this.check();
		}
	}

	private showdown(): void {
		const total = this.pot;
		this.playerScore = bestHand([...this.playerHole, ...this.community]);
		this.dealerScore = bestHand([...this.dealerHole, ...this.community]);
		const comparison = compareScores(this.playerScore, this.dealerScore);
		if (comparison > 0) {
			this.bank.deposit(total);
			this.winner = "player";
			this.net = total - this.playerTotal;
			this.message = `You win $${total} with ${CATEGORY_LABEL[this.playerScore.category]}.`;
		} else if (comparison < 0) {
			this.winner = "dealer";
			this.net = -this.playerTotal;
			this.message = `The dealer wins $${total} with ${CATEGORY_LABEL[this.dealerScore.category]}.`;
		} else {
			const share = Math.floor(total / 2);
			this.bank.deposit(share);
			this.winner = "split";
			this.net = share - this.playerTotal;
			this.message = `Split pot. $${share} returned to you.`;
		}
		this.phase = "settled";
	}

	/** No betting remains (someone is all-in); deal it out and settle. */
	private runOut(): void {
		while (this.community.length < 5) this.community.push(this.draw());
		this.street = "river";
		this.showdown();
	}

	private dealerStrength(): number {
		if (this.community.length < 3) return this.holeStrength();
		const score = bestHand([...this.dealerHole, ...this.community]);
		return CATEGORY_STRENGTH[score.category];
	}

	private holeStrength(): number {
		const values = this.dealerHole
			.map((card) => rankValue(card.rank))
			.sort((a, b) => b - a);
		const [high, low] = values;
		if (high === low) return Math.min(0.95, 0.5 + high / 30);
		const suited =
			this.dealerHole[0].suit === this.dealerHole[1].suit ? 0.04 : 0;
		let strength = (high + low) / 40;
		if (high - low === 1) strength += 0.03;
		if (high >= 13 && low >= 10) strength += 0.08;
		return Math.min(0.95, strength + suited);
	}
}
