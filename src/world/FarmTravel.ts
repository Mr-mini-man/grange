import type * as ex from "excalibur";
import { useInventoryStore } from "../inventory/inventoryStore";
import type { InputManager } from "./InputManager";
import { isNearFarmTrainCart, isNearFarmTrainEngine } from "./mapData";
import type { TrainController } from "./train";
import type { WorldArea } from "./WalkingScene";

const BOARD_PROMPT = "Press E or Enter to board the train";
const CARGO_PROMPT = "Press E to load the train";

export class FarmTravel {
	private activePrompt: string | null = null;

	constructor(
		private readonly onPromptChange: (prompt: string | null) => void,
		private readonly onAreaChange: (area: WorldArea) => void,
		private readonly onOpenMenu: () => void,
		private readonly isOwner: boolean,
	) {}

	activate(): void {
		this.onAreaChange("Farm");
		this.setPrompt(null);
	}

	update(
		player: ex.Actor,
		input: InputManager,
		train: TrainController,
		gatePrompt: string | null = null,
		housePrompt: string | null = null,
		onOpenHouse: (() => void) | null = null,
	): void {
		// A nearby gate or barn owns the prompt and the E key while in range.
		if (gatePrompt) {
			this.setPrompt(gatePrompt);
			return;
		}
		if (housePrompt && onOpenHouse) {
			this.setPrompt(housePrompt);
			if (input.consumePress("KeyE", "Enter")) onOpenHouse();
			return;
		}
		// The engine end boards the train; the cart end opens its cargo.
		if (isNearFarmTrainEngine(player.pos.x, player.pos.y) && train.canBoard()) {
			this.setPrompt(BOARD_PROMPT);
			if (input.consumePress("KeyE", "Enter")) {
				this.setPrompt(null);
				this.onOpenMenu();
			}
			return;
		}
		if (this.isOwner && isNearFarmTrainCart(player.pos.x, player.pos.y)) {
			this.setPrompt(CARGO_PROMPT);
			if (input.consumePress("KeyE", "Enter")) {
				this.setPrompt(null);
				useInventoryStore.getState().setTrainCargoOpen(true);
			}
			return;
		}
		this.setPrompt(null);
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
