import { BREWERY_COST, POTION_IDS, POTIONS } from "../../shared/brewing";
import type { CropId } from "../../shared/farm";
import { emitBrew, emitBuildBrewery, emitUsePotion } from "../socket";
import { useGameStore } from "../store";
import { EFFECT_LABEL, cropName } from "./farmUi";

export default function BreweryPanel() {
	const farm = useGameStore((s) => s.farm);
	if (!farm) return null;
	const { inventory: inv, brewery } = farm;

	if (!brewery.built) {
		return (
			<div className="farm-panel" data-testid="brewery-panel">
				<h3 className="farm-panel-title">Your Brewery</h3>
				<p className="farm-panel-note">
					Build a brewery to turn crops into effect potions.
				</p>
				<ul className="farm-cost">
					<li>Wood: {BREWERY_COST.wood} (have {inv.wood})</li>
					<li>Stone: {BREWERY_COST.stone} (have {inv.stone})</li>
					<li>Coins: {BREWERY_COST.coins} (have {inv.coins})</li>
				</ul>
				<button
					type="button"
					data-testid="build-brewery"
					className="farm-primary"
					onClick={() => emitBuildBrewery()}
				>
					Build Brewery
				</button>
			</div>
		);
	}

	return (
		<div className="farm-panel" data-testid="brewery-panel">
			<h3 className="farm-panel-title">Your Brewery</h3>
			<p className="farm-panel-note">
				Brew from harvested crops, then drink a potion for its effect.
			</p>
			{POTION_IDS.map((id) => {
				const potion = POTIONS[id];
				return (
					<div key={id} className="farm-recipe">
						<div className="farm-recipe-head">
							<strong>{potion.name}</strong>
							<span className="farm-have">have {inv.potions[id]}</span>
						</div>
						<p className="farm-recipe-effect">{EFFECT_LABEL[potion.effect]}</p>
						<p className="farm-recipe-ing">
							{Object.entries(potion.recipe)
								.map(
									([crop, count]) =>
										`${count} ${cropName(crop as CropId)}`,
								)
								.join(" + ")}
						</p>
						<div className="farm-row">
							<button
								type="button"
								className="farm-primary"
								onClick={() => emitBrew(id)}
							>
								Brew
							</button>
							<button
								type="button"
								className="farm-secondary"
								disabled={inv.potions[id] <= 0}
								onClick={() => emitUsePotion(id)}
							>
								Drink
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
}
