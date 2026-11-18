import type * as ex from "excalibur";
import { useInventoryStore } from "../inventory/inventoryStore";
import type { InputManager } from "./InputManager";
import {
	FARM_HOUSE_REACH,
	isNearFarmTrain,
	isNearFarmTrainCart,
} from "./mapData";
import type { TrainController } from "./train";
import type { WorldArea } from "./WalkingScene";

const BOARD_PROMPT = "Press E or Enter to board the train";
const CARGO_HINT = " · C to load the train";

interface ScenePosition {
	x: number;
	y: number;
}

export class FarmTravel {
	private activePrompt: string | null = null;

	constructor(
		private readonly onPromptChange: (prompt: string | null) => void,
		private readonly onAreaChange: (area: WorldArea) => void,
		private readonly onOpenMenu: () => void,
		private readonly isOwner: boolean,
	) {}

	/**
	 * The farmhouse prompt when the owner stands close enough to its prop, else
	 * null. Lives here because this class owns prompt priority.
	 */
	housePrompt(
		isOwner: boolean,
		player: ScenePosition,
		house: ScenePosition | null,
	): string | null {
		if (!isOwner || !house) return null;
		const distance = Math.hypot(player.x - house.x, player.y - house.y);
		return distance <= FARM_HOUSE_REACH
			? "Press E or Enter to enter the farmhouse"
			: null;
	}

	activate(): void {
		this.onAreaChange("Farm");
		this.setPrompt(null);
	}

	update(
		player: ex.Actor,
		input: InputManager,
		train: TrainController,
		gatePrompt: string | null = null,
		npcPrompt: string | null = null,
		onTalkToNpc: (() => void) | null = null,
		housePrompt: string | null = null,
		onOpenHouse: (() => void) | null = null,
	): void {
		// A nearby gate or barn owns the prompt and the E key while in range.
		if (gatePrompt) {
			this.setPrompt(gatePrompt);
			return;
		}
		// The farmhand stands beside the house, so he gets first claim on E
		// before the house menu.
		if (npcPrompt && onTalkToNpc) {
			this.setPrompt(npcPrompt);
			if (input.consumePress("KeyE", "Enter")) onTalkToNpc();
			return;
		}
		if (housePrompt && onOpenHouse) {
			this.setPrompt(housePrompt);
			if (input.consumePress("KeyE", "Enter")) onOpenHouse();
			return;
		}
		// Boarding works anywhere on the train; at the cart end the owner can
		// also press C to open the cargo window. Splitting the key keeps the
		// walk-up-and-board flow unchanged while cargo stays reachable.
		if (isNearFarmTrain(player.pos.x, player.pos.y) && train.canBoard()) {
			const atCarts =
				this.isOwner &&
				isNearFarmTrainCart(player.pos.x, player.pos.y);
			this.setPrompt(atCarts ? BOARD_PROMPT + CARGO_HINT : BOARD_PROMPT);
			if (input.consumePress("KeyE", "Enter")) {
				this.setPrompt(null);
				this.onOpenMenu();
				return;
			}
			if (atCarts && input.consumePress("KeyC")) {
				this.setPrompt(null);
				useInventoryStore.getState().setTrainCargoOpen(true);
				return;
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