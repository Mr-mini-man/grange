import type { RenderedProp } from "./sceneRendering";

export interface WalkObstacle {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

export interface PropFootprint {
	/** Fraction of the prop's displayed width occupied at ground level. */
	width: number;
	/** Ground-level depth in world pixels. */
	depth: number;
}

export function propObstacles<Asset extends string>(
	props: RenderedProp<Asset>[],
	footprints: Partial<Record<Asset, PropFootprint>>,
): WalkObstacle[] {
	return props.flatMap((prop) => {
		const footprint = footprints[prop.asset];
		if (!footprint) return [];
		const halfWidth = (prop.width * footprint.width) / 2;
		return [
			{
				left: prop.x - halfWidth,
				right: prop.x + halfWidth,
				top: prop.y - footprint.depth,
				bottom: prop.y,
			},
		];
	});
}

/** Move a player's feet around solid scenery. Resolve axes separately so
 * walking diagonally into an obstacle slides along its edge. */
export function moveAroundObstacles(
	x: number,
	y: number,
	dx: number,
	dy: number,
	obstacles: WalkObstacle[],
	radius = 12,
): { x: number; y: number } {
	let nextX = x + dx;
	for (const box of obstacles) {
		if (y <= box.top - radius || y >= box.bottom + radius) continue;
		if (dx > 0 && x + radius <= box.left && nextX + radius > box.left) {
			nextX = Math.min(nextX, box.left - radius);
		} else if (
			dx < 0 &&
			x - radius >= box.right &&
			nextX - radius < box.right
		) {
			nextX = Math.max(nextX, box.right + radius);
		}
	}

	let nextY = y + dy;
	for (const box of obstacles) {
		if (nextX <= box.left - radius || nextX >= box.right + radius) continue;
		if (dy > 0 && y + radius <= box.top && nextY + radius > box.top) {
			nextY = Math.min(nextY, box.top - radius);
		} else if (
			dy < 0 &&
			y - radius >= box.bottom &&
			nextY - radius < box.bottom
		) {
			nextY = Math.max(nextY, box.bottom + radius);
		}
	}
	return { x: nextX, y: nextY };
}
