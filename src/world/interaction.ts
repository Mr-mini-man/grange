/** The furthest a player may stand from something to interact with it. */
export const MAX_INTERACTION_DISTANCE = 96;

/** True when the player is close enough to reach `target`. */
export function withinInteractionRange(
	player: { x: number; y: number },
	target: { x: number; y: number },
	max = MAX_INTERACTION_DISTANCE,
): boolean {
	return Math.hypot(player.x - target.x, player.y - target.y) <= max;
}
