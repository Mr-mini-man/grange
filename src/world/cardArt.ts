import type { Card } from "./blackjack";

/** Face-down card art: a rectangle split diagonally into red and black. */
export const CARD_BACK_SRC = "/assets/cards/back.svg";

/** Face-up art for a specific card, e.g. `/assets/cards/hearts-A.svg`. */
export function cardArtSrc(card: Card): string {
	return `/assets/cards/${card.suit}-${card.rank}.svg`;
}
