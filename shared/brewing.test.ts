import { describe, expect, it } from "vitest";
import {
	BREWERY_COST,
	MATERIALS,
	POTIONS,
	POTION_IDS,
	activeEffect,
	canBrew,
	canBuildBrewery,
	growthMsFor,
	harvestYieldFor,
	moveSpeedMultiplier,
	pruneEffects,
} from "./brewing";
import { CROPS, type ActiveEffect, type FarmInventory } from "./farm";

function emptyInventory(): FarmInventory {
	return {
		coins: 0,
		wood: 0,
		stone: 0,
		tomatoSeed: 0,
		tomato: 0,
		wheatSeed: 0,
		wheat: 0,
		potatoSeed: 0,
		potato: 0,
		barleySeed: 0,
		barley: 0,
		potions: { greenThumb: 0, swiftSip: 0, luckyDraught: 0 },
	};
}

describe("potion catalogue", () => {
	it("defines a recipe and effect for every potion", () => {
		for (const id of POTION_IDS) {
			const potion = POTIONS[id];
			expect(potion.name).toBeTruthy();
			expect(potion.barPrice).toBeGreaterThan(0);
			expect(potion.durationMs).toBeGreaterThan(0);
			for (const crop of Object.keys(potion.recipe)) {
				expect(crop in CROPS).toBe(true);
			}
		}
	});
});

describe("canBrew", () => {
	it("checks every ingredient in the recipe", () => {
		const inv = emptyInventory();
		expect(canBrew(inv, "greenThumb")).toBe(false);
		inv.wheat = 2;
		inv.potato = 1;
		expect(canBrew(inv, "greenThumb")).toBe(true);
	});
});

describe("canBuildBrewery", () => {
	it("requires the full build cost", () => {
		const inv = emptyInventory();
		inv.wood = BREWERY_COST.wood;
		inv.stone = BREWERY_COST.stone;
		expect(canBuildBrewery(inv)).toBe(false);
		inv.coins = BREWERY_COST.coins;
		expect(canBuildBrewery(inv)).toBe(true);
	});
});

describe("effect helpers", () => {
	const effects: ActiveEffect[] = [
		{ kind: "growth", expiresAt: 100 },
		{ kind: "speed", expiresAt: 0 },
	];

	it("activeEffect only matches live effects of the right kind", () => {
		expect(activeEffect(effects, "growth", 50)?.kind).toBe("growth");
		expect(activeEffect(effects, "speed", 50)).toBeUndefined();
		expect(activeEffect(effects, "luck", 50)).toBeUndefined();
	});

	it("pruneEffects drops lapsed effects", () => {
		expect(pruneEffects(effects, 50)).toHaveLength(1);
		expect(pruneEffects(effects, 200)).toHaveLength(0);
	});

	it("moveSpeedMultiplier only applies while Swift Sip runs", () => {
		const speed: ActiveEffect[] = [{ kind: "speed", expiresAt: 100 }];
		expect(moveSpeedMultiplier(speed, 0)).toBeGreaterThan(1);
		expect(moveSpeedMultiplier(speed, 100)).toBe(1);
	});
});

describe("effect scaling", () => {
	it("defaults to base crop timing and yield", () => {
		expect(growthMsFor("wheat", [], 0)).toBe(CROPS.wheat.growMs);
		expect(harvestYieldFor("barley", [], 0)).toBe(CROPS.barley.yield);
	});

	it("exposes material prices for the market", () => {
		expect(MATERIALS.wood.price).toBeGreaterThan(0);
		expect(MATERIALS.stone.price).toBeGreaterThan(0);
	});
});
