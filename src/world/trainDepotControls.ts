import {
	maxCartsForEngine,
	TRAIN_MAX_CART_TIER,
	TRAIN_MAX_ENGINE,
	TRAIN_UPGRADE_PRICES,
	type TrainUpgradeId,
} from "../../shared/train";
import type { TrainView } from "../../shared/types";
import type { MarketItemControl } from "./MarketWindow";

/** The part of a market control the depot derives; `onAction` is added later. */
export type TrainUpgradeControl = Omit<MarketItemControl, "onAction">;

/**
 * The depot's per-item state for the current train. Pure so the disabling and
 * labels can be unit-tested without a store or a network.
 */
export function trainUpgradeControl(
	id: TrainUpgradeId,
	train: TrainView | undefined,
	isOwner: boolean,
	balance: number,
): TrainUpgradeControl {
	const engine = train?.engine ?? 0;
	const carts = train?.carts ?? [];
	const price = TRAIN_UPGRADE_PRICES[id];

	if (id === "train-engine") {
		const maxed = engine >= TRAIN_MAX_ENGINE;
		return {
			owned: engine,
			disabled: !isOwner || maxed || balance < price,
			actionLabel: maxed ? "Max" : "Upgrade",
		};
	}

	if (id === "train-cart") {
		const maxed = carts.length >= maxCartsForEngine(engine);
		return {
			owned: carts.length,
			disabled: !isOwner || maxed || balance < price,
			actionLabel: maxed ? "Max" : "Add Cart",
		};
	}

	const upgradable = carts.filter((cart) => cart.tier < TRAIN_MAX_CART_TIER);
	const maxed = upgradable.length === 0;
	return {
		owned: carts.length - upgradable.length,
		disabled: !isOwner || maxed || balance < price,
		actionLabel: maxed ? "Max" : "Upgrade",
	};
}
