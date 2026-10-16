import { type CasinoAssetKey, casinoProps } from "./casinoData";
import { MAP_HEIGHT, MAP_WIDTH, type PropKey, props } from "./mapData";
import { type MarketplacePropKey, marketplaceProps } from "./marketplaceData";
import {
	type PropFootprint,
	propObstacles,
	type WalkObstacle,
} from "./walkCollisions";

const farmFootprints: Partial<Record<PropKey, PropFootprint>> = {
	farmhouse: { width: 0.9, depth: 130 },
	barn: { width: 0.9, depth: 135 },
	"oak-tree": { width: 0.38, depth: 27 },
	"pine-tree": { width: 0.35, depth: 25 },
	"apple-tree": { width: 0.38, depth: 27 },
	well: { width: 0.76, depth: 55 },
	bench: { width: 0.9, depth: 34 },
	sign: { width: 0.4, depth: 25 },
	barrel: { width: 0.75, depth: 30 },
	crate: { width: 0.8, depth: 30 },
	"fence-horizontal": { width: 1, depth: 25 },
	"fence-post": { width: 0.65, depth: 38 },
	"starter-train": { width: 0.9, depth: 65 },
};

const marketplaceFootprints: Partial<
	Record<MarketplacePropKey, PropFootprint>
> = {
	"seed-shop": { width: 0.9, depth: 115 },
	"produce-stall": { width: 0.9, depth: 110 },
	"game-hall": { width: 0.9, depth: 115 },
	"seed-display": { width: 0.85, depth: 45 },
	"produce-cart": { width: 0.85, depth: 55 },
	"notice-board": { width: 0.75, depth: 35 },
	signpost: { width: 0.35, depth: 25 },
	"starter-train": { width: 0.9, depth: 65 },
	"oak-tree": { width: 0.38, depth: 27 },
	"pine-tree": { width: 0.35, depth: 25 },
	barrel: { width: 0.75, depth: 28 },
	crate: { width: 0.8, depth: 28 },
};

const casinoFootprints: Partial<Record<CasinoAssetKey, PropFootprint>> = {
	"wall-panel": { width: 1, depth: 45 },
	"wall-post": { width: 0.8, depth: 55 },
	"poker-table": { width: 0.9, depth: 90 },
	"blackjack-table": { width: 0.9, depth: 90 },
	"roulette-table": { width: 0.9, depth: 90 },
	"chair-front-left": { width: 0.8, depth: 40 },
	"chair-front-right": { width: 0.8, depth: 40 },
	"slot-machine": { width: 0.85, depth: 55 },
	stool: { width: 0.7, depth: 28 },
	"cashier-desk": { width: 0.9, depth: 65 },
	lamp: { width: 0.5, depth: 22 },
	plant: { width: 0.55, depth: 35 },
	sign: { width: 0.55, depth: 25 },
};

export const farmWalkObstacles: WalkObstacle[] = [
	...propObstacles(props, farmFootprints),
	{ left: 0, right: MAP_WIDTH, top: 11 * 64, bottom: MAP_HEIGHT },
];

export const marketplaceWalkObstacles = propObstacles(
	marketplaceProps,
	marketplaceFootprints,
);

export const casinoWalkObstacles = propObstacles(casinoProps, casinoFootprints);
