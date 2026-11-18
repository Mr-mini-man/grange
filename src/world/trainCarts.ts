import * as ex from "excalibur";
import type { TrainCart } from "../../shared/types";
import type { TrainRest } from "./train";

/** Pixel-art colours for the programmatically drawn cargo carts. */
const BODY = ex.Color.fromHex("#8a5a2b");
const INK = ex.Color.fromHex("#241208");
const WHEEL = ex.Color.fromHex("#2b1608");
const TIER_COLORS: Record<number, ex.Color> = {
	1: ex.Color.fromHex("#c9884a"),
	2: ex.Color.fromHex("#d9a24e"),
	3: ex.Color.fromHex("#ecc35a"),
};

/** Gap between the engine and each cart, and between carts. */
const CART_GAP = 10;
const WHEEL_RADIUS = 9;

/** A cart grows with its cargo capacity so an upgrade is visible. */
function cartSize(capacity: number): { width: number; height: number } {
	const slots = Math.max(2, Math.min(4, capacity));
	return { width: 60 + slots * 12, height: 26 + slots * 8 };
}

/** One cart's on-screen width for the given specs. */
export function cartWidth(capacity: number): number {
	return cartSize(capacity).width;
}

/**
 * The coupled cargo cars drawn behind the engine.
 *
 * The train art ships only an engine, so carts are drawn from simple shapes.
 * The group slides in lockstep with the engine (the controller sets its x each
 * frame) and rebuilds itself when the cart list changes after an upgrade.
 */
export class TrainCarts {
	private actors: ex.Actor[] = [];
	private offsets: number[] = [];
	private signature: string | null = null;

	constructor(private readonly scene: ex.Scene) {}

	/** Rebuilds the carts when `carts` changes; a no-op otherwise. */
	set(carts: readonly TrainCart[], rest: TrainRest): void {
		const signature = JSON.stringify(
			carts.map((cart) => [cart.index, cart.tier, cart.capacity]),
		);
		if (signature === this.signature) return;
		this.signature = signature;
		this.destroy();
		const offsets: number[] = [];
		let leftEdge = -rest.width / 2;
		for (const cart of carts) {
			const { width } = cartSize(cart.capacity);
			const center = leftEdge - CART_GAP - width / 2;
			offsets.push(center);
			leftEdge = center - width / 2;
			const actor = this.build(cart, rest);
			this.scene.add(actor);
			this.actors.push(actor);
		}
		this.offsets = offsets;
	}

	/** Slides every cart so it trails the engine at `engineX`. */
	setX(engineX: number, rest: TrainRest): void {
		this.actors.forEach((actor, i) => {
			actor.pos = ex.vec(engineX + (this.offsets[i] ?? 0), rest.y);
		});
	}

	/** Removes every cart actor, e.g. when the scene tears down. */
	destroy(): void {
		for (const actor of this.actors) actor.kill();
		this.actors = [];
		this.offsets = [];
		this.signature = null;
	}

	private build(cart: TrainCart, rest: TrainRest): ex.Actor {
		const { width, height } = cartSize(cart.capacity);
		const body = new ex.Rectangle({
			width,
			height,
			color: BODY,
			strokeColor: INK,
			lineWidth: 2,
		});
		const stripe = new ex.Rectangle({
			width: Math.max(8, width - 8),
			height: 5,
			color: TIER_COLORS[cart.tier] ?? TIER_COLORS[1],
		});
		const wheelL = new ex.Circle({
			radius: WHEEL_RADIUS,
			color: WHEEL,
			strokeColor: INK,
			lineWidth: 2,
		});
		const wheelR = new ex.Circle({
			radius: WHEEL_RADIUS,
			color: WHEEL,
			strokeColor: INK,
			lineWidth: 2,
		});
		const group = new ex.GraphicsGroup({
			useAnchor: false,
			members: [
				{
					graphic: body,
					offset: ex.vec(-width / 2, -(height + 2 * WHEEL_RADIUS)),
				},
				{
					graphic: stripe,
					offset: ex.vec(-(width - 8) / 2, -(height + 2 * WHEEL_RADIUS) + 5),
				},
				{ graphic: wheelL, offset: ex.vec(-width / 2 + 3, -2 * WHEEL_RADIUS) },
				{
					graphic: wheelR,
					offset: ex.vec(width / 2 - 3 - 2 * WHEEL_RADIUS, -2 * WHEEL_RADIUS),
				},
			],
		});
		const actor = new ex.Actor({
			pos: ex.vec(rest.x, rest.y),
			z: 99 + Math.floor(rest.y),
		});
		actor.graphics.use(group);
		return actor;
	}
}
