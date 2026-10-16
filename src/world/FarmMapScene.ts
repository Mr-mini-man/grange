import * as ex from "excalibur";
import { moveSpeedMultiplier } from "../../shared/brewing";
import type { FarmTileState, FarmToolId } from "../../shared/farm";
import { isFarmInBounds } from "../../shared/farm";
import type { FarmAction } from "../../shared/types";
import { emitFarmAction } from "../socket";
import { useGameStore } from "../store";
import { isInventoryBlockingInput } from "../inventory/inventoryStore";
import { BlockRegistry } from "./blocking";
import { CropLayer } from "./cropLayer";
import { FenceLayer } from "./fenceRendering";
import { actOnFence, selectedFarmItem } from "./fenceActions";
import { handleFarmPropClick } from "./farmPropActions";
import { FarmPropLayer } from "./farmPropLayer";
import { FarmTravel } from "./FarmTravel";
import { addFarmerGraphics, updateFarmerGraphics } from "./farmerSprite";
import type { FarmHoveredTile, FarmHudSnapshot } from "./farmHud";
import { TOOL_HINTS, TOOL_KIND } from "./farmTools";
import { InputManager } from "./InputManager";
import {
	FARM_PLAYER_SPAWN,
	isTillableTile,
	MAP_COLUMNS,
	MAP_HEIGHT,
	MAP_ROWS,
	MAP_WIDTH,
	TILE_SIZE,
	terrainAt,
} from "./mapData";
import { updateFarmPlayer } from "./playerMovement";
import { actOnPlayerFarmTile, consumeSeedAt } from "./playerFarmAction";
import { terrainFrames, terrainImage } from "./resources";
import { refreshTile } from "./tileSync";
import type { WorldArea } from "./WalkingScene";

export class FarmMapScene extends ex.Scene {
	onFarmUpdate: ((snapshot: FarmHudSnapshot) => void) | null = null;

	private inputManager!: InputManager;
	private player!: ex.Actor;

	private sheet!: ex.SpriteSheet;
	private terrain!: ex.TileMap;
	private readonly crops = new CropLayer(this);
	// Growable tool-blocked tiles, including the live placed-fence layer.
	private readonly blocks = new BlockRegistry();
	private readonly fences = new FenceLayer(this, this.blocks);
	private readonly farmProps = new FarmPropLayer(this, this.blocks);

	// Last server tile states by field key, so only changed map tiles refresh.
	private readonly synced = new Map<string, FarmTileState>();
	private painting = false;
	private readonly strokeTiles = new Set<string>();
	private message = TOOL_HINTS.hoe;
	private hovered: FarmHoveredTile | null = null;
	private lastWorldPos: ex.Vector | null = null;
	private deactivated = false;
	private lastTomatoes = -1;
	private readonly travel: FarmTravel;

	constructor(
		private readonly owner: string,
		private readonly isOwner: boolean,
		onPromptChange: (prompt: string | null) => void,
		onAreaChange: (area: WorldArea) => void,
	) {
		super();
		this.travel = new FarmTravel(onPromptChange, onAreaChange);
	}

