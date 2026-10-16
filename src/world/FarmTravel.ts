import type * as ex from "excalibur";
import type { InputManager } from "./InputManager";
import { isNearFarmTrain } from "./mapData";
import type { WorldArea } from "./WalkingScene";

export class FarmTravel {
	private activePrompt: string | null = null;
	private traveling = false;

	constructor(
		private readonly onPromptChange: (prompt: string | null) => void,
		private readonly onAreaChange: (area: WorldArea) => void,
	) {}

	activate(): void {
		this.traveling = false;
		this.onAreaChange("Farm");
		this.setPrompt(null);
	}

	update(player: ex.Actor, input: InputManager, engine: ex.Engine): void {
		const nearTrain = isNearFarmTrain(player.pos.x, player.pos.y);
		this.setPrompt(
			nearTrain ? "Press E or Enter to travel to the marketplace" : null,
		);
		if (!nearTrain || this.traveling || !input.consumePress("KeyE", "Enter")) {
			return;
		}
		this.traveling = true;
		this.setPrompt(null);
		void engine.goToScene("marketplace");
	}

	deactivate(): void {
		this.setPrompt(null);
	}

	private setPrompt(prompt: string | null): void {
		if (this.activePrompt === prompt) return;
		this.activePrompt = prompt;
		this.onPromptChange(prompt);
	}
}
