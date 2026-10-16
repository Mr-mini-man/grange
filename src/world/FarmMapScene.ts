import * as ex from "excalibur";
import { moveSpeedMultiplier } from "../../shared/brewing";
import type { FarmTileState, FarmToolId } from "../../shared/farm";
import { isFarmInBounds } from "../../shared/farm";
import type { FarmAction } from "../../shared/types";
import { isInventoryBlockingInput } from "../inventory/inventoryStore";
import { emitFarmAction } from "../socket";
import { useGameStore } from "../store";
import {
	BlockRegistry,
	decorByTile,
	groundFootprintTiles,
	rectFootprintTiles,
} from "./blocking";
import { CropLayer } from "./cropLayer";
import { FarmTravel } from "./FarmTravel";
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
	propBlocking,
	props,
	TILE_SIZE,
	terrainAt,
} from "./mapData";
import { updateFarmPlayer } from "./playerMovement";
import { propImages, terrainFrames, terrainImage } from "./resources";
import { clearDecorAt, refreshTile } from "./tileSync";
import type { WorldArea } from "./WalkingScene";

export class FarmMapScene extends ex.Scene {
	onFarmUpdate: ((snapshot: FarmHudSnapshot) => void) | null = null;

	private inputManager!: InputManager;
	private player!: ex.Actor;

	private sheet!: ex.SpriteSheet;
	private terrain!: ex.TileMap;
	private readonly crops = new CropLayer(this);
	// Growable set of tool-blocked tiles, seeded from props below. Future
	// placeable fences will add/remove entries here at runtime.
	private readonly blocks = new BlockRegistry();
	// Created actors per prop index, so tilled-over decor can be removed.
	private readonly propActors: Array<ex.Actor | undefined> = [];
	private readonly decor = decorByTile(props);

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

		// 3. Populate Props and register their tool-blocked tiles
		props.forEach((prop, index) => {
			const source = propImages[prop.asset];
			const sprite = source.toSprite();
			const scale = prop.width / source.width;
			sprite.scale = ex.vec(scale, scale);

			const actor = new ex.Actor({
				pos: ex.vec(prop.x, prop.y),
				anchor: ex.vec(0.5, 1),
				z: 100 + Math.floor(prop.y),
			});
			actor.graphics.use(sprite);
			this.add(actor);
			this.propActors[index] = actor;

			const rule = propBlocking[prop.asset];
			if (rule === "rect") {
				this.blocks.add(
					`prop-${index}`,
					rectFootprintTiles(prop.x, prop.y, prop.width, source.height * scale),
				);
			} else if (rule === "base") {
				this.blocks.add(
					`prop-${index}`,
					groundFootprintTiles(prop.x, prop.y, prop.width),
				);
			}
		});

		// 4. Create Player Actor
		this.player = new ex.Actor({
			pos: ex.vec(FARM_PLAYER_SPAWN.x, FARM_PLAYER_SPAWN.y),
			width: 32,
			height: 32,
			color: ex.Color.fromHex("#ffcc00"), // Yellow box placeholder or attach player sprite
			anchor: ex.vec(0.5, 1),
			z: 200,
		});
		this.add(this.player);

		// 5. Tool input: click or drag to act on field tiles via the server
		const pointers = engine.input.pointers;
		pointers.primary.on("down", (evt) => {
			if (this.deactivated) return;
			this.painting = true;
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
			return;
		}

		// Poll input vector (normalized -1 to 1)
		const dir = this.inputManager.getMovementVector();

		// Swift Sip speeds the farmer up while it lasts.
		const effects = useGameStore.getState().activeFarm?.brewery.effects ?? [];
		updateFarmPlayer(this.player, dir, delta, moveSpeedMultiplier(effects, Date.now()));

		this.travel.update(this.player, this.inputManager, engine);

		this.handleToolKeys();
		this.syncTilesFromServer();
	}

	override onDeactivate(): void {
		// Clean up DOM listeners when scene changes or unmounts
		this.deactivated = true;
		this.painting = false;
		this.inputManager?.destroy();
		this.travel.deactivate();
	}

	private handleToolKeys(): void {
		// Tool selection lives on the hotbar; this only handles the contextual
		// action key that acts on the tile the player is standing on.
		if (this.isOwner && this.inputManager.consumePressed("Space")) {
			this.actOnPlayerTile();
		}
	}

	private actOnPlayerTile(): void {
		const column = Math.floor(this.player.pos.x / TILE_SIZE);
		const row = Math.floor(this.player.pos.y / TILE_SIZE);
		if (!isFarmInBounds(column, row)) return;
		this.emitToolAction(column, row);
	}

	/** Emits the current tool's action, tagging the selected crop when planting. */
	private emitToolAction(column: number, row: number): void {
		const state = useGameStore.getState();
		const kind = TOOL_KIND[state.tool];
		const action: FarmAction = { kind, x: column, y: row };
		if (kind === "plant") action.crop = state.crop;
		emitFarmAction(this.owner, action);
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

		this.emitToolAction(column, row);
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
				clearDecorAt(this.decor, this.propActors, props, key);
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
