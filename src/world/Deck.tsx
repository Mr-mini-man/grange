import type { RefObject } from "react";
import { CARD_BACK_SRC } from "./cardArt";

interface DeckProps {
	deckRef: RefObject<HTMLDivElement>;
	/** Overridable so reused tables can give the deck a distinct test id. */
	testId?: string;
}

/** The visible deck stack cards fly out of. */
export function Deck({ deckRef, testId = "blackjack-deck" }: DeckProps) {
	return (
		<div
			className="bj-deck"
			ref={deckRef}
			data-testid={testId}
			aria-hidden="true"
		>
			<img src={CARD_BACK_SRC} alt="" draggable={false} />
		</div>
	);
}
