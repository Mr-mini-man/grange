import type { TrainCart, TrainView } from "./types";

/**
 * The shared train rules.
 *
 * These constants are mirrored on the server in `Grange.FarmTrain` (and the
 * depot prices in `Grange.TrainDepot`). Keep the two sides in sync: the browser
 * only renders what the server enforces, but the market disables a purchase
 * from the same numbers it shows.
 */

/** Engine tiers are 0..3; the starter train ships at tier 0. */
export const TRAIN_MAX_ENGINE = 3;
/** Cart tiers are 1..3. */
export const TRAIN_MAX_CART_TIER = 3;
/** One cart stack holds this many of a single item. */
export const TRAIN_STACK_LIMIT = 99;

/** Distinct item stacks a cart can hold, by tier (2, 3, 4 slots). */
export const TRAIN_CART_CAPACITY: Record<number, number> = { 1: 2, 2: 3, 3: 4 };

/** How many carts an engine tier can pull (a bigger engine pulls more). */
export const TRAIN_ENGINE_CARTS: Record<number, number> = {
	0: 1,
	1: 2,
	2: 3,
	3: 4,
};

/** How the engine tier scales the departure/arrival animation (lower = faster). */
const TRAIN_SPEED_FACTOR = [1, 0.85, 0.7, 0.55];

export function clampEngine(engine: number): number {
	if (!Number.isFinite(engine)) return 0;
	return Math.min(Math.max(0, Math.floor(engine)), TRAIN_MAX_ENGINE);
}

export function clampTier(tier: number): number {
	if (!Number.isFinite(tier)) return 1;
	return Math.min(Math.max(1, Math.floor(tier)), TRAIN_MAX_CART_TIER);
}

export function cartCapacity(tier: number): number {
	return TRAIN_CART_CAPACITY[clampTier(tier)] ?? TRAIN_CART_CAPACITY[1];
}

export function maxCartsForEngine(engine: number): number {
	return TRAIN_ENGINE_CARTS[clampEngine(engine)] ?? 1;
}

export function trainSpeedFactor(engine: number): number {
	return TRAIN_SPEED_FACTOR[clampEngine(engine)] ?? 1;
}

/** The train-depot item ids, in the order the depot lists them. */
export type TrainUpgradeId =
	| "train-engine"
	| "train-cart"
	| "train-cart-upgrade";

export const TRAIN_UPGRADE_IDS: readonly TrainUpgradeId[] = [
	"train-engine",
	"train-cart",
	"train-cart-upgrade",
];

/** Grangecoin cost of each depot upgrade (flat per purchase). */
export const TRAIN_UPGRADE_PRICES: Record<TrainUpgradeId, number> = {
	"train-engine": 400,
	"train-cart": 300,
	"train-cart-upgrade": 250,
};

export function isTrainUpgradeId(value: string): value is TrainUpgradeId {
	return (TRAIN_UPGRADE_IDS as readonly string[]).includes(value);
}

/** How many more of `item` a cart can take (0 when the cart is full for it). */
export function cargoRoom(cart: TrainCart, item: string): number {
	const have = cart.cargo[item] ?? 0;
	if (have > 0) return Math.max(0, TRAIN_STACK_LIMIT - have);
	const distinct = Object.values(cart.cargo).filter(
		(count) => count > 0,
	).length;
	return distinct < cart.capacity ? TRAIN_STACK_LIMIT : 0;
}

/**
 * The first cart that can accept `item`, with the room it has, or null when
 * every cart is full. The server picks the same cart so a deposit lands where
 * the browser predicted.
 */
export function depositTarget(
	carts: readonly TrainCart[],
	item: string,
): { cart: TrainCart; room: number } | null {
	for (const cart of carts) {
		const room = cargoRoom(cart, item);
		if (room > 0) return { cart, room };
	}
	return null;
}

/** Total cargo slots the train currently has (summed across carts). */
export function totalCargoSlots(train: TrainView | undefined): number {
	if (!train) return 0;
	return train.carts.reduce((sum, cart) => sum + cart.capacity, 0);
}
