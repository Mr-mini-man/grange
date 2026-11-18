import { totalCargoSlots } from "../../shared/train";
import { useGameStore } from "../store";
import { GenericCategoryGrid } from "./MarketCards";
import type { MarketItemControl } from "./MarketWindow";
import type { MarketItemId } from "./marketData";

interface TrainDepotStallProps {
	controls: Record<MarketItemId, MarketItemControl>;
}

/**
 * The Train Depot: a summary line for the current train plus the upgrade grid.
 * Reuses the generic category grid so the cards match the rest of the market.
 */
export function TrainDepotStall({ controls }: TrainDepotStallProps) {
	const train = useGameStore((s) => s.activeFarm?.train);
	const engine = train?.engine ?? 0;
	const carts = train?.carts.length ?? 1;

	return (
		<section className="market-produce" aria-label="Train depot">
			<p className="market-description" data-testid="train-depot-summary">
				Engine Mk {engine + 1} · {carts} cart{carts === 1 ? "" : "s"} ·{" "}
				{totalCargoSlots(train)} cargo slots
			</p>
			<div
				className="market-subtabs"
				role="tablist"
				aria-label="Train depot categories"
			>
				<button
					type="button"
					role="tab"
					aria-selected
					className="market-subtab market-subtab-active"
					data-testid="market-subtab-train"
				>
					Train
				</button>
			</div>
			<GenericCategoryGrid categoryId="train" controls={controls} />
		</section>
	);
}
