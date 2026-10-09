import { beforeEach, describe, expect, it } from "vitest";
import {
	BREWERY_COST,
	MATERIALS,
	POTIONS,
	growthMsFor,
	harvestYieldFor,
} from "../shared/brewing";
import { CROPS } from "../shared/farm";
import { InMemoryBreweryStore } from "./brewing";
import { InMemoryFarmStore } from "./farm";

const P1 = "p1";

let farm: InMemoryFarmStore;
let brewery: InMemoryBreweryStore;

beforeEach(() => {
	farm = new InMemoryFarmStore();
	brewery = new InMemoryBreweryStore();
});

function fundAndBuild(player = P1): void {
	farm.addItem(player, "wood", BREWERY_COST.wood);
	farm.addItem(player, "stone", BREWERY_COST.stone);
	farm.addItem(player, "coins", BREWERY_COST.coins);
	expect(brewery.build(farm, player)).toEqual({ ok: true });
}

describe("building the brewery", () => {
	it("requires wood, stone, and coins up front", () => {
		expect(brewery.build(farm, P1)).toEqual({
			ok: false,
			error: expect.stringContaining("not enough"),
		});
		expect(brewery.isBuilt(P1)).toBe(false);
	});

	it("spends the materials and marks the brewery built", () => {
		fundAndBuild();
		expect(brewery.isBuilt(P1)).toBe(true);
		const inv = farm.getInventory(P1);
		expect(inv.coins).toBe(100);
		expect(inv.wood).toBe(0);
		expect(inv.stone).toBe(0);
		expect(BREWERY_COST).toEqual({ wood: 10, stone: 8, coins: 25 });
	});

	it("cannot be built twice", () => {
		fundAndBuild();
		farm.addItem(P1, "wood", 50);
		expect(brewery.build(farm, P1)).toEqual({
			ok: false,
			error: "brewery already built",
		});
	});
});

describe("the market", () => {
	it("sells materials for coins", () => {
		const result = brewery.buyMaterial(farm, P1, "wood", 2);
		expect(result.ok).toBe(true);
		const inv = farm.getInventory(P1);
		expect(inv.wood).toBe(2);
		expect(inv.coins).toBe(100 - MATERIALS.wood.price * 2);
	});

	it("sells seeds for coins", () => {
		const result = brewery.buySeed(farm, P1, "barley", 3);
		expect(result.ok).toBe(true);
		const inv = farm.getInventory(P1);
		expect(inv.barleySeed).toBe(4 + 3);
		expect(inv.coins).toBe(100 - CROPS.barley.seedPrice * 3);
	});

	it("rejects purchases you cannot afford", () => {
		farm.addItem(P1, "coins", -100);
		expect(brewery.buyMaterial(farm, P1, "stone").ok).toBe(false);
		expect(brewery.buySeed(farm, P1, "tomato").ok).toBe(false);
	});
});

describe("brewing", () => {
	it("needs a brewery first", () => {
		farm.addItem(P1, "wheat", 2);
		farm.addItem(P1, "potato", 1);
		expect(brewery.brew(farm, P1, "greenThumb")).toEqual({
			ok: false,
			error: "build a brewery first",
		});
	});

	it("consumes the recipe crops and yields a potion", () => {
		fundAndBuild();
		farm.addItem(P1, "wheat", 2);
		farm.addItem(P1, "potato", 1);
		expect(brewery.brew(farm, P1, "greenThumb")).toEqual({ ok: true });
		const inv = farm.getInventory(P1);
		expect(inv.wheat).toBe(0);
		expect(inv.potato).toBe(0);
		expect(inv.potions.greenThumb).toBe(1);
	});

	it("refuses to brew without the ingredients", () => {
		fundAndBuild();
		expect(brewery.brew(farm, P1, "luckyDraught")).toEqual({
			ok: false,
			error: "missing crops",
		});
	});
});

describe("the bar", () => {
	it("buys potions for coins", () => {
		farm.addPotions(P1, "swiftSip", 2);
		expect(brewery.sellPotion(farm, P1, "swiftSip").ok).toBe(true);
		const inv = farm.getInventory(P1);
		expect(inv.potions.swiftSip).toBe(1);
		expect(inv.coins).toBe(100 + POTIONS.swiftSip.barPrice);
	});

	it("rejects selling a potion you do not have", () => {
		expect(brewery.sellPotion(farm, P1, "greenThumb").ok).toBe(false);
	});

	it("buys spare crops", () => {
		farm.addItem(P1, "potato", 1);
		expect(brewery.sellCrop(farm, P1, "potato").ok).toBe(true);
		expect(farm.getInventory(P1).coins).toBe(100 + CROPS.potato.cropPrice);
	});
});

describe("potion effects", () => {
	it("drinking a potion consumes it and starts an effect", () => {
		farm.addPotions(P1, "greenThumb", 1);
		expect(brewery.usePotion(farm, P1, "greenThumb", 0)).toEqual({ ok: true });
		expect(farm.getInventory(P1).potions.greenThumb).toBe(0);
		const effects = brewery.getEffects(P1, 0);
		expect(effects).toEqual([{ kind: "growth", expiresAt: POTIONS.greenThumb.durationMs }]);
	});

	it("cannot drink what you do not own", () => {
		expect(brewery.usePotion(farm, P1, "swiftSip").ok).toBe(false);
	});

	it("Green Thumb halves growth time", () => {
		farm.addPotions(P1, "greenThumb", 1);
		brewery.usePotion(farm, P1, "greenThumb", 0);
		const effects = brewery.getEffects(P1, 0);
		expect(growthMsFor("wheat", effects, 0)).toBe(CROPS.wheat.growMs / 2);
		expect(growthMsFor("wheat", [], 0)).toBe(CROPS.wheat.growMs);
	});

	it("Lucky Draught adds bonus harvest yield", () => {
		farm.addPotions(P1, "luckyDraught", 1);
		brewery.usePotion(farm, P1, "luckyDraught", 0);
		const effects = brewery.getEffects(P1, 0);
		expect(harvestYieldFor("barley", effects, 0)).toBe(CROPS.barley.yield + 2);
	});

	it("lets effects lapse once their timer runs out", () => {
		farm.addPotions(P1, "swiftSip", 1);
		brewery.usePotion(farm, P1, "swiftSip", 0);
		expect(brewery.getEffects(P1, 1000)).toHaveLength(1);
		expect(
			brewery.getEffects(P1, POTIONS.swiftSip.durationMs + 1),
		).toHaveLength(0);
	});

	it("refreshes rather than stacks an effect of the same kind", () => {
		farm.addPotions(P1, "swiftSip", 2);
		brewery.usePotion(farm, P1, "swiftSip", 0);
		brewery.usePotion(farm, P1, "swiftSip", 100);
		const effects = brewery.getEffects(P1, 100);
		expect(effects).toHaveLength(1);
		expect(effects[0].expiresAt).toBe(100 + POTIONS.swiftSip.durationMs);
	});
});

describe("crop to coin loop", () => {
	it("grows wheat, brews Green Thumb, and sells it at the bar", () => {
		fundAndBuild();
		farm.addItem(P1, "wheat", 2);
		farm.addItem(P1, "potato", 1);
		expect(brewery.brew(farm, P1, "greenThumb").ok).toBe(true);
		const before = farm.getInventory(P1).coins;
		expect(brewery.sellPotion(farm, P1, "greenThumb").ok).toBe(true);
		expect(farm.getInventory(P1).coins).toBe(
			before + POTIONS.greenThumb.barPrice,
		);
	});
});
