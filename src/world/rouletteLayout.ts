import {
	BLACK_NUMBERS,
	type BetKind,
	PAYOUTS,
	type PocketId,
	RED_NUMBERS,
	STRAIGHT_NUMBERS,
	type StraightNumber,
} from "./roulette";
import type { BetSpot } from "./rouletteTypes";

/** Felt geometry. The SVG viewBox is `0 0 FELT_WIDTH FELT_HEIGHT`. */
const CELL = 100;
const GRID_LEFT = 130;
const GRID_TOP = 30;
const COLS = 12;
const ROWS = 3;
const GREEN_X = GRID_LEFT - CELL;
const OUTER_TOP = GRID_TOP - 24;

export const FELT_WIDTH = 1440;
export const FELT_HEIGHT = 480;

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

function numberAt(col: number, row: number): StraightNumber {
	return String(3 - row + col * 3) as StraightNumber;
}

function cellRect(col: number, row: number): Rect {
	return {
		x: GRID_LEFT + col * CELL,
		y: GRID_TOP + row * CELL,
		w: CELL,
		h: CELL,
	};
}

function sortedLabel(numbers: readonly PocketId[]): string {
	return [...numbers].sort((a, b) => Number(a) - Number(b)).join("-");
}

function buildSpots(): BetSpot[] {
	const spots: BetSpot[] = [];
	const add = (
		id: string,
		label: string,
		kind: BetKind,
		numbers: PocketId[],
		rect: Rect,
	) => {
		spots.push({ id, label, kind, numbers, payout: PAYOUTS[kind], ...rect });
	};

	// Straight-up numbers: the 0/00 column, then the 12x3 grid.
	add("n:0", "0", "straight", ["0"], {
		x: GREEN_X,
		y: GRID_TOP,
		w: CELL,
		h: CELL * 1.5,
	});
	add("n:00", "00", "straight", ["00"], {
		x: GREEN_X,
		y: GRID_TOP + CELL * 1.5,
		w: CELL,
		h: CELL * 1.5,
	});
	for (let col = 0; col < COLS; col += 1) {
		for (let row = 0; row < ROWS; row += 1) {
			const number = numberAt(col, row);
			add(`n:${number}`, number, "straight", [number], cellRect(col, row));
		}
	}

	// Horizontal splits (two numbers side by side in a row).
	for (let col = 0; col < COLS - 1; col += 1) {
		for (let row = 0; row < ROWS; row += 1) {
			const numbers = [numberAt(col, row), numberAt(col + 1, row)];
			add(`split-h:${col}:${row}`, sortedLabel(numbers), "split", numbers, {
				x: GRID_LEFT + (col + 1) * CELL - 12,
				y: GRID_TOP + row * CELL + 20,
				w: 24,
				h: 60,
			});
		}
	}

	// Vertical splits (two numbers stacked in a column).
	for (let col = 0; col < COLS; col += 1) {
		for (let row = 0; row < ROWS - 1; row += 1) {
			const numbers = [numberAt(col, row), numberAt(col, row + 1)];
			add(`split-v:${col}:${row}`, sortedLabel(numbers), "split", numbers, {
				x: GRID_LEFT + col * CELL + 20,
				y: GRID_TOP + (row + 1) * CELL - 12,
				w: 60,
				h: 24,
			});
		}
	}

	// Splits against the green column and between the two zeros.
	add("split-g:0:3", "0-3", "split", ["0", "3"], {
		x: GRID_LEFT - 12,
		y: GRID_TOP + 50,
		w: 24,
		h: 60,
	});
	add("split-g:0:2", "0-2", "split", ["0", "2"], {
		x: GRID_LEFT - 12,
		y: GRID_TOP + 125,
		w: 24,
		h: 60,
	});
	add("split-g:00:2", "00-2", "split", ["00", "2"], {
		x: GRID_LEFT - 12,
		y: GRID_TOP + 175,
		w: 24,
		h: 60,
	});
	add("split-g:00:1", "00-1", "split", ["00", "1"], {
		x: GRID_LEFT - 12,
		y: GRID_TOP + 250,
		w: 24,
		h: 60,
	});
	add("split-g:0:00", "0-00", "split", ["0", "00"], {
		x: GREEN_X + 20,
		y: GRID_TOP + CELL * 1.5 - 12,
		w: 60,
		h: 24,
	});

	// Streets (three numbers in a column), on the outer edge.
	for (let col = 0; col < COLS; col += 1) {
		const numbers = [numberAt(col, 0), numberAt(col, 1), numberAt(col, 2)];
		add(`street:${col}`, sortedLabel(numbers), "street", numbers, {
			x: GRID_LEFT + col * CELL + 12,
			y: OUTER_TOP,
			w: CELL - 24,
			h: 20,
		});
	}

	// Six-line bets (two adjacent streets), on the outer edge.
	for (let col = 0; col < COLS - 1; col += 1) {
		const numbers = [
			numberAt(col, 0),
			numberAt(col, 1),
			numberAt(col, 2),
			numberAt(col + 1, 0),
			numberAt(col + 1, 1),
			numberAt(col + 1, 2),
		];
		add(`line:${col}`, sortedLabel(numbers), "line", numbers, {
			x: GRID_LEFT + (col + 1) * CELL - 12,
			y: OUTER_TOP,
			w: 24,
			h: 20,
		});
	}

	// Corners (four numbers meeting at an intersection).
	for (let col = 0; col < COLS - 1; col += 1) {
		for (let row = 0; row < ROWS - 1; row += 1) {
			const numbers = [
				numberAt(col, row),
				numberAt(col + 1, row),
				numberAt(col, row + 1),
				numberAt(col + 1, row + 1),
			];
			add(`corner:${col}:${row}`, sortedLabel(numbers), "corner", numbers, {
				x: GRID_LEFT + (col + 1) * CELL - 12,
				y: GRID_TOP + (row + 1) * CELL - 12,
				w: 24,
				h: 24,
			});
		}
	}

	// Five-number basket: 0, 00, 1, 2, 3 (American wheel only).
	add("five:0", "0/00/1/2/3", "five-number", ["0", "00", "1", "2", "3"], {
		x: GREEN_X + 10,
		y: OUTER_TOP,
		w: CELL - 20,
		h: 20,
	});

	// Column bets (12 numbers in a row), to the right of the grid.
	for (let row = 0; row < ROWS; row += 1) {
		const numbers: PocketId[] = [];
		for (let col = 0; col < COLS; col += 1) {
			numbers.push(numberAt(col, row));
		}
		add(`column:${row}`, "2:1", "column", numbers, {
			x: GRID_LEFT + COLS * CELL,
			y: GRID_TOP + row * CELL,
			w: CELL,
			h: CELL,
		});
	}

	// Dozens.
	const dozenLabels = ["1st 12", "2nd 12", "3rd 12"];
	for (let dozen = 0; dozen < 3; dozen += 1) {
		const numbers = STRAIGHT_NUMBERS.slice(dozen * 12, dozen * 12 + 12);
		add(`dozen:${dozen}`, dozenLabels[dozen], "dozen", [...numbers], {
			x: GRID_LEFT + dozen * 4 * CELL,
			y: GRID_TOP + ROWS * CELL,
			w: 4 * CELL,
			h: 70,
		});
	}

	// Even-money outside bets.
	const outside: Array<{
		id: string;
		label: string;
		kind: BetKind;
		numbers: PocketId[];
	}> = [
		{
			id: "low",
			label: "1-18",
			kind: "low",
			numbers: STRAIGHT_NUMBERS.slice(0, 18),
		},
		{
			id: "even",
			label: "EVEN",
			kind: "even",
			numbers: STRAIGHT_NUMBERS.filter((n) => Number(n) % 2 === 0),
		},
		{ id: "red", label: "RED", kind: "red", numbers: [...RED_NUMBERS] },
		{ id: "black", label: "BLACK", kind: "black", numbers: [...BLACK_NUMBERS] },
		{
			id: "odd",
			label: "ODD",
			kind: "odd",
			numbers: STRAIGHT_NUMBERS.filter((n) => Number(n) % 2 === 1),
		},
		{
			id: "high",
			label: "19-36",
			kind: "high",
			numbers: STRAIGHT_NUMBERS.slice(18),
		},
	];
	for (let i = 0; i < outside.length; i += 1) {
		const bet = outside[i];
		add(`outside:${bet.id}`, bet.label, bet.kind, bet.numbers, {
			x: GRID_LEFT + i * 2 * CELL,
			y: GRID_TOP + ROWS * CELL + 70,
			w: 2 * CELL,
			h: 70,
		});
	}

	return spots;
}

export const BET_SPOTS: BetSpot[] = buildSpots();

export const BET_SPOT_BY_ID: Map<string, BetSpot> = new Map(
	BET_SPOTS.map((spot) => [spot.id, spot]),
);
