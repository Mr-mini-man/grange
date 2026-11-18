import { useEffect } from "react";
import { useGameStore } from "../store";
import { TrainCargoWindow } from "../inventory/TrainCargoWindow";
import { useInventoryStore } from "../inventory/inventoryStore";

/**
 * Renders the train cargo window from within the HUD. It reads the owner and
 * the open flag from the stores so `FarmMap` stays small, and only the owner of
 * the visited farm ever sees it (cargo is owner-only, like the barn).
 */
export function TrainCargoOverlay() {
	const open = useInventoryStore((s) => s.trainCargoOpen);
	const setOpen = useInventoryStore((s) => s.setTrainCargoOpen);
	const username = useGameStore((s) => s.username);
	const owner = useGameStore((s) => s.activeFarm?.owner);

	// Leaving the world unmounts the overlay; make sure the flag resets.
	useEffect(() => () => setOpen(false), [setOpen]);

	if (!open || !owner || owner !== username) return null;
	return <TrainCargoWindow owner={owner} onClose={() => setOpen(false)} />;
}
