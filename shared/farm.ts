export const FARM_GRID_SIZE = 15;
export const FARM_GROW_MS = 10_000;
export const FARM_HARVEST_YIELD = 3;

export type FarmTileState = "tilled" | "planted" | "watered" | "ready";

export type FarmToolId = "hoe" | "seed" | "bucket" | "scythe";

/** Every crop a player can grow. Crops are the raw input to the brewery. */
export type CropId = "tomato" | "wheat" | "potato" | "barley";

export type SeedKey = `${CropId}Seed`;

export interface CropInfo {
	name: string;
	seedKey: SeedKey;
	/** Base time from watering to harvest, before growth effects. */
	growMs: number;
	/** Units produced by a single harvest. */
	yield: number;
	/** Grangecoins charged by the market for one seed. */
	seedPrice: number;
	/** Grangecoins the bar pays for one harvested crop. */
	cropPrice: number;
}

export const CROPS: Record<CropId, CropInfo> = {
	tomato: {
		name: "Tomato",
		seedKey: "tomatoSeed",
		growMs: FARM_GROW_MS,
		yield: FARM_HARVEST_YIELD,
		seedPrice: 2,
		cropPrice: 1,
	},
	wheat: {
		name: "Wheat",
		seedKey: "wheatSeed",
		growMs: 12_000,
		yield: 4,
		seedPrice: 2,
		cropPrice: 1,
	},
	potato: {
		name: "Potato",
		seedKey: "potatoSeed",
		growMs: 15_000,
		yield: 3,
		seedPrice: 3,
		cropPrice: 2,
	},
	barley: {
		name: "Barley",
		seedKey: "barleySeed",
		growMs: 18_000,
		yield: 3,
		seedPrice: 3,
		cropPrice: 2,
	},
};

export const CROP_IDS = Object.keys(CROPS) as CropId[];

/** Resources bought from the main land to build and run the brewery. */
export type MaterialId = "wood" | "stone";

/** Potions brewed from crops; each grants a timed player effect. */
export type PotionId = "greenThumb" | "swiftSip" | "luckyDraught";

export type EffectKind = "growth" | "speed" | "luck";

export interface ActiveEffect {
	kind: EffectKind;
	/** Unix ms at which the effect lapses. */
	expiresAt: number;
}

export interface FarmTile {
	x: number;
	y: number;
	state: FarmTileState;
	cropId: CropId;
	plantedAt?: number;
	wateredAt?: number;
	readyAt?: number;
}

export interface FarmInventory {
	coins: number;
	wood: number;
	stone: number;
	tomatoSeed: number;
	tomato: number;
	wheatSeed: number;
	wheat: number;
	potatoSeed: number;
	potato: number;
	barleySeed: number;
	barley: number;
	potions: Record<PotionId, number>;
}

/** A snapshot of one player's farm, brewery, and purse for the client. */
export interface FarmView {
	tiles: FarmTile[];
	inventory: FarmInventory;
	brewery: {
		built: boolean;
		effects: ActiveEffect[];
	};
	now: number;
}

export interface FarmReadyTile {
	player: string;
	x: number;
	y: number;
}

export function isFarmInBounds(
	x: number,
	y: number,
	size: number = FARM_GRID_SIZE,
): boolean {
	return (
		Number.isInteger(x) &&
		Number.isInteger(y) &&
		x >= 0 &&
		y >= 0 &&
		x < size &&
		y < size
	);
}

export function farmTileKey(x: number, y: number): string {
	return `${x},${y}`;
}
