/** Roulette core: pockets, colors, bet types, and payout math. */

/** Smallest allowed wager on a single spot. */
export const MIN_BET = 5;

export const STRAIGHT_NUMBERS = [
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"11",
	"12",
	"13",
	"14",
	"15",
	"16",
	"17",
	"18",
	"19",
	"20",
	"21",
	"22",
	"23",
	"24",
	"25",
	"26",
	"27",
	"28",
	"29",
	"30",
	"31",
	"32",
	"33",
	"34",
	"35",
	"36",
] as const;

export type StraightNumber = (typeof STRAIGHT_NUMBERS)[number];
export type PocketId = "0" | "00" | StraightNumber;
export type PocketColor = "red" | "black" | "green";

export const RED_NUMBERS: readonly StraightNumber[] = [
	"1",
	"3",
	"5",
	"7",
	"9",
	"12",
	"14",
	"16",
	"18",
	"19",
	"21",
	"23",
	"25",
	"27",
	"30",
	"32",
	"34",
	"36",
];

const RED_SET: ReadonlySet<string> = new Set(RED_NUMBERS);

export const BLACK_NUMBERS: readonly StraightNumber[] = STRAIGHT_NUMBERS.filter(
	(number) => !RED_SET.has(number),
);

export function pocketColor(id: PocketId): PocketColor {
	if (id === "0" || id === "00") return "green";
	return RED_SET.has(id) ? "red" : "black";
}

/** Standard American wheel order, clockwise from the single zero. */
export const WHEEL_ORDER: readonly PocketId[] = [
	"0",
	"28",
	"9",
	"26",
	"30",
	"11",
	"7",
	"20",
	"32",
	"17",
	"5",
	"22",
	"34",
	"15",
	"3",
	"24",
	"36",
	"13",
	"1",
	"00",
	"27",
	"10",
	"25",
	"29",
	"12",
	"8",
	"19",
	"31",
	"18",
	"6",
	"21",
	"33",
	"16",
	"4",
	"23",
	"35",
	"14",
	"2",
];

/** Picks a winning pocket. `rng` is injectable so tests stay deterministic. */
export function spinPocket(rng: () => number = Math.random): PocketId {
	const index = Math.floor(rng() * WHEEL_ORDER.length);
	const clamped = Math.min(Math.max(index, 0), WHEEL_ORDER.length - 1);
	return WHEEL_ORDER[clamped];
}

export type BetKind =
	| "straight"
	| "split"
	| "street"
	| "corner"
	| "five-number"
	| "line"
	| "column"
	| "dozen"
	| "red"
	| "black"
	| "odd"
	| "even"
	| "low"
	| "high";

/** Winnings-to-stake odds for each bet, e.g. 35 means "35 to 1". */
export const PAYOUTS: Record<BetKind, number> = {
	straight: 35,
	split: 17,
	street: 11,
	corner: 8,
	"five-number": 6,
	line: 5,
	column: 2,
	dozen: 2,
	red: 1,
	black: 1,
	odd: 1,
	even: 1,
	low: 1,
	high: 1,
};

/**
 * Total chips returned to the player when a bet wins. The `to-1` odds mean a
 * win pays the stake back plus `multiplier` times the stake, so a 1:1 bet of
 * 10 returns 20 and a 35:1 bet of 10 returns 360.
 */
export function returnOnWin(stake: number, multiplier: number): number {
	return Math.floor(stake * (multiplier + 1));
}

export function payoutFor(stake: number, kind: BetKind): number {
	return returnOnWin(stake, PAYOUTS[kind]);
}
