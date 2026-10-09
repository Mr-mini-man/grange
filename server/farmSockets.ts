import type { Server as SocketServer, Socket } from "socket.io";
import {
	MATERIALS,
	POTIONS,
	growthMsFor,
	harvestYieldFor,
} from "../shared/brewing";
import {
	CROPS,
	type CropId,
	type FarmView,
	type MaterialId,
	type PotionId,
} from "../shared/farm";
import type { ActionResult, InMemoryBreweryStore } from "./brewing";
import type { InMemoryFarmStore } from "./farm";
import { farmRoom, farmView } from "./farmView";

interface FarmSocketData {
	username?: string;
}

interface FarmAck {
	ok: boolean;
	error?: string;
	farm?: FarmView;
}

function coord(payload: unknown): { x: number; y: number } | null {
	const p = payload as { x?: unknown; y?: unknown } | undefined;
	const x = Number(p?.x);
	const y = Number(p?.y);
	if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
	return { x, y };
}

function cropOf(payload: unknown): CropId | null {
	const crop = (payload as { cropId?: unknown } | undefined)?.cropId;
	return typeof crop === "string" && crop in CROPS ? (crop as CropId) : null;
}

function potionOf(payload: unknown): PotionId | null {
	const id = (payload as { potionId?: unknown } | undefined)?.potionId;
	return typeof id === "string" && id in POTIONS ? (id as PotionId) : null;
}

function materialOf(payload: unknown): MaterialId | null {
	const id = (payload as { material?: unknown } | undefined)?.material;
	return typeof id === "string" && id in MATERIALS ? (id as MaterialId) : null;
}

function quantityOf(payload: unknown): number {
	const q = Number((payload as { quantity?: unknown } | undefined)?.quantity);
	return Number.isInteger(q) && q > 0 ? q : 1;
}

/**
 * Registers the farm/brewery socket handlers. Every player owns one farm and
 * one brewery; state is broadcast to that player's private room on change.
 */
export function registerFarmHandlers(
	io: SocketServer,
	farm: InMemoryFarmStore,
	brewery: InMemoryBreweryStore,
): void {
	const emitView = (name: string): void => {
		io.to(farmRoom(name)).emit("farmUpdate", {
			farm: farmView(farm, brewery, name),
		});
	};

	io.on("connection", (socket: Socket) => {
		const nameOf = (): string | undefined =>
			(socket.data as FarmSocketData).username;

		/** Runs a brewery action and answers with the refreshed view. */
		const action = (
			cb: ((res: FarmAck) => void) | undefined,
			run: (name: string) => ActionResult,
		): void => {
			const name = nameOf();
			if (!name) {
				cb?.({ ok: false, error: "not logged in" });
				return;
			}
			const res = run(name);
			const view = farmView(farm, brewery, name);
			if (res.ok) {
				cb?.({ ok: true, farm: view });
				emitView(name);
			} else {
				cb?.({ ok: false, error: res.error, farm: view });
			}
		};

		socket.on("farm", (cb?: (res: FarmAck) => void) => {
			const name = nameOf();
			if (!name) {
				cb?.({ ok: false, error: "not logged in" });
				return;
			}
			cb?.({ ok: true, farm: farmView(farm, brewery, name) });
		});

		socket.on(
			"farmAction",
			(payload: unknown, cb?: (res: FarmAck) => void) => {
				const name = nameOf();
				if (!name) {
					cb?.({ ok: false, error: "not logged in" });
					return;
				}
				const pos = coord(payload);
				const kind = (payload as { action?: unknown } | undefined)?.action;
				if (!pos || typeof kind !== "string") {
					cb?.({ ok: false, error: "invalid action" });
					return;
				}
				const now = Date.now();
				let ok = false;
				if (kind === "till") {
					ok = farm.tillGround(name, pos.x, pos.y);
				} else if (kind === "plant") {
					const crop = cropOf(payload) ?? "tomato";
					ok = farm.plantSeed(name, pos.x, pos.y, now, crop);
				} else if (kind === "water") {
					const tile = farm.getTile(name, pos.x, pos.y);
					if (tile?.state === "planted") {
						const growMs = growthMsFor(
							tile.cropId,
							brewery.getEffects(name, now),
							now,
						);
						ok = farm.waterTile(name, pos.x, pos.y, now, growMs);
					}
				} else if (kind === "harvest") {
					const tile = farm.getTile(name, pos.x, pos.y);
					if (tile?.state === "ready") {
						const amount = harvestYieldFor(
							tile.cropId,
							brewery.getEffects(name, now),
							now,
						);
						ok = farm.harvestCrop(name, pos.x, pos.y, amount);
					}
				} else {
					cb?.({ ok: false, error: "unknown action" });
					return;
				}
				const view = farmView(farm, brewery, name);
				if (!ok) {
					cb?.({ ok: false, error: "action not allowed here", farm: view });
					return;
				}
				cb?.({ ok: true, farm: view });
				emitView(name);
			},
		);

		socket.on("buildBrewery", (cb?: (res: FarmAck) => void) => {
			action(cb, (name) => brewery.build(farm, name));
		});

		socket.on(
			"buyMaterial",
			(payload: unknown, cb?: (res: FarmAck) => void) => {
				const material = materialOf(payload);
				if (!material) {
					cb?.({ ok: false, error: "unknown material" });
					return;
				}
				action(cb, (name) =>
					brewery.buyMaterial(farm, name, material, quantityOf(payload)),
				);
			},
		);

		socket.on(
			"buySeed",
			(payload: unknown, cb?: (res: FarmAck) => void) => {
				const crop = cropOf(payload);
				if (!crop) {
					cb?.({ ok: false, error: "unknown seed" });
					return;
				}
				action(cb, (name) =>
					brewery.buySeed(farm, name, crop, quantityOf(payload)),
				);
			},
		);

		socket.on("brew", (payload: unknown, cb?: (res: FarmAck) => void) => {
			const potion = potionOf(payload);
			if (!potion) {
				cb?.({ ok: false, error: "unknown potion" });
				return;
			}
			action(cb, (name) => brewery.brew(farm, name, potion));
		});

		socket.on(
			"sellPotion",
			(payload: unknown, cb?: (res: FarmAck) => void) => {
				const potion = potionOf(payload);
				if (!potion) {
					cb?.({ ok: false, error: "unknown potion" });
					return;
				}
				action(cb, (name) => brewery.sellPotion(farm, name, potion));
			},
		);

		socket.on(
			"sellCrop",
			(payload: unknown, cb?: (res: FarmAck) => void) => {
				const crop = cropOf(payload);
				if (!crop) {
					cb?.({ ok: false, error: "unknown crop" });
					return;
				}
				action(cb, (name) => brewery.sellCrop(farm, name, crop));
			},
		);

		socket.on(
			"usePotion",
			(payload: unknown, cb?: (res: FarmAck) => void) => {
				const potion = potionOf(payload);
				if (!potion) {
					cb?.({ ok: false, error: "unknown potion" });
					return;
				}
				action(cb, (name) => brewery.usePotion(farm, name, potion));
			},
		);
	});
}
