import { describe, expect, it } from "vitest";
import { FARM_GROW_MS, FARM_HARVEST_YIELD } from "../../shared/farm";
import { MAP_COLUMNS, MAP_ROWS } from "./mapData";
import { growthStage, LocalFarmStore } from "./farmState";

describe("growthStage", () => {
	it("maps tile states to crop sprites", () => {
		expect(growthStage(undefined)).toBe("none");
		expect(growthStage("tilled")).toBe("none");
		expect(growthStage("planted")).toBe("sprout");
		expect(growthStage("watered")).toBe("sprout");
		expect(growthStage("ready")).toBe("mature");
	});
});

describe("LocalFarmStore bounds", () => {
	it("covers the full map grid", () => {
		const farm = new LocalFarmStore();
		expect(farm.tillGround(0, 0)).toBe(true);
		expect(farm.tillGround(MAP_COLUMNS - 1, MAP_ROWS - 1)).toBe(true);
		expect(farm.tillGround(MAP_COLUMNS, 0)).toBe(false);
		expect(farm.tillGround(0, MAP_ROWS)).toBe(false);
		expect(farm.tillGround(-1, 0)).toBe(false);
		expect(farm.getTile(MAP_COLUMNS, 0)).toBeUndefined();
	});
});

describe("LocalFarmStore lifecycle", () => {
	it("till -> plant -> water -> tick -> harvest", () => {
		const farm = new LocalFarmStore();
		expect(farm.tillGround(8, 7)).toBe(true);
		expect(farm.plantSeed(8, 7, 1000)).toBe(true);
		expect(farm.waterTile(8, 7, 1000)).toBe(true);
		expect(farm.getTile(8, 7)).toMatchObject({
			state: "watered",
			readyAt: 1000 + FARM_GROW_MS,
		});
		expect(farm.tick(1000 + FARM_GROW_MS - 1)).toHaveLength(0);
		expect(farm.tick(1000 + FARM_GROW_MS)).toEqual([{ x: 8, y: 7 }]);
		expect(farm.getTile(8, 7)?.state).toBe("ready");
		expect(farm.harvestCrop(8, 7)).toBe(true);
		expect(farm.tomatoes).toBe(FARM_HARVEST_YIELD);
		expect(farm.getTile(8, 7)).toMatchObject({ state: "tilled" });
	});

	it("rejects out-of-order actions", () => {
		const farm = new LocalFarmStore();
		expect(farm.plantSeed(1, 1)).toBe(false);
		expect(farm.waterTile(1, 1)).toBe(false);
		expect(farm.harvestCrop(1, 1)).toBe(false);
		expect(farm.tillGround(1, 1)).toBe(true);
		expect(farm.tillGround(1, 1)).toBe(false);
		expect(farm.waterTile(1, 1)).toBe(false);
		expect(farm.harvestCrop(1, 1)).toBe(false);
		expect(farm.plantSeed(1, 1)).toBe(true);
		expect(farm.plantSeed(1, 1)).toBe(false);
		expect(farm.harvestCrop(1, 1)).toBe(false);
	});

	it("accumulates tomatoes across harvests", () => {
		const farm = new LocalFarmStore();
		for (const [x, y] of [
			[2, 2],
			[3, 3],
		] as const) {
			farm.tillGround(x, y);
			farm.plantSeed(x, y, 0);
			farm.waterTile(x, y, 0);
		}
		farm.tick(FARM_GROW_MS);
		farm.harvestCrop(2, 2);
		farm.harvestCrop(3, 3);
		expect(farm.tomatoes).toBe(FARM_HARVEST_YIELD * 2);
	});
});
