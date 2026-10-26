import * as ex from "excalibur";
import type { ActiveFarm } from "../../shared/types";
import type { FarmPropLayer } from "./farmPropLayer";
import type { MovablePropKey } from "./mapData";
import { TILE_SIZE } from "./mapData";
import { footprintTileSpan, type PropPlacement, snapPropAnchor } from "./propPlacement";
import { propImages } from "./resources";

/** Ghost art plus a green/red ground-footprint grid while the mouse is held. */
export class FarmPlacementPreview {
	private asset: MovablePropKey | null = null;
	private ghost: ex.Actor | null = null;
	private grid: ex.Actor | null = null;
	private gridGraphic: ex.Canvas | null = null;
	private currentPlacement: PropPlacement | null = null;

	constructor(private scene: ex.Scene, private layer: FarmPropLayer) {}

	get active(): boolean { return this.asset !== null; }
	get selectedAsset(): MovablePropKey | null { return this.asset; }

	start(asset: MovablePropKey, pos: ex.Vector,
		player: { x: number; y: number }, farm: ActiveFarm): void {
		this.clear();
		this.asset = asset;
		const source = propImages[asset];
		const ghost = new ex.Actor({ pos: pos.clone(), anchor: ex.vec(0.5, 1), z: 3001 });
		const sprite = source.toSprite();
		const width = this.layer.placement(asset, 0, 0, player, farm)?.width;
		// The source width is fixed for each item; use the starter art's display width.
		if (width) sprite.scale = ex.vec(width / source.width, width / source.width);
		ghost.graphics.use(sprite);
		ghost.graphics.opacity = 0.55;
		this.ghost = ghost;
		this.grid = new ex.Actor({ anchor: ex.vec(0, 0), z: 3002 });
		this.scene.add(this.grid);
		this.scene.add(ghost);
		this.update(pos, player, farm);
	}

	update(pos: ex.Vector, player: { x: number; y: number },
		farm: ActiveFarm): PropPlacement | null {
		if (!this.asset || !this.ghost || !this.grid) return null;
		const { x, y } = snapPropAnchor(pos.x, pos.y);
		const placement = this.layer.placement(this.asset, x, y, player, farm);
		if (!placement) return null;
		this.currentPlacement = placement;
		this.ghost.pos = ex.vec(x, y);
		this.grid.pos = ex.vec(placement.ground.left, placement.ground.top);
		if (!this.gridGraphic) {
			this.gridGraphic = this.makeGrid(placement);
			this.grid.graphics.use(this.gridGraphic);
		} else this.gridGraphic.flagDirty();
		return placement;
	}

	finish(pos: ex.Vector, player: { x: number; y: number },
		farm: ActiveFarm): { asset: MovablePropKey; placement: PropPlacement } | null {
		const asset = this.asset;
		const placement = this.update(pos, player, farm);
		this.clear();
		return asset && placement ? { asset, placement } : null;
	}

	clear(): void {
		if (this.ghost) this.scene.remove(this.ghost);
		if (this.grid) this.scene.remove(this.grid);
		this.asset = null;
		this.ghost = null;
		this.grid = null;
		this.gridGraphic = null;
		this.currentPlacement = null;
	}

	private makeGrid(placement: PropPlacement): ex.Canvas {
		const width = Math.ceil(placement.ground.right - placement.ground.left);
		const height = Math.ceil(placement.ground.bottom - placement.ground.top);
		return new ex.Canvas({ width, height, draw: (ctx) => {
			const current = this.currentPlacement;
			if (!current) return;
			const valid = !current.reason;
			const { columns, rows } = footprintTileSpan(current.ground);
			ctx.fillStyle = valid ? "rgba(49, 210, 89, 0.5)" : "rgba(240, 55, 55, 0.56)";
			ctx.fillRect(0, 0, width, height);
			ctx.strokeStyle = valid ? "#b4ffae" : "#ffb2a8";
			ctx.lineWidth = 3;
			ctx.strokeRect(1.5, 1.5, width - 3, height - 3);
			ctx.lineWidth = 1;
			const firstX = Math.ceil(current.ground.left / TILE_SIZE) * TILE_SIZE - current.ground.left;
			const firstY = Math.ceil(current.ground.top / TILE_SIZE) * TILE_SIZE - current.ground.top;
			for (let x = firstX; x < width; x += TILE_SIZE) {
				ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
			}
			for (let y = firstY; y < height; y += TILE_SIZE) {
				ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
			}
			ctx.fillStyle = "#fff";
			ctx.font = "bold 14px sans-serif";
			ctx.fillText(`${columns} × ${rows}`, 8, Math.min(height - 8, 19));
		} });
	}
}
