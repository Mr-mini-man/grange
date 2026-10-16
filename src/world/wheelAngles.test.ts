import { describe, expect, it } from "vitest";
import { WHEEL_ORDER } from "./roulette";
import {
	type WheelAngles,
	WHEEL_STEP,
	mod360,
	nextSpinAngles,
} from "./wheelAngles";

/** An rng that cycles through the supplied values. */
function rngFrom(values: number[]): () => number {
	let index = 0;
	return () => values[index++ % values.length];
}

describe("nextSpinAngles", () => {
	it("lands the ball on the winning pocket", () => {
		for (const pocket of WHEEL_ORDER) {
			const angles = nextSpinAngles({ wheel: 0, ball: 0 }, pocket, rngFrom([0.5]));
			const pocketAngle = WHEEL_ORDER.indexOf(pocket) * WHEEL_STEP;
			expect(mod360(angles.ball)).toBeCloseTo(
				mod360(angles.wheel + pocketAngle),
				6,
			);
		}
	});

	it("turns the wheel clockwise and the ball counter-clockwise", () => {
		let angles: WheelAngles = { wheel: 0, ball: 0 };
		for (let i = 0; i < WHEEL_ORDER.length; i += 1) {
			const next = nextSpinAngles(angles, WHEEL_ORDER[i], rngFrom([0.4]));
			expect(next.wheel).toBeGreaterThan(angles.wheel);
			expect(next.ball).toBeLessThan(angles.ball);
			angles = next;
		}
	});
});

describe("mod360", () => {
	it("normalizes angles into [0, 360)", () => {
		expect(mod360(-30)).toBe(330);
		expect(mod360(0)).toBe(0);
		expect(mod360(360)).toBe(0);
		expect(mod360(725)).toBe(5);
	});
});
