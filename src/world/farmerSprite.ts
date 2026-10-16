import * as ex from "excalibur";
import type { InputVector } from "./InputManager";

// The source image contains three 64×64 forward-facing walking frames.
export const farmerImage = new ex.ImageSource(
	"/assets/player_model/Farmer Forwards-Sheet.png",
	{ filtering: ex.ImageFiltering.Pixel },
);

export function addFarmerGraphics(player: ex.Actor): void {
	const sheet = ex.SpriteSheet.fromImageSource({
		image: farmerImage,
		grid: { rows: 1, columns: 3, spriteWidth: 64, spriteHeight: 64 },
	});
	player.graphics.add("idle", sheet.getSprite(1, 0));
	player.graphics.add(
		"walk",
		ex.Animation.fromSpriteSheet(sheet, [0, 1, 2, 1], 140),
	);
	player.graphics.use("idle");
}

export function updateFarmerGraphics(
	player: ex.Actor,
	direction: InputVector,
): void {
	const graphic = direction.x === 0 && direction.y === 0 ? "idle" : "walk";
	if (player.graphics.current !== player.graphics.getGraphic(graphic)) {
		player.graphics.use(graphic);
	}
}
