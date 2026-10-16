import * as ex from "excalibur";
import type { MarketId } from "./marketData";
import {
	MARKETPLACE_CASINO_ENTRANCE,
	MARKETPLACE_PLAYER_SPAWN,
	MARKETPLACE_PRODUCE_MARKET_ENTRANCE,
	MARKETPLACE_SEED_MARKET_ENTRANCE,
	MARKETPLACE_TRAIN_STOP,
	marketplaceProps,
	marketplaceTerrainAt,
} from "./marketplaceData";
import { marketplaceImages } from "./marketplaceResources";
import { marketplaceWalkObstacles } from "./sceneObstacles";
import { addProps, addTerrain } from "./sceneRendering";
import { WalkingScene, type WorldArea } from "./WalkingScene";

export class MarketplaceScene extends WalkingScene {
	constructor(
		onPromptChange: (prompt: string | null) => void,
		onAreaChange: (area: WorldArea) => void,
		onOpenMarket: (market: MarketId) => void,
	) {
		super({
			area: "Marketplace",
			spawn: ex.vec(MARKETPLACE_PLAYER_SPAWN.x, MARKETPLACE_PLAYER_SPAWN.y),
			obstacles: marketplaceWalkObstacles,
			interactions: [
				{
					position: ex.vec(MARKETPLACE_TRAIN_STOP.x, MARKETPLACE_TRAIN_STOP.y),
					destination: "farm-map",
					prompt: "Press E or Enter to return to the farm",
				},
				{
					position: ex.vec(
						MARKETPLACE_CASINO_ENTRANCE.x,
						MARKETPLACE_CASINO_ENTRANCE.y,
					),
					destination: "casino",
					prompt: "Press E or Enter to enter the casino",
					radius: 105,
				},
				{
					position: ex.vec(
						MARKETPLACE_SEED_MARKET_ENTRANCE.x,
						MARKETPLACE_SEED_MARKET_ENTRANCE.y,
					),
					prompt: "Press E or Enter to enter the seed market",
					radius: 95,
					action: () => onOpenMarket("seed"),
				},
				{
					position: ex.vec(
						MARKETPLACE_PRODUCE_MARKET_ENTRANCE.x,
						MARKETPLACE_PRODUCE_MARKET_ENTRANCE.y,
					),
					prompt: "Press E or Enter to enter the produce market",
					radius: 95,
					action: () => onOpenMarket("produce"),
				},
			],
			onAreaChange,
			onPromptChange,
		});
	}

	override onInitialize(): void {
		this.backgroundColor = ex.Color.fromHex("#79a44d");
		addTerrain(this, marketplaceTerrainAt);
		addProps(this, marketplaceProps, marketplaceImages);
		this.addPlayer();
	}
}
