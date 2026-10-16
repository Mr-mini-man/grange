import type { RenderedProp } from "./sceneRendering";

export type CasinoAssetKey =
	| "wood-light"
	| "wood-dark"
	| "rug-square"
	| "rug-horizontal"
	| "rug-vertical"
	| "rug-corner"
	| "wall-panel"
	| "wall-post"
	| "wall-corner-left"
	| "wall-corner"
	| "doorway"
	| "railing"
	| "poker-table"
	| "blackjack-table"
	| "roulette-table"
	| "slot-machine"
	| "cashier-desk"
	| "chair-front-left"
	| "chair-left"
	| "chair-front-right"
	| "chair-right"
	| "stool"
	| "chips"
	| "cards"
	| "lamp"
	| "plant"
	| "sign";

export const CASINO_PLAYER_SPAWN = { x: 576, y: 220 } as const;
export const CASINO_EXIT = { x: 576, y: 175 } as const;
export const CASINO_BLACKJACK_TABLE = { x: 576, y: 430 } as const;
export const CASINO_POKER_TABLE = { x: 205, y: 430 } as const;
export const CASINO_ROULETTE_TABLE = { x: 947, y: 430 } as const;

export const casinoProps: RenderedProp<CasinoAssetKey>[] = [
	{ asset: "wall-panel", x: 165, y: 165, width: 300 },
	{ asset: "doorway", x: 576, y: 170, width: 250 },
	{ asset: "wall-panel", x: 987, y: 165, width: 300 },
	{ asset: "wall-post", x: 34, y: 185, width: 55 },
	{ asset: "wall-post", x: 1118, y: 185, width: 55 },

	{ asset: "poker-table", x: CASINO_POKER_TABLE.x, y: CASINO_POKER_TABLE.y, width: 250 },
	{ asset: "blackjack-table", x: CASINO_BLACKJACK_TABLE.x, y: CASINO_BLACKJACK_TABLE.y, width: 265 },
	{ asset: "roulette-table", x: CASINO_ROULETTE_TABLE.x, y: CASINO_ROULETTE_TABLE.y, width: 260 },
	{ asset: "chair-front-left", x: 205, y: 535, width: 70 },
	{ asset: "chair-front-right", x: 576, y: 535, width: 72 },
	{ asset: "chair-front-right", x: 947, y: 535, width: 72 },

	{ asset: "slot-machine", x: 135, y: 700, width: 86 },
	{ asset: "slot-machine", x: 235, y: 700, width: 86 },
	{ asset: "slot-machine", x: 335, y: 700, width: 86 },
	{ asset: "stool", x: 135, y: 750, width: 55 },
	{ asset: "stool", x: 235, y: 750, width: 55 },
	{ asset: "stool", x: 335, y: 750, width: 55 },
	{ asset: "cashier-desk", x: 620, y: 700, width: 190 },
	{ asset: "chips", x: 480, y: 680, width: 65 },
	{ asset: "cards", x: 755, y: 675, width: 75 },
	{ asset: "lamp", x: 875, y: 700, width: 65 },
	{ asset: "plant", x: 1040, y: 710, width: 100 },
	{ asset: "sign", x: 1040, y: 555, width: 70 },
];
