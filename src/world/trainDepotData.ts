import { TRAIN_UPGRADE_PRICES, type TrainUpgradeId } from "../../shared/train";
import type { MarketItem } from "./marketData";

function trainItem(
	id: TrainUpgradeId,
	name: string,
	emoji: string,
	blurb: string,
): MarketItem {
	const price = TRAIN_UPGRADE_PRICES[id];
	return {
		id,
		name,
		emoji,
		kind: "buy",
		price,
		quantity: 1,
		blurb: `$${price} · ${blurb}`,
	};
}

/** The Train Depot's buy cards, spliced into the shared market registry. */
export const TRAIN_MARKET_ITEMS: Record<TrainUpgradeId, MarketItem> = {
	"train-engine": trainItem(
		"train-engine",
		"Engine Upgrade",
		"🚂",
		"Faster trips and one more cart.",
	),
	"train-cart": trainItem(
		"train-cart",
		"Extra Cart",
		"🛒",
		"Couple another cargo cart.",
	),
	"train-cart-upgrade": trainItem(
		"train-cart-upgrade",
		"Cart Upgrade",
		"📦",
		"Upgrade the smallest cart (+1 slot).",
	),
};
