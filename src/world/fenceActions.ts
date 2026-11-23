import type { ActiveFarm } from "../../shared/types";
import { useInventoryStore } from "../inventory/inventoryStore";
import { emitFarmAction } from "../socket";
import { useGameStore } from "../store";
import type { BlockRegistry } from "./blocking";
import { fenceKey, ownsFenceCorner } from "./fenceData";
import { TILE_SIZE } from "./mapData";

export function selectedFarmItem() {
	const inventory = useInventoryStore.getState();
	return inventory.hotbar[inventory.selectedHotbar]?.itemId ?? null;
}

/** True when a post already stands on this corner or the player is on it. */
function fenceCornerOccupied(farm: ActiveFarm, column: number, row: number,
	player: { x: number; y: number }): boolean {
	const key = fenceKey(column, row);
	return (farm.fences ?? []).some(({ x, y }) => fenceKey(x, y) === key) ||
		(farm.gates ?? []).some(({ x, y }) => fenceKey(x, y) === key) ||
		Math.hypot(player.x - column * TILE_SIZE, player.y - row * TILE_SIZE) < 16;
}

export function fencePlacementReason(farm: ActiveFarm,
	column: number, row: number, _blocks: BlockRegistry,
	player: { x: number; y: number }): string | null {
	if (!ownsFenceCorner(column, row, farm.land_level ?? 0))
		return "Buy this land from the mayor first.";
	if (farm.fence_count <= 0) return "No fences left in inventory.";
	if (fenceCornerOccupied(farm, column, row, player))
		return "That fence corner is occupied.";
	return null;
}

/** A gate shares the fence corner rules but reports its own supply message. */
export function gatePlacementReason(farm: ActiveFarm,
	column: number, row: number,
	player: { x: number; y: number }): string | null {
	if (!ownsFenceCorner(column, row, farm.land_level ?? 0))
		return "Buy this land from the mayor first.";
	if (farm.gate_count <= 0) return "No gates left in inventory.";
	if (fenceCornerOccupied(farm, column, row, player))
		return "That gate corner is occupied.";
	return null;
}

export function actOnFence(owner: string, column: number, row: number,
	item: "fence" | "gate" | "shovel", blocks: BlockRegistry,
	player: { x: number; y: number }, report: (message: string) => void): void {
	const farm = useGameStore.getState().activeFarm;
	if (!farm) return;
	const fences = farm.fences ?? [];
	const gates = farm.gates ?? [];
	const fenceHere = fences.some(({ x, y }) => fenceKey(x, y) === fenceKey(column, row));
	const gateHere = gates.some(({ x, y }) => fenceKey(x, y) === fenceKey(column, row));

	if (item === "fence") {
		const reason = fencePlacementReason(farm, column, row, blocks, player);
		if (reason) { report(reason); return; }
	}
	if (item === "gate") {
		const reason = gatePlacementReason(farm, column, row, player);
		if (reason) { report(reason); return; }
	}

	if (item === "shovel" && !fenceHere && !gateHere) {
		report("No fence to dig up here.");
		return;
	}

	const kind = item === "fence"
		? "place_fence"
		: item === "gate"
			? "place_gate"
			: gateHere
				? "remove_gate"
				: "remove_fence";

	emitFarmAction(owner, { kind, x: column, y: row }, (result) => {
		if (!result.ok) {
			report(result.error ?? "Could not change fence.");
			return;
		}
		if (item === "fence") report("Fence placed.");
		else if (item === "gate") report("Gate placed.");
		else report(gateHere ? "Gate returned to inventory." : "Fence returned to inventory.");
	});
}
