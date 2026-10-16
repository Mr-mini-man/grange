import type * as ex from "excalibur";
import type { CasinoAssetKey } from "./casinoData";
import { image } from "./resources";

export const casinoImages: Record<CasinoAssetKey, ex.ImageSource> = {
	"wood-light": image("casino/tiles/wood-light.webp"),
	"wood-dark": image("casino/tiles/wood-dark.webp"),
	"rug-square": image("casino/tiles/rug-square.webp"),
	"rug-horizontal": image("casino/tiles/rug-horizontal.webp"),
	"rug-vertical": image("casino/tiles/rug-vertical.webp"),
	"rug-corner": image("casino/tiles/rug-corner.webp"),
	"wall-panel": image("casino/architecture/wall-panel.webp"),
	"wall-post": image("casino/architecture/wall-post.webp"),
	"wall-corner-left": image("casino/architecture/wall-corner-left.webp"),
	"wall-corner": image("casino/architecture/wall-corner.webp"),
	doorway: image("casino/architecture/doorway.webp"),
	railing: image("casino/architecture/railing.webp"),
	"poker-table": image("casino/games/poker-table.webp"),
	"blackjack-table": image("casino/games/blackjack-table.webp"),
	"roulette-table": image("casino/games/roulette-table.webp"),
	"slot-machine": image("casino/games/slot-machine.webp"),
	"cashier-desk": image("casino/furniture/cashier-desk.webp"),
	"chair-front-left": image("casino/furniture/chair-front-left.webp"),
	"chair-left": image("casino/furniture/chair-left.webp"),
	"chair-front-right": image("casino/furniture/chair-front-right.webp"),
	"chair-right": image("casino/furniture/chair-right.webp"),
	stool: image("casino/furniture/stool.webp"),
	chips: image("casino/decor/chips.webp"),
	cards: image("casino/decor/cards.webp"),
	lamp: image("casino/decor/lamp.webp"),
	plant: image("casino/decor/plant.webp"),
	sign: image("casino/decor/sign.webp"),
};

export const casinoResources = Object.values(casinoImages);
