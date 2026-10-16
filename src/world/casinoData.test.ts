import { describe, expect, it } from "vitest";
import { CASINO_EXIT, casinoProps } from "./casinoData";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";

describe("casino interior data", () => {
	it("contains poker, blackjack, roulette, and slot games", () => {
		const assets = casinoProps.map((prop) => prop.asset);
		expect(assets).toContain("poker-table");
		expect(assets).toContain("blackjack-table");
		expect(assets).toContain("roulette-table");
		expect(assets.filter((asset) => asset === "slot-machine")).toHaveLength(3);
	});

	it("keeps the interior props and exit within the map", () => {
		for (const prop of casinoProps) {
			expect(prop.width).toBeGreaterThan(0);
			expect(prop.x - prop.width / 2).toBeGreaterThanOrEqual(0);
			expect(prop.x + prop.width / 2).toBeLessThanOrEqual(MAP_WIDTH);
			expect(prop.y).toBeGreaterThanOrEqual(0);
			expect(prop.y).toBeLessThanOrEqual(MAP_HEIGHT);
		}
		expect(CASINO_EXIT.x).toBeGreaterThanOrEqual(0);
		expect(CASINO_EXIT.x).toBeLessThanOrEqual(MAP_WIDTH);
		expect(CASINO_EXIT.y).toBeGreaterThanOrEqual(0);
		expect(CASINO_EXIT.y).toBeLessThanOrEqual(MAP_HEIGHT);
	});
});
