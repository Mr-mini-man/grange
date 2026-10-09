import type { FarmView } from "../shared/farm";
import type { InMemoryBreweryStore } from "./brewing";
import type { InMemoryFarmStore } from "./farm";

/** Builds the per-player snapshot the client renders. */
export function farmView(
	farm: InMemoryFarmStore,
	brewery: InMemoryBreweryStore,
	player: string,
	now: number = Date.now(),
): FarmView {
	return {
		tiles: farm.getPlayerTiles(player),
		inventory: farm.getInventory(player),
		brewery: {
			built: brewery.isBuilt(player),
			effects: brewery.getEffects(player, now),
		},
		now,
	};
}

export function farmRoom(player: string): string {
	return `farm:${player}`;
}
