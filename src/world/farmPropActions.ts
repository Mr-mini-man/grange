import type { Vector } from "excalibur";
import type { ActiveFarm } from "../../shared/types";
import { emitFarmPropAction } from "../socket";
import type { FarmPropLayer } from "./farmPropLayer";
import type { MovablePropKey } from "./mapData";
import type { PropPlacement } from "./propPlacement";

/** Returns true when the click was handled as a prop pickup/placement. */
export function handleFarmPropClick(item: string | null, pos: Vector,
	layer: FarmPropLayer, farm: ActiveFarm | null, owner: string,
	report: (message: string) => void): boolean {
	if (!farm) return false;
	if (item === "shovel") {
		const target = layer.pick(pos.x, pos.y);
		if (!target) return false;
		if (target.asset === "starter-train") {
			report("The train stays at the station.");
			return true;
		}
		emitFarmPropAction(owner, { kind: "dig", index: target.index }, (result) =>
			report(result.ok ? `${target.asset} moved to inventory.` :
				result.error ?? "Could not dig up object."));
		return true;
	}
	return false;
}

/** The release point is authoritative: never move the object to an unseen spot. */
export function placeFarmProp(item: MovablePropKey, placement: PropPlacement,
	farm: ActiveFarm, owner: string, report: (message: string) => void): void {
	if ((farm.prop_inventory[item] ?? 0) <= 0) {
		report(`No ${item} in inventory.`);
		return;
	}
	if (placement.reason) {
		report(placement.reason);
		return;
	}
	emitFarmPropAction(owner, { kind: "place", asset: item, x: placement.x, y: placement.y }, (result) =>
		report(result.ok ? `${item} placed.` :
			result.error ?? "Could not place object."));
}
