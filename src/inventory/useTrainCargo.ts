import { useState } from "react";
import { depositTarget } from "../../shared/train";
import { emitTrainAction } from "../socket";
import { useGameStore } from "../store";
import {
	freeSpaceFor,
	type SlotRef,
	useInventoryStore,
} from "./inventoryStore";
import { getItemDef, type ItemId } from "./items";

export interface TrainCargoControls {
	message: string | null;
	/** Loads the stack in one player inventory slot into the first cart with room. */
	depositFrom: (ref: SlotRef) => void;
	/** Unloads as much of a cart's item as the inventory can hold. */
	withdraw: (cartIndex: number, item: ItemId) => void;
}

/**
 * Load/unload actions for the train cargo window. The server owns the cargo, so
 * each move is optimistic locally and reconciled against the `farmUpdate`
 * broadcast; a rejected move restores the player inventory. Mirrors
 * `useBarnStorage`.
 */
export function useTrainCargo(owner: string): TrainCargoControls {
	const train = useGameStore((s) => s.activeFarm?.train);
	const [message, setMessage] = useState<string | null>(null);

	function depositFrom(ref: SlotRef) {
		const state = useInventoryStore.getState();
		const slot = state[ref.area][ref.index];
		if (!slot?.itemId || slot.count <= 0) return;
		const item = slot.itemId;
		const target = depositTarget(train?.carts ?? [], item);
		if (!target || target.room <= 0) {
			setMessage("The train is full.");
			return;
		}
		const amount = Math.min(slot.count, target.room);
		state.removeAt(ref, amount);
		emitTrainAction(owner, { kind: "deposit", item, count: amount }, (res) => {
			if (!res.ok) {
				useInventoryStore.getState().addItem(item, amount);
				setMessage(res.error ?? "Could not load the cargo.");
				return;
			}
			setMessage(`Loaded ${amount} × ${getItemDef(item).name}.`);
		});
	}

	function withdraw(cartIndex: number, item: ItemId) {
		const cart = train?.carts.find(
			(candidate) => candidate.index === cartIndex,
		);
		const stored = cart?.cargo[item] ?? 0;
		if (stored <= 0) return;
		const room = freeSpaceFor(useInventoryStore.getState(), item);
		if (room <= 0) {
			setMessage("Your inventory is full.");
			return;
		}
		const amount = Math.min(stored, room);
		emitTrainAction(
			owner,
			{ kind: "withdraw", item, count: amount, cart: cartIndex },
			(res) => {
				if (!res.ok) {
					setMessage(res.error ?? "Could not unload the cargo.");
					return;
				}
				useInventoryStore.getState().addItem(item, amount);
				setMessage(`Unloaded ${amount} × ${getItemDef(item).name}.`);
			},
		);
	}

	return { message, depositFrom, withdraw };
}
