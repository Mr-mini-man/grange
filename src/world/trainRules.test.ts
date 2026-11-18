import { describe, expect, it } from "vitest";
import {
	cargoRoom,
	cartCapacity,
	depositTarget,
	isTrainUpgradeId,
	maxCartsForEngine,
	totalCargoSlots,
	TRAIN_STACK_LIMIT,
	trainSpeedFactor,
} from "../../shared/train";
import type { TrainCart, TrainView } from "../../shared/types";

function cart(index: number, tier: number, cargo: Record<string, number> = {}): TrainCart {
	return { index, tier, capacity: cartCapacity(tier), cargo };
}

describe("train rules", () => {
	it("maps cart tiers to 2..4 cargo slots", () => {
		expect(cartCapacity(1)).toBe(2);
		expect(cartCapacity(2)).toBe(3);
		expect(cartCapacity(3)).toBe(4);
		expect(cartCapacity(0)).toBe(2);
		expect(cartCapacity(99)).toBe(4);
	});

	it("lets a bigger engine pull more carts", () => {
		expect(maxCartsForEngine(0)).toBe(1);
		expect(maxCartsForEngine(1)).toBe(2);
		expect(maxCartsForEngine(3)).toBe(4);
		expect(maxCartsForEngine(7)).toBe(4);
	});

	it("makes a better engine travel faster", () => {
		expect(trainSpeedFactor(0)).toBe(1);
		expect(trainSpeedFactor(3)).toBeLessThan(trainSpeedFactor(0));
	});

	it("computes room for a stack and for a new slot", () => {
		const empty = cart(1, 1);
		expect(cargoRoom(empty, "wheat")).toBe(TRAIN_STACK_LIMIT);

		const stacked = cart(1, 1, { wheat: TRAIN_STACK_LIMIT - 4 });
		expect(cargoRoom(stacked, "wheat")).toBe(4);

		const fullSlots = cart(1, 1, { wheat: 1, lettuce: 1 });
		expect(cargoRoom(fullSlots, "tomato")).toBe(0);
	});

	it("deposits into the first cart with room, or finds none", () => {
		const carts = [cart(1, 1, { wheat: 1, lettuce: 1 }), cart(2, 2)];
		const target = depositTarget(carts, "tomato");
		expect(target?.cart.index).toBe(2);
		expect(target?.room).toBe(TRAIN_STACK_LIMIT);

		const full = [cart(1, 1, { wheat: 1, lettuce: 1 })];
		expect(depositTarget(full, "tomato")).toBeNull();
	});

	it("sums the cargo slots across carts", () => {
		const train: TrainView = {
			engine: 1,
			max_carts: 2,
			carts: [cart(1, 1), cart(2, 3)],
		};
		expect(totalCargoSlots(train)).toBe(6);
		expect(totalCargoSlots(undefined)).toBe(0);
	});

	it("recognises the depot upgrade ids", () => {
		expect(isTrainUpgradeId("train-engine")).toBe(true);
		expect(isTrainUpgradeId("train-cart")).toBe(true);
		expect(isTrainUpgradeId("wheat-seed")).toBe(false);
	});
});
