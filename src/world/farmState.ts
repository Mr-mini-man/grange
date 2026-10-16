import {
	FARM_GROW_MS,
	FARM_HARVEST_YIELD,
	farmTileKey,
	type FarmTile,
} from "../../shared/farm";
import { MAP_COLUMNS, MAP_ROWS } from "./mapData";

/**
 * Visual growth stage for a tile. When an in-between stage is added later
 * (e.g. "sprout" -> "bush" -> "mature"), extend this type and `growthStage`
 * without touching the scene.
 */
export type CropGrowthStage = "none" | "sprout" | "mature";

export function growthStage(
	state: FarmTile["state"] | undefined,
): CropGrowthStage {
	if (state === "planted" || state === "watered") return "sprout";
	if (state === "ready") return "mature";
	return "none";
}

export function isMapInBounds(x: number, y: number): boolean {
	return (
		Number.isInteger(x) &&
		Number.isInteger(y) &&
		x >= 0 &&
		y >= 0 &&
		x < MAP_COLUMNS &&
		y < MAP_ROWS
	);
}

/**
 * Minimal store contract. A future server/DB-backed implementation can
 * implement this interface and replace LocalFarmStore without scene changes.
 */
export interface IFarmStore {
	getTile(x: number, y: number): FarmTile | undefined;
	tillGround(x: number, y: number): boolean;
	plantSeed(x: number, y: number, now?: number): boolean;
	waterTile(x: number, y: number, now?: number, growMs?: number): boolean;
	harvestCrop(x: number, y: number): boolean;
	tick(now?: number): Array<{ x: number; y: number }>;
	readonly tomatoes: number;
	clear(): void;
}

/** Client-local farm state. A missing tile means untilled grass. */
export class LocalFarmStore implements IFarmStore {
	private tiles = new Map<string, FarmTile>();
	private harvestedTomatoes = 0;

	get tomatoes(): number {
		return this.harvestedTomatoes;
	}

	getTile(x: number, y: number): FarmTile | undefined {
		if (!isMapInBounds(x, y)) return undefined;
		return this.tiles.get(farmTileKey(x, y));
	}

	tillGround(x: number, y: number): boolean {
		if (!isMapInBounds(x, y)) return false;
		const key = farmTileKey(x, y);
		if (this.tiles.has(key)) return false;
		this.tiles.set(key, { x, y, state: "tilled", cropId: "tomato" });
		return true;
	}

	plantSeed(x: number, y: number, now: number = Date.now()): boolean {
		if (!isMapInBounds(x, y)) return false;
		const tile = this.tiles.get(farmTileKey(x, y));
		if (tile?.state !== "tilled") return false;
		tile.state = "planted";
		tile.plantedAt = now;
		return true;
	}

	waterTile(
		x: number,
		y: number,
		now: number = Date.now(),
		growMs: number = FARM_GROW_MS,
	): boolean {
		if (!isMapInBounds(x, y)) return false;
		const tile = this.tiles.get(farmTileKey(x, y));
		if (tile?.state !== "planted") return false;
		tile.state = "watered";
		tile.wateredAt = now;
		tile.readyAt = now + growMs;
		return true;
	}

	harvestCrop(x: number, y: number): boolean {
		if (!isMapInBounds(x, y)) return false;
		const tile = this.tiles.get(farmTileKey(x, y));
		if (tile?.state !== "ready") return false;
		tile.state = "tilled";
		tile.wateredAt = undefined;
		tile.readyAt = undefined;
		this.harvestedTomatoes += FARM_HARVEST_YIELD;
		return true;
	}

	/** Flips every watered tile with readyAt <= now to ready. */
	tick(now: number = Date.now()): Array<{ x: number; y: number }> {
		const ready: Array<{ x: number; y: number }> = [];
		for (const tile of this.tiles.values()) {
			if (
				tile.state === "watered" &&
				tile.readyAt !== undefined &&
				now >= tile.readyAt
			) {
				tile.state = "ready";
				ready.push({ x: tile.x, y: tile.y });
			}
		}
		return ready;
	}

	clear(): void {
		this.tiles.clear();
		this.harvestedTomatoes = 0;
	}
}
