import { describe, expect, it } from "vitest";
import {
	clampQuantity,
	MARKET_CATEGORIES,
	MARKET_ITEMS,
	MARKETS,
} from "./marketData";

describe("market definitions", () => {
	it("gives the seed market a seeds tab", () => {
		expect(MARKETS.seed.categories).toEqual(["seeds"]);
		expect(MARKETS.seed.defaultCategory).toBe("seeds");
	});

	it("gives the produce market sell, tools, and train tabs", () => {
		expect(MARKETS.produce.categories).toEqual(["sell", "tools", "train"]);
		expect(MARKETS.produce.defaultCategory).toBe("sell");
	});

	it("lists every configured category and gives it empty slots", () => {
		for (const market of Object.values(MARKETS)) {
			for (const id of market.categories) {
				const category = MARKET_CATEGORIES[id];
				expect(category.id).toBe(id);
				expect(category.label.length).toBeGreaterThan(0);
				expect(category.slots).toBeGreaterThan(0);
			}
			expect(market.categories).toContain(market.defaultCategory);
		}
	});

	it("sells tomato seeds in bunches of ten for one coin", () => {
		const seeds = MARKET_CATEGORIES.seeds;
		expect(seeds.items).toEqual(["tomato-seed"]);

		const item = MARKET_ITEMS["tomato-seed"];
		expect(item.kind).toBe("buy");
		expect(item.price).toBe(1);
		expect(item.quantity).toBe(10);
	});

	it("buys tomatoes individually for one coin", () => {
		const sell = MARKET_CATEGORIES.sell;
		expect(sell.items).toEqual(["tomato"]);

		const item = MARKET_ITEMS.tomato;
		expect(item.kind).toBe("sell");
		expect(item.price).toBe(1);
		expect(item.quantity).toBe(1);
	});

	it("clamps sell quantities into the 1..max range", () => {
		expect(clampQuantity(5, 10)).toBe(5);
		expect(clampQuantity(0, 10)).toBe(1);
		expect(clampQuantity(-4, 10)).toBe(1);
		expect(clampQuantity(99, 10)).toBe(10);
		expect(clampQuantity(3, 0)).toBe(1);
		expect(clampQuantity(Number.NaN, 10)).toBe(1);
	});
});
