import { describe, expect, it } from "vitest";
import { cartCapacity } from "../../shared/train";
import type { TrainCart, TrainView } from "../../shared/types";
import { trainUpgradeControl } from "./trainDepotControls";

function cart(index: number, tier: number): TrainCart {
	return { index, tier, capacity: cartCapacity(tier), cargo: {} };
}

function train(engine: number, tiers: number[]): TrainView {
	return {
		engine,
		max_carts: engine + 1,
		carts: tiers.map((tier, i) => cart(i + 1, tier)),
	};
}

describe("trainUpgradeControl", () => {
	it("disables an out-of-reach or non-owner purchase", () => {
		const starter = train(0, [1]);
		expect(trainUpgradeControl("train-engine", starter, true, 1_000).disabled).toBe(false);
		expect(trainUpgradeControl("train-engine", starter, true, 10).disabled).toBe(true);
		expect(trainUpgradeControl("train-engine", starter, false, 1_000).disabled).toBe(true);
	});

	it("reports the engine and cart counts as owned", () => {
		const current = train(2, [1, 1, 3]);
		expect(trainUpgradeControl("train-engine", current, true, 1_000).owned).toBe(2);
		expect(trainUpgradeControl("train-cart", current, true, 1_000).owned).toBe(3);
	});

	it("caps the engine and cart purchases", () => {
		const maxed = train(3, [3, 3, 3, 3]);
		expect(trainUpgradeControl("train-engine", maxed, true, 9_999).actionLabel).toBe("Max");
		expect(trainUpgradeControl("train-engine", maxed, true, 9_999).disabled).toBe(true);
		expect(trainUpgradeControl("train-cart", maxed, true, 9_999).disabled).toBe(true);
	});

	it("offers a cart upgrade until every cart is at the top tier", () => {
		const mixed = train(1, [3, 1]);
		expect(trainUpgradeControl("train-cart-upgrade", mixed, true, 1_000).disabled).toBe(false);

		const allMax = train(1, [3, 3]);
		expect(trainUpgradeControl("train-cart-upgrade", allMax, true, 1_000).disabled).toBe(true);
		expect(trainUpgradeControl("train-cart-upgrade", allMax, true, 1_000).actionLabel).toBe("Max");
	});
});
