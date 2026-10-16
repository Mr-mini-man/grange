import { type RefObject, useLayoutEffect, useRef } from "react";
import type { Card } from "./blackjack";
import { CARD_BACK_SRC, cardArtSrc } from "./cardArt";

interface PlayingCardProps {
	card?: Card;
	faceDown?: boolean;
	/** Play the fly-from-deck animation. Only set for freshly drawn cards. */
	deal?: boolean;
	/** Stagger for cards dealt in the same batch, in milliseconds. */
	dealDelay?: number;
	/** The visible deck, used as the animation's starting point. */
	deckRef?: RefObject<HTMLDivElement> | null;
}

export function PlayingCard({
	card,
	faceDown = false,
	deal = false,
	dealDelay = 0,
	deckRef,
}: PlayingCardProps) {
	const ref = useRef<HTMLDivElement>(null);
	const innerRef = useRef<HTMLDivElement>(null);
	// Captured once: later renders must not replay the animation.
	const shouldDeal = useRef(deal).current;
	const delay = useRef(dealDelay).current;
	// A card dealt face-down (the dealer's hole card) flies in without flipping.
	const startsFaceDown = useRef(faceDown).current;
	// The card's resting position, measured before any deal transform is applied.
	const targetRect = useRef<DOMRect | null>(null);

	useLayoutEffect(() => {
		const el = ref.current;
		const deck = deckRef?.current;
		if (!shouldDeal || !el || !deck) return;
		// Measure once. StrictMode re-runs this effect, and re-measuring after
		// the animation is applied would read the transformed position, which
		// collapses the deck-to-hand travel to zero.
		targetRect.current ??= el.getBoundingClientRect();
		const from = deck.getBoundingClientRect();
		const to = targetRect.current;
		const dx = from.left - to.left + (from.width - to.width) / 2;
		const dy = from.top - to.top + (from.height - to.height) / 2;
		el.style.setProperty("--deal-x", `${dx}px`);
		el.style.setProperty("--deal-y", `${dy}px`);
		el.style.setProperty("--deal-delay", `${delay}ms`);
		el.classList.add("bj-deal-in");

		// The outer flight and the inner flip are separate animations on nested
		// elements, so clean each one up on its own animationend (events bubble).
		const onDealEnd = (event: AnimationEvent) => {
			if (event.target === el) el.classList.remove("bj-deal-in");
		};
		el.addEventListener("animationend", onDealEnd);

		const inner = innerRef.current;
		let onFlipEnd: ((event: AnimationEvent) => void) | null = null;
		if (!startsFaceDown && inner) {
			el.classList.add("bj-flip-in");
			onFlipEnd = (event: AnimationEvent) => {
				if (event.target === inner) el.classList.remove("bj-flip-in");
			};
			inner.addEventListener("animationend", onFlipEnd);
		}

		return () => {
			el.removeEventListener("animationend", onDealEnd);
			if (inner && onFlipEnd) {
				inner.removeEventListener("animationend", onFlipEnd);
			}
		};
	}, [shouldDeal, delay, deckRef, startsFaceDown]);

	return (
		<div
			ref={ref}
			className={faceDown ? "bj-card bj-card-down" : "bj-card"}
			role="img"
			aria-label={card ? `${card.rank} of ${card.suit}` : "Face-down card"}
		>
			<div className="bj-card-inner" ref={innerRef}>
				<img
					className="bj-card-front"
					src={card ? cardArtSrc(card) : undefined}
					alt=""
					draggable={false}
				/>
				<img
					className="bj-card-back"
					src={CARD_BACK_SRC}
					alt=""
					draggable={false}
				/>
			</div>
		</div>
	);
}
