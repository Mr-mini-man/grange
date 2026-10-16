import type { FarmTileState } from "./farm";

/** A registered account as sent over the wire (no password hash). */
export interface Player {
	name: string;
}

/** One tile of a farm's field, as sent by the server. */
export interface FarmTile {
	x: number;
	y: number;
	state: FarmTileState;
}

/** The full field and barn inventory for one farm. */
export interface ActiveFarm {
	owner: string;
	tiles: FarmTile[];
	tomatoes: number;
	fences: Array<{ x: number; y: number }>;
	fence_count: number;
	prop_overrides: Array<{ index: number; asset: string; x: number; y: number; carried: boolean }>;
	prop_inventory: Record<string, number>;
}

export type FarmPropAction =
	| { kind: "dig"; index: number }
	| { kind: "place"; asset: string; x: number; y: number };

/** A lightweight view of a farm for lobby listings. */
export interface FarmSummary {
	owner: string;
	tiles: number;
	planted: number;
	watered: number;
	ready: number;
	tomatoes: number;
}

/** A player's request to act on a tile of their own farm. */
export type FarmAction = {
	kind: "till" | "plant" | "water" | "harvest" | "place_fence" | "remove_fence";
	x: number;
	y: number;
};

export interface ServerState {
	players: Player[];
	farms: FarmSummary[];
}
