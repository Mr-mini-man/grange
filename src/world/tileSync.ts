import type * as ex from "excalibur";
import type { FarmTileState } from "../../shared/farm";
import type { CropLayer } from "./cropLayer";
import type { MapProp } from "./mapData";
import { terrainAt } from "./mapData";
import { terrainFrames } from "./resources";

/** Removes tilled-over decor (flowers) on a tile. Returns the removed
 * asset keys so a future pickup feature can credit them to inventory. */
export function clearDecorAt(
	decor: Map<string, number[]>,
	propActors: Array<ex.Actor | undefined>,
	props: MapProp[],
	strokeKey: string,
): string[] {
	const indices = decor.get(strokeKey);
	if (!indices) return [];
	decor.delete(strokeKey);
	const cleared: string[] = [];
	for (const index of indices) {
		propActors[index]?.kill();
		propActors[index] = undefined;
		cleared.push(props[index].asset);
	}
	return cleared;
}

export function refreshTile(
	terrain: ex.TileMap,
	sheet: ex.SpriteSheet,
	crops: CropLayer,
	column: number,
	row: number,
	state: FarmTileState | undefined,
): void {
	const tile = terrain.getTile(column, row);
	if (!tile) return;
	tile.clearGraphics();
	if (!state) {
		const frame = terrainFrames[terrainAt(column, row)];
		tile.addGraphic(sheet.getSprite(frame.column, frame.row));
	} else {
		const soil =
			state === "planted" || state === "tilled"
				? "tilled-dry"
				: "tilled-watered";
		const frame = terrainFrames[soil];
		tile.addGraphic(sheet.getSprite(frame.column, frame.row));
	}
	crops.sync(column, row, state);
}