	override onInitialize(engine: ex.Engine): void {
		this.backgroundColor = ex.Color.fromHex("#79a44d");

		// 1. Initialize standalone input listener
		this.inputManager = new InputManager();

		// 2. Build Terrain TileMap
		this.sheet = ex.SpriteSheet.fromImageSource({
			image: terrainImage,
			grid: {
				rows: 4,
				columns: 4,
				spriteWidth: TILE_SIZE,
				spriteHeight: TILE_SIZE,
			},
		});

		this.terrain = new ex.TileMap({
			pos: ex.vec(0, 0),
			tileWidth: TILE_SIZE,
			tileHeight: TILE_SIZE,
			columns: MAP_COLUMNS,
			rows: MAP_ROWS,
			renderFromTopOfGraphic: true,
		});

		for (let row = 0; row < MAP_ROWS; row += 1) {
			for (let column = 0; column < MAP_COLUMNS; column += 1) {
				const frame = terrainFrames[terrainAt(column, row)];
				this.terrain
					.getTile(column, row)
					?.addGraphic(this.sheet.getSprite(frame.column, frame.row));
			}
		}
		this.add(this.terrain);

		// 3. Populate saved farm props and their collision/tool footprints.
		this.farmProps.set(useGameStore.getState().activeFarm?.prop_overrides ?? []);
		this.fences.set(useGameStore.getState().activeFarm?.fences ?? []);

		// 4. Create Player Actor
		this.player = new ex.Actor({
			pos: ex.vec(FARM_PLAYER_SPAWN.x, FARM_PLAYER_SPAWN.y),
			width: 32,
			height: 32,
			anchor: ex.vec(0.5, 1),
			z: 200,
		});
		addFarmerGraphics(this.player);
		this.add(this.player);

		// 5. Tool input: click or drag to act on field tiles via the server
		const pointers = engine.input.pointers;
		pointers.primary.on("down", (evt) => {
			if (this.deactivated || isInventoryBlockingInput()) return;
			const item = selectedFarmItem();
			this.painting = item === "hoe" || item === "seed-bag" ||
				item === "watering-can" || item === "scythe";
			this.strokeTiles.clear();
			this.applyToolAt(evt.worldPos);
		});
		pointers.primary.on("move", (evt) => {
			if (this.deactivated) return;
			this.updateHover(evt.worldPos);
			if (this.painting) this.applyToolAt(evt.worldPos);
		});
		pointers.primary.on("up", () => {
			this.painting = false;
			this.strokeTiles.clear();
		});

		// Center camera initially
		this.camera.pos = ex.vec(MAP_WIDTH / 2, MAP_HEIGHT / 2);
		this.message = TOOL_HINTS[useGameStore.getState().tool] ?? this.message;
		this.emitHud();
	}

	setTool(tool: FarmToolId): void {
		useGameStore.getState().setTool(tool);
		this.message = TOOL_HINTS[tool];
		this.emitHud();
	}

	override onActivate(): void {
		if (this.deactivated) this.inputManager = new InputManager();
		this.deactivated = false;
		this.travel.activate();
	}

	override onPreUpdate(engine: ex.Engine, delta: number): void {
		// Freeze movement while the inventory modal captures input.
		if (isInventoryBlockingInput()) {
			this.player.vel = ex.vec(0, 0);
			updateFarmerGraphics(this.player, { x: 0, y: 0 });
			return;
		}

		// Poll input vector (normalized -1 to 1)
		const dir = this.inputManager.getMovementVector();

		// Swift Sip speeds the farmer up while it lasts.
		const effects = useGameStore.getState().activeFarm?.brewery.effects ?? [];
		updateFarmPlayer(this.player, dir, delta, moveSpeedMultiplier(effects, Date.now()));
		updateFarmerGraphics(this.player, dir);

		this.travel.update(this.player, this.inputManager, engine);

		if (this.isOwner && this.inputManager.consumePressed("Space")) {
			actOnPlayerFarmTile(this.owner, this.player.pos.x, this.player.pos.y,
				(message) => { this.message = message; this.emitHud(); });
		}
		this.syncTilesFromServer();
		this.farmProps.set(useGameStore.getState().activeFarm?.prop_overrides ?? []);
		this.fences.set(useGameStore.getState().activeFarm?.fences ?? []);
	}

	override onDeactivate(): void {
		// Clean up DOM listeners when scene changes or unmounts
		this.deactivated = true;
		this.painting = false;
		this.inputManager?.destroy();
		this.travel.deactivate();
	}

