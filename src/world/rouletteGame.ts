import {
	MIN_BET,
	type PocketId,
	payoutFor,
	pocketColor,
	spinPocket,
} from "./roulette";
import type {
	Bank,
	BetSpot,
	PlacedBet,
	RouletteOptions,
	RoulettePhase,
	RouletteSnapshot,
} from "./rouletteTypes";

/**
 * American roulette. Bets are free to place and remove while betting; the full
 * stake is withdrawn from the bank only when the wheel is spun. The bank is
 * injected so tests can run without the real economy.
 */
export class RouletteTable {
	private readonly bank: Bank;
	private readonly rng: () => number;
	private phase: RoulettePhase = "betting";
	private bets = new Map<string, PlacedBet>();
	private result: PocketId | null = null;
	private net = 0;
	private message = "Place your bets.";

	constructor(bank: Bank, options: RouletteOptions = {}) {
		this.bank = bank;
		this.rng = options.rng ?? Math.random;
	}

	/** Chips still available to bet: balance minus what is on the table. */
	available(): number {
		const committed = this.phase === "betting" ? this.totalStaked() : 0;
		return this.bank.getBalance() - committed;
	}

	totalStaked(): number {
		let total = 0;
		for (const bet of this.bets.values()) total += bet.amount;
		return total;
	}

	placeBet(spot: BetSpot, amount: number): boolean {
		if (this.phase !== "betting") return false;
		if (!Number.isFinite(amount)) {
			this.message = "Enter a bet.";
			return false;
		}
		const wager = Math.floor(amount);
		if (wager < MIN_BET) {
			this.message = `Minimum bet is ${MIN_BET}.`;
			return false;
		}
		if (wager > this.available()) {
			this.message = "Not enough Grangecoin.";
			return false;
		}
		const existing = this.bets.get(spot.id);
		if (existing) {
			existing.amount += wager;
		} else {
			this.bets.set(spot.id, {
				spotId: spot.id,
				label: spot.label,
				kind: spot.kind,
				numbers: spot.numbers.slice(),
				amount: wager,
				payout: spot.payout,
				won: null,
				returned: 0,
			});
		}
		this.message = `$${wager} on ${spot.label}.`;
		return true;
	}

	removeBet(spotId: string): boolean {
		if (this.phase !== "betting") return false;
		const bet = this.bets.get(spotId);
		if (!bet) return false;
		this.bets.delete(spotId);
		this.message = `Removed $${bet.amount} from ${bet.label}.`;
		return true;
	}

	spin(): boolean {
		if (this.phase !== "betting") return false;
		if (this.bets.size === 0) {
			this.message = "Place a bet before spinning.";
			return false;
		}
		const total = this.totalStaked();
		if (!this.bank.withdraw(total)) {
			this.message = "Not enough Grangecoin.";
			return false;
		}
		this.result = spinPocket(this.rng);
		this.phase = "spinning";
		this.message = "Spinning…";
		return true;
	}

	/** Resolves the round. Called once the wheel animation has finished. */
	settle(): RouletteSnapshot {
		if (this.phase !== "spinning" || this.result === null) {
			return this.snapshot();
		}
		const result = this.result;
		let returned = 0;
		for (const bet of this.bets.values()) {
			const won = bet.numbers.includes(result);
			bet.won = won;
			bet.returned = won ? payoutFor(bet.amount, bet.kind) : 0;
			if (won) {
				this.bank.deposit(bet.returned);
				returned += bet.returned;
			}
		}
		this.net = returned - this.totalStaked();
		this.phase = "settled";
		this.message = this.resultMessage(result);
		return this.snapshot();
	}

	newRound(): void {
		if (this.phase !== "settled") return;
		this.phase = "betting";
		this.bets.clear();
		this.result = null;
		this.net = 0;
		this.message = "Place your bets.";
	}

	snapshot(): RouletteSnapshot {
		return {
			phase: this.phase,
			balance: this.bank.getBalance(),
			available: this.available(),
			bets: [...this.bets.values()].map((bet) => ({
				...bet,
				numbers: bet.numbers.slice(),
			})),
			totalStaked: this.totalStaked(),
			result: this.result,
			net: this.net,
			message: this.message,
		};
	}

	private resultMessage(result: PocketId): string {
		const color = pocketColor(result);
		if (this.net > 0) return `${result} ${color} — you won $${this.net}.`;
		if (this.net < 0) return `${result} ${color} — you lost $${-this.net}.`;
		return `${result} ${color} — you broke even.`;
	}
}
