import type { Card } from "./blackjack";

export interface CardSlot {
	key: string;
	code: string;
	card?: Card;
	faceDown: boolean;
}

/** Identity for a card within a round; every card in a deck is unique. */
export function cardCode(card: Card): string {
	return `${card.rank}${card.suit}`;
}

/** Marker code for the dealer's face-down hole card. */
export const HOLE_CODE = "__hole__";

/**
 * Dealer slots in draw order. The second card is the hole card: face-down
 * until revealed, and keyed stably so it flips instead of re-animating.
 */
export function buildDealerSlots(
	dealer: readonly Card[],
	hidden: boolean,
): CardSlot[] {
	const slots: CardSlot[] = dealer.map((card, i) => ({
		key: `d${i}`,
		code: cardCode(card),
		card,
		faceDown: false,
	}));
	if (hidden) {
		slots.splice(1, 0, { key: "hole", code: HOLE_CODE, faceDown: true });
	} else if (slots.length >= 2) {
		slots[1] = {
			key: "hole",
			code: HOLE_CODE,
			card: dealer[1],
			faceDown: false,
		};
	}
	return slots;
}
