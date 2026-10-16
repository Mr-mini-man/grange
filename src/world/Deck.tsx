import type { RefObject } from "react";
import { CARD_BACK_SRC } from "./cardArt";

interface DeckProps {
	deckRef: RefObject<HTMLDivElement>;
}

/** The visible deck stack cards fly out of. */
export function Deck({ deckRef }: DeckProps) {
	return (
		<div
			className="bj-deck"
			ref={deckRef}
			data-testid="blackjack-deck"
			aria-hidden="true"
		>
			<img src={CARD_BACK_SRC} alt="" draggable={false} />
		</div>
	);
}
