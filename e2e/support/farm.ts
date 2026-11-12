import { expect, type Page } from "@playwright/test";
import { MAX_INTERACTION_DISTANCE } from "../../src/world/interaction";
import { MAP_COLUMNS, MAP_ROWS, TILE_SIZE } from "../../src/world/mapData";

/**
 * The page-space center of a world point, given in map pixels.
 *
 * Excalibur's FitContainer keeps the canvas at the map's aspect ratio, so a
 * world coordinate is a simple fraction of the canvas box.
 */
export async function worldPoint(
	page: Page,
	worldX: number,
	worldY: number,
): Promise<{ x: number; y: number }> {
	const box = await page.locator(".farm-map-canvas").boundingBox();
	expect(box).not.toBeNull();
	if (!box) throw new Error("the world canvas is not laid out");
	return {
		x: box.x + (worldX / 1152) * box.width,
		y: box.y + (worldY / 768) * box.height,
	};
}

/** Clicks a point given in world pixels. */
export async function clickWorld(
	page: Page,
	worldX: number,
	worldY: number,
): Promise<void> {
	const point = await worldPoint(page, worldX, worldY);
	await page.mouse.click(point.x, point.y);
}

/**
 * The page-space center of a farm map tile (0-based map coordinates).
 * `MAP_COLUMNS`/`MAP_ROWS` come from the same data the game renders with, so
 * the click math can't drift away from the real grid when tiles are redrawn or
 * the layout is restyled.
 */
export async function farmTilePosition(
	page: Page,
	column: number,
	row: number,
): Promise<{ x: number; y: number }> {
	const box = await page.locator("canvas.farm-map-canvas").boundingBox();
	expect(box).not.toBeNull();
	if (!box) throw new Error("the world canvas is not laid out");
	return {
		x: box.x + ((column + 0.5) / MAP_COLUMNS) * box.width,
		y: box.y + ((row + 0.5) / MAP_ROWS) * box.height,
	};
}

/** Moves the pointer over the center of a farm map tile. */
export async function hoverFarmTile(
	page: Page,
	column: number,
	row: number,
): Promise<void> {
	const { x, y } = await farmTilePosition(page, column, row);
	await page.mouse.move(x, y);
}

/** Clicks the center of a farm map tile. */
export async function clickFarmTile(
	page: Page,
	column: number,
	row: number,
): Promise<void> {
	const { x, y } = await farmTilePosition(page, column, row);
	// Stand on the neighbouring tile rather than on the target: placement rules
	// refuse the player's own tile, and standing beside it keeps the farmer
	// sprite from covering the tile's pixels. One tile away is still within
	// MAX_INTERACTION_DISTANCE.
	const beside = column > 0 ? column - 1 : column + 1;
	await movePlayerNear(
		page,
		(beside + 0.5) * TILE_SIZE,
		(row + 0.5) * TILE_SIZE,
		12,
		// The click lands on a tile one square past the walk point, so once the
		// walk is abandoned the player must be close enough that the *clicked*
		// tile is inside reach, not merely the walk point.
		{ reach: MAX_INTERACTION_DISTANCE - TILE_SIZE - 8 },
	);
	await page.mouse.click(x, y);
}

/** Clicks a farm tile without moving the player. Prop placement is not
 * reach-gated, and walking into the tile would trip the "move out of the
 * placement area" rule, so placement tests click from where they stand. */
export async function tapFarmTile(
	page: Page,
	column: number,
	row: number,
): Promise<void> {
	const { x, y } = await farmTilePosition(page, column, row);
	await page.mouse.click(x, y);
}

/**
 * Walks the player until it stands within `tolerance` px of a world point.
 * Tools only reach `MAX_INTERACTION_DISTANCE`, so click-driven farm tests must
 * stand beside their target first. The player's world position is published by
 * the scene as data attributes on the farm page, so the helper polls the real
 * position rather than guessing key-hold durations. It gives up on a stalled
 * walk only once the player is within `reach` px of the target, so a caller
 * whose real target sits one square beyond the walk point can demand a tighter
 * margin before the walk is abandoned.
 */
export async function movePlayerNear(
	page: Page,
	worldX: number,
	worldY: number,
	tolerance = 12,
	{ reach = MAX_INTERACTION_DISTANCE, timeout = 20_000 } = {},
): Promise<void> {
	await page.evaluate(
		async ({ worldX, worldY, tolerance, reach, timeout }) => {
			const world = document.querySelector(".farm-map-page");
			const codeFor = (key: string) => `Key${key.toUpperCase()}`;
			const held = new Set<string>();
			const setKeys = (want: Set<string>) => {
				for (const key of [...held]) {
					if (want.has(key)) continue;
					window.dispatchEvent(new KeyboardEvent("keyup", { code: codeFor(key) }));
					held.delete(key);
				}
				for (const key of want) {
					if (held.has(key)) continue;
					window.dispatchEvent(new KeyboardEvent("keydown", { code: codeFor(key) }));
					held.add(key);
				}
			};
			const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
			const deadline = performance.now() + timeout;
			let previous = Number.POSITIVE_INFINITY;
			let stalled = 0;
			let direction = "";
			try {
				for (;;) {
					const x = Number(world?.getAttribute("data-player-x"));
					const y = Number(world?.getAttribute("data-player-y"));
					if (!Number.isFinite(x) || !Number.isFinite(y)) break;
					const dx = worldX - x;
					const dy = worldY - y;
					const distance = Math.hypot(dx, dy);
					if (distance <= tolerance) break;
					if (distance >= previous - 1) stalled += 1;
					else stalled = 0;
					previous = distance;
					// A slow runner can lag the game loop behind the poll and look
					// stalled; only bail out after a long pause and only when the point
					// the caller will actually act on is already reachable.
					if (stalled > 30 && distance <= reach) break;
					if (performance.now() > deadline) break;
					const keys: string[] = [];
					if (Math.abs(dx) > tolerance * 0.5) keys.push(dx > 0 ? "d" : "a");
					if (Math.abs(dy) > tolerance * 0.5) keys.push(dy > 0 ? "s" : "w");
					if (keys.length === 0) break;
					// Turning is progress: a new direction should not inherit the
					// stalled count from the old one.
					if (keys.join() !== direction) stalled = 0;
					direction = keys.join();
					setKeys(new Set(keys));
					await sleep(16);
				}
			} finally {
				setKeys(new Set());
			}
		},
		{ worldX, worldY, tolerance, reach, timeout },
	);
}
