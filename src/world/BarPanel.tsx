import { POTION_IDS, POTIONS } from "../../shared/brewing";
import { CROPS } from "../../shared/farm";
import { emitSellCrop, emitSellPotion } from "../socket";
import { useGameStore } from "../store";
import { CROP_ORDER, cropName } from "./farmUi";

export default function BarPanel() {
	const inv = useGameStore((s) => s.farm?.inventory);
	if (!inv) return null;

	return (
		<div className="farm-panel" data-testid="bar-panel">
			<h3 className="farm-panel-title">The Main-Island Bar</h3>
			<p className="farm-panel-note">
				The bar buys your potions and spare crops for grangecoins.
			</p>

			<h4 className="farm-subtitle">Potions</h4>
			<div className="farm-row">
				{POTION_IDS.map((id) => (
					<button
						key={id}
						type="button"
						className="farm-buy"
						disabled={inv.potions[id] <= 0}
						onClick={() => emitSellPotion(id)}
					>
						{POTIONS[id].name} · {POTIONS[id].barPrice}c
						<span className="farm-have">have {inv.potions[id]}</span>
					</button>
				))}
			</div>

			<h4 className="farm-subtitle">Crops</h4>
			<div className="farm-row">
				{CROP_ORDER.map((crop) => (
					<button
						key={crop}
						type="button"
						className="farm-buy"
						disabled={inv[crop] <= 0}
						onClick={() => emitSellCrop(crop)}
					>
						{cropName(crop)} · {CROPS[crop].cropPrice}c
						<span className="farm-have">have {inv[crop]}</span>
					</button>
				))}
			</div>
		</div>
	);
}
