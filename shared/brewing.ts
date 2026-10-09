import {
	CROPS,
	type ActiveEffect,
	type CropId,
	type EffectKind,
	type FarmInventory,
	type MaterialId,
	type PotionId,
} from "./farm";

/** Effect tuning: how long a potion lasts and how much it helps. */
export const EFFECT_DURATION_MS = 60_000;
export const GROWTH_MULTIPLIER = 0.5;
export const SPEED_MULTIPLIER = 1.6;
export const LUCK_BONUS_YIELD = 2;

export interface PotionInfo {
	name: string;
	/** Crops consumed from the inventory to brew one potion. */
	recipe: Partial<Record<CropId, number>>;
	effect: EffectKind;
	durationMs: number;
	/** Grangecoins the bar pays for one potion. */
	barPrice: number;
}

export const POTIONS: Record<PotionId, PotionInfo> = {
	greenThumb: {
		name: "Green Thumb",
		recipe: { wheat: 2, potato: 1 },
		effect: "growth",
		durationMs: EFFECT_DURATION_MS,
		barPrice: 12,
	},
	swiftSip: {
		name: "Swift Sip",
		recipe: { barley: 2, tomato: 1 },
		effect: "speed",
		durationMs: 45_000,
		barPrice: 10,
	},
	luckyDraught: {
		name: "Lucky Draught",
		recipe: { wheat: 1, potato: 2, barley: 1 },
		effect: "luck",
		durationMs: EFFECT_DURATION_MS,
		barPrice: 20,
	},
};

export const POTION_IDS = Object.keys(POTIONS) as PotionId[];

/** The one-time cost to build a brewery on a farm. */
export const BREWERY_COST: { wood: number; stone: number; coins: number } = {
	wood: 10,
	stone: 8,
	coins: 25,
};

/** Materials sold by the main-land market. */
export const MATERIALS: Record<MaterialId, { name: string; price: number }> = {
	wood: { name: "Wood", price: 3 },
	stone: { name: "Stone", price: 4 },
};

export function activeEffect(
	effects: ActiveEffect[],
	kind: EffectKind,
	now: number,
): ActiveEffect | undefined {
	return effects.find((e) => e.kind === kind && e.expiresAt > now);
}

export function pruneEffects(
	effects: ActiveEffect[],
	now: number,
): ActiveEffect[] {
	return effects.filter((e) => e.expiresAt > now);
}

export function hasIngredient(
	inventory: FarmInventory,
	cropId: CropId,
	count: number,
): boolean {
	return inventory[cropId] >= count;
}

export function canBrew(inventory: FarmInventory, potionId: PotionId): boolean {
	return Object.entries(POTIONS[potionId].recipe).every(([crop, count]) =>
		hasIngredient(inventory, crop as CropId, count ?? 0),
	);
}

export function canBuildBrewery(inventory: FarmInventory): boolean {
	return (
		inventory.wood >= BREWERY_COST.wood &&
		inventory.stone >= BREWERY_COST.stone &&
		inventory.coins >= BREWERY_COST.coins
	);
}

/** Growth time for a crop after applying any active Green Thumb effect. */
export function growthMsFor(
	cropId: CropId,
	effects: ActiveEffect[],
	now: number,
): number {
	const base = CROPS[cropId].growMs;
	return activeEffect(effects, "growth", now)
		? Math.round(base * GROWTH_MULTIPLIER)
		: base;
}

/** Harvest yield for a crop after applying any active Lucky Draught effect. */
export function harvestYieldFor(
	cropId: CropId,
	effects: ActiveEffect[],
	now: number,
): number {
	const base = CROPS[cropId].yield;
	return activeEffect(effects, "luck", now) ? base + LUCK_BONUS_YIELD : base;
}


/** Movement multiplier the client applies to the farmer while Swift Sip runs. */
export function moveSpeedMultiplier(
	effects: ActiveEffect[],
	now: number,
): number {
	return activeEffect(effects, "speed", now) ? SPEED_MULTIPLIER : 1;
}
