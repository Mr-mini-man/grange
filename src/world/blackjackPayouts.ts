import {
	NATURAL_MULTIPLIER,
	PUSH_MULTIPLIER,
	SURRENDER_MULTIPLIER,
	WIN_MULTIPLIER,
} from "./blackjack";
import type { HandResult } from "./blackjackTypes";

/** Total chips returned to the player when a hand resolves. */
export function payoutFor(wager: number, result: HandResult | null): number {
	switch (result) {
		case "blackjack":
			return Math.floor(wager * NATURAL_MULTIPLIER);
		case "win":
			return Math.floor(wager * WIN_MULTIPLIER);
		case "push":
			return Math.floor(wager * PUSH_MULTIPLIER);
		case "surrender":
			return Math.floor(wager * SURRENDER_MULTIPLIER);
		default:
			return 0;
	}
}
