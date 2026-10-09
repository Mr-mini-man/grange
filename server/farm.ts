import {
	CROPS,
	FARM_GROW_MS,
	farmTileKey,
	isFarmInBounds,
	type CropId,
	type FarmInventory,
	type FarmReadyTile,
	type FarmTile,
	type PotionId,
} from "../shared/farm";

/** Any numeric inventory field (everything except the potion sub-record). */
export type InventoryCountKey = Exclude<keyof FarmInventory, "potions">;

export function defaultInventory(): FarmInventory {
	return {
		coins: 100,
		wood: 0,
		stone: 0,
		tomatoSeed: 4,
		tomato: 0,
		wheatSeed: 4,
		wheat: 0,
		potatoSeed: 4,
		potato: 0,
		barleySeed: 4,
		barley: 0,
		potions: { greenThumb: 0, swiftSip: 0, luckyDraught: 0 },
	};
}

export class InMemoryFarmStore {
	private tiles = new Map<string, Map<string, FarmTile>>();
	private inventories = new Map<string, FarmInventory>();

	private playerTiles(player: string): Map<string, FarmTile> {
		let map = this.tiles.get(player);
		if (!map) {
			map = new Map();
			this.tiles.set(player, map);
		}
		return map;
	}

	/** Returns the live stored tile; undefined means untilled (never stored). */
	getTile(player: string, x: number, y: number): FarmTile | undefined {
		if (!isFarmInBounds(x, y)) return undefined;
		return this.tiles.get(player)?.get(farmTileKey(x, y));
	}

	getPlayerTiles(player: string): FarmTile[] {
		return [...(this.tiles.get(player)?.values() ?? [])];
	}

	/** Returns the live inventory, creating the default on first access. */
	getInventory(player: string): FarmInventory {
		let inv = this.inventories.get(player);
		if (!inv) {
			inv = defaultInventory();
			this.inventories.set(player, inv);
		}
		return inv;
	}

	/** Adds (or removes, for negative amounts) a numeric inventory quantity. */
	addItem(player: string, key: InventoryCountKey, amount: number): void {
		this.getInventory(player)[key] += amount;
	}

	getItem(player: string, key: InventoryCountKey): number {
		return this.getInventory(player)[key];
	}

	/** Adds potions to the purse. */
	addPotions(player: string, potionId: PotionId, amount: number): void {
		const inv = this.getInventory(player);
		inv.potions[potionId] += amount;
	}

	tillGround(player: string, x: number, y: number): boolean {
		if (!isFarmInBounds(x, y)) return false;
		const tiles = this.playerTiles(player);
		const key = farmTileKey(x, y);
		if (tiles.has(key)) return false;
		tiles.set(key, { x, y, state: "tilled", cropId: "tomato" });
		return true;
	}

	plantSeed(
		player: string,
		x: number,
		y: number,
		now: number = Date.now(),
		cropId: CropId = "tomato",
	): boolean {
		if (!isFarmInBounds(x, y)) return false;
		const tile = this.getTile(player, x, y);
		if (tile?.state !== "tilled") return false;
		const inv = this.getInventory(player);
		const seedKey = CROPS[cropId].seedKey;
		if (inv[seedKey] <= 0) return false;
		inv[seedKey] -= 1;
		tile.cropId = cropId;
		tile.state = "planted";
		tile.plantedAt = now;
		return true;
	}

	waterTile(
		player: string,
		x: number,
		y: number,
		now: number = Date.now(),
		growMs: number = FARM_GROW_MS,
	): boolean {
		if (!isFarmInBounds(x, y)) return false;
		const tile = this.getTile(player, x, y);
		if (tile?.state !== "planted") return false;
		tile.state = "watered";
		tile.wateredAt = now;
		tile.readyAt = now + growMs;
		return true;
	}

	harvestCrop(player: string, x: number, y: number, yieldAmount?: number): boolean {
		if (!isFarmInBounds(x, y)) return false;
		const tile = this.getTile(player, x, y);
		if (tile?.state !== "ready") return false;
		const crop = CROPS[tile.cropId];
		const amount = yieldAmount ?? crop.yield;
		tile.state = "tilled";
		tile.wateredAt = undefined;
		tile.readyAt = undefined;
		this.getInventory(player)[tile.cropId] += amount;
		return true;
	}

	/** Flips every watered tile with readyAt <= now to ready. */
	tickFarm(now: number = Date.now()): FarmReadyTile[] {
		const ready: FarmReadyTile[] = [];
		for (const [player, tiles] of this.tiles) {
			for (const tile of tiles.values()) {
				if (
					tile.state === "watered" &&
					tile.readyAt !== undefined &&
					now >= tile.readyAt
				) {
					tile.state = "ready";
					ready.push({ player, x: tile.x, y: tile.y });
				}
			}
		}
		return ready;
	}

	clear(): void {
		this.tiles.clear();
		this.inventories.clear();
	}
}
