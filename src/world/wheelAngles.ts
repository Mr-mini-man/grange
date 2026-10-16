import { type PocketId, WHEEL_ORDER } from "./roulette";

/** Angular width of a single pocket, in degrees. */
export const WHEEL_STEP = 360 / WHEEL_ORDER.length;

export interface WheelAngles {
	/** Clockwise rotation of the wheel rotor. */
	wheel: number;
	/** Counter-clockwise rotation of the ball arm. */
	ball: number;
}

/** Normalizes any angle into `[0, 360)`. */
export function mod360(value: number): number {
	return ((value % 360) + 360) % 360;
}

/**
 * Advances the wheel for one spin. The rotor turns clockwise (increasing)
 * while the ball orbits counter-clockwise (decreasing), and the ball finishes
 * pointing at the winning pocket's sector.
 */
export function nextSpinAngles(
	prev: WheelAngles,
	result: PocketId,
	rng: () => number = Math.random,
): WheelAngles {
	const pocketAngle = WHEEL_ORDER.indexOf(result) * WHEEL_STEP;
	const wheelTurns = 5 + Math.floor(rng() * 3);
	const wheel = prev.wheel + wheelTurns * 360 + rng() * 360;

	// The ball must end pointing where the pocket sits on screen, but we pick
	// the nearest congruent angle below the previous one so it always travels
	// counter-clockwise and never snaps backwards between rounds.
	const target = mod360(wheel + pocketAngle);
	const ballTurns = 6 + Math.floor(rng() * 3);
	const base = prev.ball - ballTurns * 360;
	const ball = base - mod360(base - target);

	return { wheel, ball };
}
