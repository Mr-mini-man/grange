import {
	MIN_BET,
	REEL_COUNT,
	SLOT_BETS,
	type SlotSymbol,
	isSlotBet,
	payoutFor,
	spinReels,
	symbolDef,
	winningSymbol,
} from "./slots";
import type { Bank, SlotsOptions, SlotsPhase, SlotsSnapshot } from "./slotsTypes";

/**
 * A three-reel slot machine. The stake is withdrawn from the bank on spin and
 * winnings are deposited when the reels settle. The bank and rng are injected
 * so tests can run without the real economy.
 */
export class SlotMachine {
	private readonly bank: Bank;
	private readonly rng: () => number;
	private phase: SlotsPhase = "betting";
	private bet: number;
	private reels: SlotSymbol[] = [];
	private win: SlotSymbol | null = null;
	private payout = 0;
	private net = 0;
	private rigged: SlotSymbol | null = null;
	private message = "Choose a bet and spin.";

	constructor(bank: Bank, options: SlotsOptions = {}) {
		this.bank = bank;
		this.rng = options.rng ?? Math.random;
		this.bet =
			options.bet !== undefined && isSlotBet(options.bet)
				? options.bet
				: MIN_BET;
	}

	setBet(amount: number): boolean {
		if (this.phase !== "betting") return false;
		if (!isSlotBet(amount)) {
			this.message = `Bet must be one of ${SLOT_BETS.join(", ")}.`;
			return false;
		}
		this.bet = amount;
		this.message = `Bet set to $${amount}.`;
		return true;
	}

	betError(): string | null {
		if (!isSlotBet(this.bet)) return "Choose a valid bet.";
		if (this.bet > this.bank.getBalance()) return "Not enough Grangecoin.";
		return null;
	}

	/** Forces the next spin to land three of `symbol`; consumed once. */
	rigNextSpin(symbol: SlotSymbol = "seven"): void {
		this.rigged = symbol;
	}

	/** Spins the reels. `force` skips the bet checks and withdraws nothing. */
	spin(force = false): boolean {
		if (this.phase !== "betting") return false;
		if (!force) {
			const error = this.betError();
			if (error) {
				this.message = error;
				return false;
			}
			if (!this.bank.withdraw(this.bet)) {
				this.message = "Not enough Grangecoin.";
				return false;
			}
		}
		const rig = this.rigged;
		this.rigged = null;
		this.reels = rig
			? Array.from({ length: REEL_COUNT }, () => rig)
			: spinReels(this.rng);
		this.win = winningSymbol(this.reels);
		this.phase = "spinning";
		this.message = "Spinning…";
		return true;
	}

	/** Resolves the round. Called once the reel animation has finished. */
	settle(): SlotsSnapshot {
		if (this.phase !== "spinning") return this.snapshot();
		this.payout = this.win ? payoutFor(this.win, this.bet) : 0;
		if (this.payout > 0) this.bank.deposit(this.payout);
		this.net = this.payout - this.bet;
		this.phase = "settled";
		this.message = this.resultMessage();
		return this.snapshot();
	}

	newRound(): void {
		if (this.phase !== "settled") return;
		this.phase = "betting";
		this.reels = [];
		this.win = null;
		this.payout = 0;
		this.net = 0;
		this.message = "Choose a bet and spin.";
	}

	snapshot(): SlotsSnapshot {
		return {
			phase: this.phase,
			bet: this.bet,
			balance: this.bank.getBalance(),
			reels: this.reels.slice(),
			winningSymbol: this.win,
			payout: this.payout,
			net: this.net,
			message: this.message,
			betError: this.phase === "betting" ? this.betError() : null,
		};
	}

	private resultMessage(): string {
		if (!this.win) return `No match — you lost $${this.bet}.`;
		if (this.win === "seven") return `JACKPOT! Three sevens pay $${this.payout}.`;
		return `Three ${symbolDef(this.win).label}s — you won $${this.payout}.`;
	}
}
