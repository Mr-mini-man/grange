import { describe, expect, it } from "vitest";
import type { ActiveFarm } from "../../shared/types";
import { BlockRegistry } from "./blocking";
import { fencePlacementReason, gatePlacementReason } from "./fenceActions";
import { terrainAt } from "./mapData";

const farm: ActiveFarm = {
	owner: "tester",
	tiles: [],
	tomatoes: 0,
	barn: {},
	animals: {},
	is_public: false,
	visitor_edit: false,
	fences: [],
	fence_count: 1,
	gates: [],
	gate_count: 1,
	sprinklers: [],
	sprinkler_count: 0,
	prop_overrides: [],
	prop_inventory: {},
	storage: {},
};
const player = { x: 800, y: 600 };

describe("fence placement after gate integration", () => {
	it("permits a clear grass tile", () => {
		expect(terrainAt(5, 4)).toBe("grass");
		expect(fencePlacementReason(farm, 5, 4, new BlockRegistry(), player)).toBeNull();
	});

	it("rejects a gate post even if collision data has not refreshed", () => {
		const withGate = { ...farm, gates: [{ x: 5, y: 4, direction: "horizontal" as const, open: true }] };
		expect(fencePlacementReason(withGate, 5, 4, new BlockRegistry(), player))
			.toBe("That fence corner is occupied.");
	});

	it("rejects a depleted supply or occupied player tile", () => {
		expect(fencePlacementReason({ ...farm, fence_count: 0 }, 5, 4,
			new BlockRegistry(), player)).toBe("No fences left in inventory.");
		expect(fencePlacementReason(farm, 5, 4, new BlockRegistry(),
			{ x: 5 * 64, y: 4 * 64 })).toBe("That fence corner is occupied.");
	});

	it("allows a corner beside tilled soil and an animal", () => {
		const withTile: ActiveFarm = { ...farm,
			tiles: [{ x: 5, y: 4, state: "tilled" }],
			placed_animals: [{ id: 1, species: "hen", x: 5, y: 4 }],
		};
		expect(fencePlacementReason(withTile, 5, 4, new BlockRegistry(), player)).toBeNull();
	});
});

describe("gate placement reasons", () => {
	it("names an empty gate supply before the occupied corner", () => {
		expect(gatePlacementReason({ ...farm, gate_count: 0 }, 5, 4,
			{ x: 5 * 64, y: 4 * 64 })).toBe("No gates left in inventory.");
	});

	it("rejects a fence post, another gate, or the player's own corner", () => {
		const withFence = { ...farm, fences: [{ x: 5, y: 4 }] };
		const withGate = { ...farm,
			gates: [{ x: 5, y: 4, direction: "horizontal" as const, open: false }] };
		expect(gatePlacementReason(withFence, 5, 4, player))
			.toBe("That gate corner is occupied.");
		expect(gatePlacementReason(withGate, 5, 4, player))
			.toBe("That gate corner is occupied.");
		expect(gatePlacementReason(farm, 5, 4, { x: 5 * 64 + 4, y: 4 * 64 + 4 }))
			.toBe("That gate corner is occupied.");
	});

	it("keeps unowned and clear corners distinct", () => {
		expect(gatePlacementReason(farm, 19, 5, player))
			.toBe("Buy this land from the mayor first.");
		expect(gatePlacementReason(farm, 5, 4, player)).toBeNull();
	});
});
