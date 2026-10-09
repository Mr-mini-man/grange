import { MATERIALS } from "../../shared/brewing";
import { CROPS } from "../../shared/farm";
import { emitBuyMaterial, emitBuySeed } from "../socket";
import { useGameStore } from "../store";
import { CROP_ORDER, cropName } from "./farmUi";

export default function MarketPanel() {
	const inv = useGameStore((s) => s.farm?.inventory);
	if (!inv) return null;

	return (
		<div className="farm-panel" data-testid="market-panel">
			<h3 className="farm-panel-title">Main-Land Market</h3>
			<p className="farm-panel-note">
				Buy materials to build the brewery and seeds to plant.
			</p>

			<h4 className="farm-subtitle">Materials</h4>
			<div className="farm-row">
				{(Object.keys(MATERIALS) as (keyof typeof MATERIALS)[]).map((id) => (
					<button
						key={id}
						type="button"
						className="farm-buy"
						onClick={() => emitBuyMaterial(id)}
					>
						{MATERIALS[id].name} · {MATERIALS[id].price}c
						<span className="farm-have">have {inv[id]}</span>
					</button>
				))}
			</div>

			<h4 className="farm-subtitle">Seeds</h4>
			<div className="farm-row">
				{CROP_ORDER.map((crop) => (
					<button
						key={crop}
						type="button"
						className="farm-buy"
						onClick={() => emitBuySeed(crop)}
					>
						{cropName(crop)} seed · {CROPS[crop].seedPrice}c
						<span className="farm-have">
							have {inv[CROPS[crop].seedKey]}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}
