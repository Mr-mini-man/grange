import {
	BREWERY_COST,
	MATERIALS,
	POTIONS,
	canBrew,
	canBuildBrewery,
	pruneEffects,
} from "../shared/brewing";
import {
	CROPS,
	type ActiveEffect,
	type CropId,
	type EffectKind,
	type MaterialId,
	type PotionId,
} from "../shared/farm";
import type { InMemoryFarmStore } from "./farm";

export type ActionResult = { ok: true } | { ok: false; error: string };

const OK: ActionResult = { ok: true };

function fail(error: string): ActionResult {
	return { ok: false, error };
}

/**
 * Owns the brewery economy: building the workshop, brewing crops into potions,
 * selling to the bar, and the timed effects those potions grant. It mutates a
 * shared {@link InMemoryFarmStore} for the player's crops, materials, and coins.
 */
export class InMemoryBreweryStore {
	private built = new Set<string>();
	private effects = new Map<string, ActiveEffect[]>();

	isBuilt(player: string): boolean {
		return this.built.has(player);
	}

	getEffects(player: string, now: number = Date.now()): ActiveEffect[] {
		const live = pruneEffects(this.effects.get(player) ?? [], now);
		this.effects.set(player, live);
		return live;
	}

	private addEffect(
		player: string,
		kind: EffectKind,
		durationMs: number,
		now: number,
	): void {
		const live = this.getEffects(player, now).filter((e) => e.kind !== kind);
		live.push({ kind, expiresAt: now + durationMs });
		this.effects.set(player, live);
	}

	build(farm: InMemoryFarmStore, player: string): ActionResult {
		if (this.isBuilt(player)) return fail("brewery already built");
		const inv = farm.getInventory(player);
		if (!canBuildBrewery(inv)) return fail("not enough materials or coins");
		inv.wood -= BREWERY_COST.wood;
		inv.stone -= BREWERY_COST.stone;
		inv.coins -= BREWERY_COST.coins;
		this.built.add(player);
		return OK;
	}

	buyMaterial(
		farm: InMemoryFarmStore,
		player: string,
		material: MaterialId,
		quantity = 1,
	): ActionResult {
		const info = MATERIALS[material];
		if (!info || quantity < 1) return fail("unknown material");
		const cost = info.price * quantity;
		const inv = farm.getInventory(player);
		if (inv.coins < cost) return fail("not enough coins");
		inv.coins -= cost;
		inv[material] += quantity;
		return OK;
	}

	buySeed(
		farm: InMemoryFarmStore,
		player: string,
		cropId: CropId,
		quantity = 1,
	): ActionResult {
		const crop = CROPS[cropId];
		if (!crop || quantity < 1) return fail("unknown seed");
		const cost = crop.seedPrice * quantity;
		const inv = farm.getInventory(player);
		if (inv.coins < cost) return fail("not enough coins");
		inv.coins -= cost;
		inv[crop.seedKey] += quantity;
		return OK;
	}

	brew(
		farm: InMemoryFarmStore,
		player: string,
		potionId: PotionId,
	): ActionResult {
		if (!this.isBuilt(player)) return fail("build a brewery first");
		const potion = POTIONS[potionId];
		if (!potion) return fail("unknown potion");
		const inv = farm.getInventory(player);
		if (!canBrew(inv, potionId)) return fail("missing crops");
		for (const [crop, count] of Object.entries(potion.recipe)) {
			inv[crop as CropId] -= count ?? 0;
		}
		farm.addPotions(player, potionId, 1);
		return OK;
	}

	sellPotion(
		farm: InMemoryFarmStore,
		player: string,
		potionId: PotionId,
	): ActionResult {
		const potion = POTIONS[potionId];
		if (!potion) return fail("unknown potion");
		const inv = farm.getInventory(player);
		if (inv.potions[potionId] <= 0) return fail("no potion to sell");
		inv.potions[potionId] -= 1;
		inv.coins += potion.barPrice;
		return OK;
	}

	sellCrop(
		farm: InMemoryFarmStore,
		player: string,
		cropId: CropId,
	): ActionResult {
		const crop = CROPS[cropId];
		if (!crop) return fail("unknown crop");
		const inv = farm.getInventory(player);
		if (inv[cropId] <= 0) return fail("no crop to sell");
		inv[cropId] -= 1;
		inv.coins += crop.cropPrice;
		return OK;
	}

	usePotion(
		farm: InMemoryFarmStore,
		player: string,
		potionId: PotionId,
		now: number = Date.now(),
	): ActionResult {
		const potion = POTIONS[potionId];
		if (!potion) return fail("unknown potion");
		const inv = farm.getInventory(player);
		if (inv.potions[potionId] <= 0) return fail("you have no such potion");
		inv.potions[potionId] -= 1;
		this.addEffect(player, potion.effect, potion.durationMs, now);
		return OK;
	}

	clear(): void {
		this.built.clear();
		this.effects.clear();
	}
}
