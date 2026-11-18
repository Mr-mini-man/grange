import { parseSlotRef, SLOT_DRAG_TYPE } from "./dragTypes";
import type { SlotRef } from "./inventoryStore";
import { getItemDef, type ItemId } from "./items";
import { SlotIcon } from "./SlotIcon";

interface Props {
	/** The cart this slot belongs to, used for the testid and withdrawal. */
	cartIndex: number;
	/** Position within the cart (0-based), for the testid. */
	slotIndex: number;
	itemId: ItemId | null;
	count: number;
	/** Clicking a loaded stack unloads it back into the inventory. */
	onWithdraw: (cartIndex: number, itemId: ItemId) => void;
	/** Dropping a player inventory stack here loads it into the train. */
	onDeposit: (from: SlotRef) => void;
}

/** One cargo slot in a cart: click to unload, or drop an inventory stack. */
export function CargoSlot({
	cartIndex,
	slotIndex,
	itemId,
	count,
	onWithdraw,
	onDeposit,
}: Props) {
	const def = itemId ? getItemDef(itemId) : null;

	function onDragOver(e: React.DragEvent) {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	}

	function onDrop(e: React.DragEvent) {
		e.preventDefault();
		const from = parseSlotRef(e.dataTransfer.getData(SLOT_DRAG_TYPE));
		if (from) onDeposit(from);
	}

	return (
		<button
			type="button"
			aria-label={
				def
					? `Unload ${def.name}${count > 1 ? ` × ${count}` : ""}`
					: "Empty cargo slot"
			}
			data-testid={`train-cargo-slot-${cartIndex}-${slotIndex}`}
			data-item={itemId ?? ""}
			data-count={count}
			title={def ? `${def.name} — click to unload` : "Empty cargo slot"}
			className={`inv-slot${itemId ? " inv-slot-filled" : ""}`}
			onDragOver={onDragOver}
			onDrop={onDrop}
			onClick={() => itemId && onWithdraw(cartIndex, itemId)}
		>
			<SlotIcon itemId={itemId} />
			{def && count > 1 && <span className="inv-count">{count}</span>}
		</button>
	);
}
