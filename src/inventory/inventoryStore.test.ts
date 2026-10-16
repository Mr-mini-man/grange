import { beforeEach, describe, expect, it } from "vitest";
import { countItem, useInventoryStore } from "./inventoryStore";

beforeEach(() => {
	useInventoryStore.getState().resetInventory();
});

describe("inventory slots", () => {
	it("seeds a stub hotbar and grid", () => {
		const { hotbar, grid } = useInventoryStore.getState();
		expect(hotbar).toHaveLength(10);
		expect(grid).toHaveLength(24);
		expect(hotbar[0]).toMatchObject({ itemId: "hoe", count: 1 });
		expect(grid[0]).toMatchObject({ itemId: "tomato", count: 12 });
		expect(countItem(useInventoryStore.getState(), "tomato")).toBe(17);
	});

	it("keeps no currency item in slots", () => {
		const items = [
			...useInventoryStore.getState().grid,
			...useInventoryStore.getState().hotbar,
		].map((s) => s.itemId);
		expect(items).not.toContain("grangecoin");
	});

	it("moves a stack into an empty slot", () => {
		const { moveStack } = useInventoryStore.getState();
		moveStack({ area: "hotbar", index: 0 }, { area: "grid", index: 10 });
		const { hotbar, grid } = useInventoryStore.getState();
		expect(hotbar[0]?.itemId).toBeNull();
		expect(grid[10]).toMatchObject({ itemId: "hoe", count: 1 });
	});

	it("merges partial stacks of the same item", () => {
		const { moveStack } = useInventoryStore.getState();
		// hotbar[1] is 10 seeds, grid[1] is 20 seeds.
		moveStack({ area: "hotbar", index: 1 }, { area: "grid", index: 1 });
		const { hotbar, grid } = useInventoryStore.getState();
		expect(grid[1]).toMatchObject({ itemId: "seed-bag", count: 30 });
		expect(hotbar[1]?.itemId).toBeNull();
	});

	it("swaps two different items", () => {
		const { moveStack } = useInventoryStore.getState();
		moveStack({ area: "hotbar", index: 0 }, { area: "hotbar", index: 4 });
		const { hotbar } = useInventoryStore.getState();
		expect(hotbar[0]).toMatchObject({ itemId: "tomato" });
		expect(hotbar[4]).toMatchObject({ itemId: "hoe" });
	});

	it("never merges non-stackable tools", () => {
		const { addItem } = useInventoryStore.getState();
		addItem("hoe", 1);
		const { hotbar, grid } = useInventoryStore.getState();
		const hoes = [...hotbar, ...grid].filter((s) => s.itemId === "hoe");
		expect(hoes).toHaveLength(2);
		expect(hoes.every((s) => s.count === 1)).toBe(true);
	});

	it("splits half of a stack into an empty slot", () => {
		const { splitHalf } = useInventoryStore.getState();
		splitHalf({ area: "grid", index: 0 }, { area: "grid", index: 10 });
		const { grid } = useInventoryStore.getState();
		expect(grid[10]).toMatchObject({ itemId: "tomato", count: 6 });
		expect(grid[0]).toMatchObject({ itemId: "tomato", count: 6 });
	});

	it("selects hotbar slots and toggles the panel", () => {
		const store = useInventoryStore.getState();
		store.selectHotbar(9);
		expect(useInventoryStore.getState().selectedHotbar).toBe(9);
		store.selectHotbar(99);
		expect(useInventoryStore.getState().selectedHotbar).toBe(9);
		store.toggleInventory();
		expect(useInventoryStore.getState().inventoryOpen).toBe(true);
	});
});