	private applyToolAt(worldPos: ex.Vector): void {
		const column = Math.floor(worldPos.x / TILE_SIZE);
		const row = Math.floor(worldPos.y / TILE_SIZE);
		if (column < 0 || row < 0 || column >= MAP_COLUMNS || row >= MAP_ROWS)
			return;

		const strokeKey = `${column},${row}`;
		this.updateHover(worldPos);
		if (this.strokeTiles.has(strokeKey)) return;
		this.strokeTiles.add(strokeKey);

		if (!this.isOwner) {
			this.message = "Visitors can't farm here.";
			this.emitHud();
			return;
		}

		const item = selectedFarmItem();
		if (handleFarmPropClick(item, worldPos, this.farmProps,
			useGameStore.getState().activeFarm, this.owner, this.player.pos,
			(message) => { this.message = message; this.emitHud(); })) return;
		if (item === "fence" || item === "shovel") {
			actOnFence(this.owner, column, row, item, this.blocks, this.player.pos, (message) => {
				this.message = message;
				this.emitHud();
			});
			return;
		}
		if (!item) {
			this.message = "Select a tool or item first.";
			this.emitHud();
			return;
		}

		if (this.blocks.isBlocked(column, row)) {
			this.message = "Something is in the way.";
			this.emitHud();
			return;
		}

		const tool = useGameStore.getState().tool;
		if (tool === "hoe") {
			if (!isTillableTile(column, row)) {
				this.message = "Hoe only works on grass.";
				this.emitHud();
				return;
			}
			if (!isFarmInBounds(column, row)) {
				this.message = "Too far out to farm.";
				this.emitHud();
				return;
			}
		} else if (!isFarmInBounds(column, row)) {
			this.message = "Too far out to farm.";
			this.emitHud();
			return;
		}

		if (tool === "seed" && !consumeSeedAt(column, row,
			(message) => { this.message = message; this.emitHud(); })) return;

		const action: FarmAction = { kind: TOOL_KIND[tool], x: column, y: row };
		if (action.kind === "plant") action.crop = useGameStore.getState().crop;
		emitFarmAction(this.owner, action);
	}

	/** Reconciles server tiles into terrain + crop visuals. Server tiles use
	 * map coordinates directly so open-map hoeing (blocking, decor, hover)
	 * keeps working against the Phoenix backend. */
	private syncTilesFromServer(): void {
		const farm = useGameStore.getState().activeFarm;
		const live = new Set<string>();
		let changed = false;

		if (farm) {
			for (const tile of farm.tiles) {
				const key = `${tile.x},${tile.y}`;
				live.add(key);
				if (this.synced.get(key) === tile.state) continue;
				this.synced.set(key, tile.state);
				refreshTile(
					this.terrain,
					this.sheet,
					this.crops,
					tile.x,
					tile.y,
					tile.state,
				);
				changed = true;
			}
			if (farm.tomatoes !== this.lastTomatoes) {
				this.lastTomatoes = farm.tomatoes;
				changed = true;
			}
		}

		for (const key of [...this.synced.keys()]) {
			if (!live.has(key)) {
				const [fx, fy] = key.split(",").map(Number);
				refreshTile(this.terrain, this.sheet, this.crops, fx, fy, undefined);
				this.synced.delete(key);
				changed = true;
			}
		}

		if (changed) {
			// The hover readout snapshots tile state, so recompute it after
			// server flips or it would keep showing a stale state until the
			// next pointer move.
			if (this.lastWorldPos) this.updateHover(this.lastWorldPos);
			else this.emitHud();
		}
	}

	private updateHover(worldPos: ex.Vector): void {
		this.lastWorldPos = worldPos.clone();
		const column = Math.floor(worldPos.x / TILE_SIZE);
		const row = Math.floor(worldPos.y / TILE_SIZE);
		if (column < 0 || row < 0 || column >= MAP_COLUMNS || row >= MAP_ROWS) {
			this.hovered = null;
		} else {
			const farm = useGameStore.getState().activeFarm;
			const stored = farm?.tiles.find((t) => t.x === column && t.y === row);
			this.hovered = {
				column,
				row,
				state: stored?.state ?? terrainAt(column, row),
			};
		}
		this.emitHud();
	}

	private emitHud(): void {
		const farm = useGameStore.getState().activeFarm;
		this.onFarmUpdate?.({
			tomatoes: farm?.tomatoes ?? 0,
			message: this.message,
			hovered: this.hovered,
		});
	}
}
