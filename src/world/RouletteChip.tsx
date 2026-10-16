import { type RefObject, useLayoutEffect, useRef } from "react";
import { FELT_HEIGHT, FELT_WIDTH } from "./rouletteLayout";
import type { BetSpot, PlacedBet } from "./rouletteTypes";

interface RouletteChipProps {
	bet: PlacedBet;
	spot: BetSpot;
	trayRef: RefObject<HTMLDivElement>;
	settled: boolean;
}

/** A chip sitting on a spot, flying in from the tray the first time it lands. */
export function RouletteChip({
	bet,
	spot,
	trayRef,
	settled,
}: RouletteChipProps) {
	const ref = useRef<HTMLDivElement>(null);
	const targetRect = useRef<DOMRect | null>(null);

	useLayoutEffect(() => {
		const el = ref.current;
		const tray = trayRef.current;
		if (!el || !tray) return;
		// Measure once; later renders must not replay the flight.
		targetRect.current ??= el.getBoundingClientRect();
		const from = tray.getBoundingClientRect();
		const to = targetRect.current;
		el.style.setProperty(
			"--chip-x",
			`${from.left - to.left + (from.width - to.width) / 2}px`,
		);
		el.style.setProperty(
			"--chip-y",
			`${from.top - to.top + (from.height - to.height) / 2}px`,
		);
		el.classList.add("rl-chip-in");
		const onEnd = (event: AnimationEvent) => {
			if (event.target === el) el.classList.remove("rl-chip-in");
		};
		el.addEventListener("animationend", onEnd);
		return () => el.removeEventListener("animationend", onEnd);
	}, [trayRef]);

	const classes = ["rl-chip"];
	if (settled && bet.won === true) classes.push("rl-chip-win");
	if (settled && bet.won === false) classes.push("rl-chip-lose");

	return (
		<div
			ref={ref}
			className={classes.join(" ")}
			style={{
				left: `${((spot.x + spot.w / 2) / FELT_WIDTH) * 100}%`,
				top: `${((spot.y + spot.h / 2) / FELT_HEIGHT) * 100}%`,
			}}
			data-testid={`roulette-chip-${bet.spotId}`}
		>
			${bet.amount}
		</div>
	);
}
