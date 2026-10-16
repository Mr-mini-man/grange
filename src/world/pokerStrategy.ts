import type { HandCategory } from "./pokerHand";

export type DealerAction =
	| { type: "fold" }
	| { type: "check" }
	| { type: "call" }
	| { type: "raise"; amount: number };

/** Everything the dealer AI needs to choose an action, kept pure. */
export interface DealerContext {
	callAmount: number;
	canCheck: boolean;
	currentBet: number;
	minRaiseTo: number;
	maxRaiseTo: number;
	pot: number;
	/** 0..1 estimate of the dealer's hand strength. */
	strength: number;
	rng: () => number;
}

export type DealerStrategy = (context: DealerContext) => DealerAction;

/** Rough strength of a made hand, used to steer the dealer's betting. */
export const CATEGORY_STRENGTH: Record<HandCategory, number> = {
	highCard: 0.16,
	pair: 0.36,
	twoPair: 0.52,
	trips: 0.66,
	straight: 0.76,
	flush: 0.86,
	fullHouse: 0.93,
	quads: 0.98,
	straightFlush: 1,
};

/** A raise of at least the minimum, sized as a fraction of the pot. */
function raiseTo(context: DealerContext, fraction: number): DealerAction {
	const target = Math.floor(
		context.currentBet + Math.max(context.minRaiseTo - context.currentBet, context.pot * fraction),
	);
	return { type: "raise", amount: Math.min(target, context.maxRaiseTo) };
}

/**
 * A straightforward, slightly randomised dealer: value bets and raises strong
 * hands, calls when the price is right, and folds the rest.
 */
export const defaultDealerStrategy: DealerStrategy = (context) => {
	const { callAmount, canCheck, strength, pot, rng } = context;
	const roll = rng();

	if (canCheck) {
		if (strength > 0.62 || roll < 0.1) {
			return raiseTo(context, strength > 0.8 ? 0.75 : 0.5);
		}
		return { type: "check" };
	}

	const potOdds = callAmount / (pot + callAmount);
	if (strength > 0.8) {
		return roll < 0.55 ? raiseTo(context, 0.6) : { type: "call" };
	}
	if (strength > 0.55) {
		return roll < 0.18 ? raiseTo(context, 0.5) : { type: "call" };
	}
	if (strength > potOdds + 0.12) {
		return roll < 0.3 ? { type: "fold" } : { type: "call" };
	}
	if (strength > potOdds) {
		return roll < 0.5 ? { type: "call" } : { type: "fold" };
	}
	return roll < 0.08 ? { type: "call" } : { type: "fold" };
};
