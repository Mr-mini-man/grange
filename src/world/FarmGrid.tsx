import {
	CROPS,
	FARM_GRID_SIZE,
	farmTileKey,
	type CropId,
	type FarmTile,
} from "../../shared/farm";
import { emitFarmAction, type FarmAction } from "../socket";
import { CROP_COLORS, CROP_INITIAL, TILE_LABEL } from "./farmUi";

interface FarmGridProps {
	tiles: FarmTile[];
	tool: FarmAction;
	crop: CropId;
}

const STATE_CLASS: Record<string, string> = {
	tilled: "farm-cell--tilled",
	planted: "farm-cell--planted",
	watered: "farm-cell--watered",
	ready: "farm-cell--ready",
};

export default function FarmGrid({ tiles, tool, crop }: FarmGridProps) {
	const byKey = new Map(tiles.map((t) => [farmTileKey(t.x, t.y), t]));
	const cells = [];

	for (let y = 0; y < FARM_GRID_SIZE; y += 1) {
		for (let x = 0; x < FARM_GRID_SIZE; x += 1) {
			const tile = byKey.get(farmTileKey(x, y));
			const stateClass = tile ? STATE_CLASS[tile.state] : "";
			const label = tile ? TILE_LABEL[tile.state] : "Untilled ground";
			const fill =
				tile && tile.state !== "tilled"
					? { background: CROP_COLORS[tile.cropId] }
					: undefined;
			cells.push(
				<button
					key={farmTileKey(x, y)}
					type="button"
					data-testid={`farm-cell-${x}-${y}`}
					title={`${label} (${x}, ${y})`}
					onClick={() =>
						emitFarmAction(tool, x, y, tool === "plant" ? crop : undefined)
					}
					className={`farm-cell ${stateClass}`}
					style={fill}
				>
					{tile && tile.state !== "tilled" ? CROP_INITIAL[tile.cropId] : ""}
				</button>,
			);
		}
	}

	return (
		<div className="farm-grid-wrap">
			<p className="farm-grid-hint">
				Selected tool: <strong>{tool}</strong>
				{tool === "plant" ? ` (${CROPS[crop].name} seeds)` : ""} — click a plot
			</p>
			<div className="farm-grid">{cells}</div>
		</div>
	);
}
