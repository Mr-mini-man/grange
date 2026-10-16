import { describe, expect, it } from "vitest";
import { type DealerContext, defaultDealerStrategy } from "./pokerStrategy";

function context(overrides: Partial<DealerContext> = {}): DealerContext {
	return {
		callAmount: 0,
		canCheck: true,
		currentBet: 0,
		minRaiseTo: 10,
		maxRaiseTo: 100,
		pot: 20,
		strength: 0.5,
		rng: () => 0.99,
		...overrides,
	};
}

describe("defaultDealerStrategy", () => {
	it("checks a weak hand when there is nothing to call", () => {
		expect(defaultDealerStrategy(context({ strength: 0.2 }))).toEqual({
			type: "check",
		});
	});

	it("value bets a strong hand", () => {
		const action = defaultDealerStrategy(context({ strength: 0.9 }));
		expect(action.type).toBe("raise");
	});

	it("calls a strong hand facing a bet", () => {
		const action = defaultDealerStrategy(
			context({ canCheck: false, callAmount: 10, currentBet: 10, strength: 0.85 }),
		);
		expect(action.type).toBe("call");
	});

	it("folds a weak hand facing a large bet", () => {
		const action = defaultDealerStrategy(
			context({
				canCheck: false,
				callAmount: 80,
				currentBet: 80,
				pot: 40,
				strength: 0.2,
			}),
		);
		expect(action.type).toBe("fold");
	});
});
