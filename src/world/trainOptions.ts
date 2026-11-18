import { useGameStore } from "../store";
import type { TrainOptions } from "./train";

/** Live train reads for a scene's controller, sourced from the active farm. */
export function farmTrainOptions(): TrainOptions {
	return {
		getEngine: () => useGameStore.getState().activeFarm?.train?.engine ?? 0,
		getCarts: () => useGameStore.getState().activeFarm?.train?.carts ?? [],
	};
}
