import * as ex from "excalibur";
import type { FarmTileState } from "../../shared/farm";
import { growthStage } from "./farmState";
import { TILE_SIZE } from "./mapData";
import { cropImages } from "./resources";

/** Owns the crop sprites planted on tilled tiles. `growthStage()` maps tile
 * state to sprite, so future intermediate stages only touch that helper. */
export class CropLayer {
	private readonly crops = new Map<string, ex.Actor>();

	constructor(private readonly scene: ex.Scene) {}

	sync(
		column: number,
		row: number,
		state: FarmTileState | undefined,
	): void {
		const key = `${column},${row}`;
		const stage = growthStage(state);
		const actor = this.crops.get(key);
		if (stage === "none") {
			actor?.kill();
			this.crops.delete(key);
			return;
		}
		const source =
			stage === "mature" ? cropImages["tomato-plant"] : cropImages.sprout;
		const sprite = source.toSprite();
		const targetHeight = stage === "mature" ? 52 : 30;
		const scale = targetHeight / source.height;
		sprite.scale = ex.vec(scale, scale);
		if (actor?.isActive) {
			actor.graphics.use(sprite);
			return;
		}
		this.crops.delete(key);
		const crop = new ex.Actor({
			pos: ex.vec(
				column * TILE_SIZE + TILE_SIZE / 2,
				row * TILE_SIZE + TILE_SIZE - CropLayer.baseLift,
			),
			anchor: ex.vec(0.5, 1),
			z: 10 + row,
		});
		crop.graphics.use(sprite);
		this.scene.add(crop);
		this.crops.set(key, crop);
	}

	private static readonly baseLift = 14;
}
