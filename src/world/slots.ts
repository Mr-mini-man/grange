/** Slots core: reel items, weights, bet sizes, and payout math. */

export type SlotSymbol = "cherry" | "bell" | "diamond" | "seven";

export interface SlotSymbolDef {
	/** Stable id, also the payout key. */
	id: SlotSymbol;
	label: string;
	/** Face shown on a reel. */
	glyph: string;
	/** Relative chance of landing on one reel; higher is more common. */
	weight: number;
	/** Total returned on a three-in-a-row, as a multiple of the bet. */
	multiplier: number;
}

/**
 * The four reel items. Cherries are the common symbol and sevens are the rare
 * jackpot; weights and multipliers are tuned to a ~92% return to player, and a
 * max-bet jackpot pays the advertised $10,000 (200 x $50).
 */
export const SLOT_SYMBOLS: readonly SlotSymbolDef[] = [
	{ id: "cherry", label: "Cherry", glyph: "🍒", weight: 50, multiplier: 3 },
	{ id: "bell", label: "Bell", glyph: "🔔", weight: 30, multiplier: 12 },
	{ id: "diamond", label: "Diamond", glyph: "💎", weight: 16, multiplier: 50 },
	{ id: "seven", label: "Seven", glyph: "7️⃣", weight: 4, multiplier: 200 },
];

/** The spin sizes the machine accepts. */
export const SLOT_BETS = [1, 5, 10, 15, 20, 50] as const;

export const MIN_BET = SLOT_BETS[0];
export const MAX_BET = SLOT_BETS[SLOT_BETS.length - 1];

/** Reels per spin. Three matching faces is the only win. */
export const REEL_COUNT = 3;

const SYMBOL_BY_ID = new Map<SlotSymbol, SlotSymbolDef>(
	SLOT_SYMBOLS.map((symbol) => [symbol.id, symbol]),
);
const TOTAL_WEIGHT = SLOT_SYMBOLS.reduce(
	(sum, symbol) => sum + symbol.weight,
	0,
);

export function symbolDef(id: SlotSymbol): SlotSymbolDef {
	const found = SYMBOL_BY_ID.get(id);
	if (!found) throw new Error(`unknown slot symbol: ${id}`);
	return found;
}

export function isSlotBet(amount: number): boolean {
	return (SLOT_BETS as readonly number[]).includes(amount);
}

/** Picks one reel face by weight. `rng` is injectable so tests stay stable. */
export function spinReel(rng: () => number = Math.random): SlotSymbol {
	let roll = rng() * TOTAL_WEIGHT;
	for (const symbol of SLOT_SYMBOLS) {
		roll -= symbol.weight;
		if (roll < 0) return symbol.id;
	}
	return SLOT_SYMBOLS[SLOT_SYMBOLS.length - 1].id;
}

/** Spins every reel once. */
export function spinReels(rng: () => number = Math.random): SlotSymbol[] {
	return Array.from({ length: REEL_COUNT }, () => spinReel(rng));
}

/** The shared symbol when all reels match, otherwise null. */
export function winningSymbol(
	reels: readonly SlotSymbol[],
): SlotSymbol | null {
	if (reels.length !== REEL_COUNT) return null;
	const [first] = reels;
	return reels.every((id) => id === first) ? first : null;
}

/** Total money returned on a win: the stake times the symbol's multiplier. */
export function payoutFor(symbol: SlotSymbol, bet: number): number {
	return bet * symbolDef(symbol).multiplier;
}

/** The largest single payout the machine can produce: a seven at max bet. */
export function maxWin(): number {
	return MAX_BET * symbolDef("seven").multiplier;
}

/** Long-run return per dollar staked, given the reel weights. */
export function expectedReturn(): number {
	return SLOT_SYMBOLS.reduce((sum, symbol) => {
		const chance = (symbol.weight / TOTAL_WEIGHT) ** REEL_COUNT;
		return sum + chance * symbol.multiplier;
	}, 0);
}
