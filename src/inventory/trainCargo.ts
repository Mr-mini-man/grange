import type { TrainCart } from "../../shared/types";
import type { ItemId } from "./items";

export interface CargoEntry {
	itemId: ItemId;
	count: number;
}

/**
 * A cart's cargo as a list of filled slots, sorted by item id and capped at the
 * cart's capacity, so the window can render one cell per stack.
 */
export function cargoEntries(cart: TrainCart): CargoEntry[] {
	return Object.entries(cart.cargo)
		.filter(([, count]) => count > 0)
		.sort(([a], [b]) => a.localeCompare(b))
		.slice(0, cart.capacity)
		.map(([itemId, count]) => ({ itemId: itemId as ItemId, count }));
}
