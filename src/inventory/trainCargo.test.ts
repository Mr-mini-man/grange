import { describe, expect, it } from "vitest";
import type { TrainCart } from "../../shared/types";
import { cargoEntries } from "./trainCargo";

function cart(capacity: number, cargo: Record<string, number>): TrainCart {
	return { index: 1, tier: capacity - 1, capacity, cargo };
}

describe("cargoEntries", () => {
	it("drops empty stacks and sorts by item id", () => {
		const entries = cargoEntries(cart(4, { wheat: 3, tomato: 0, lettuce: 1 }));
		expect(entries).toEqual([
			{ itemId: "lettuce", count: 1 },
			{ itemId: "wheat", count: 3 },
		]);
	});

	it("never returns more entries than the cart has slots", () => {
		const entries = cargoEntries(cart(2, { wheat: 1, lettuce: 1, tomato: 1 }));
		expect(entries).toHaveLength(2);
	});
});
