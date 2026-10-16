import { type Channel, Socket } from "phoenix";
import type { CropId, MaterialId, PotionId } from "../shared/farm";
import type {
	ActiveFarm,
	FarmAction,
	FarmPropAction,
	FarmSummary,
	Player,
} from "../shared/types";
import { useGameStore } from "./store";

/** Session token used to authenticate the socket handshake. */
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
	authToken = token;
}

/** Single shared connection for the whole SPA. */
export const socket = new Socket("/socket", {
	params: () => ({ token: authToken }),
});

export interface Ack {
	ok: boolean;
	error?: string;
}

export interface FarmAck extends Ack {
	farm?: ActiveFarm;
}

/** The lobby channel is shared by the whole app; the farm channel tracks visits. */
let lobby: Channel | null = null;
let farmChannel: Channel | null = null;
let farmOwner: string | null = null;

function reasonOf(payload: unknown): string | undefined {
	if (payload && typeof payload === "object") {
		if ("error" in payload)
			return String((payload as { error?: unknown }).error);
		if ("reason" in payload)
			return String((payload as { reason?: unknown }).reason);
	}
	return undefined;
}

function joinLobby(): Channel {
	if (lobby) return lobby;

	const channel = socket.channel("lobby", {});

	channel.on("players", (payload: unknown) => {
		const { players } = payload as { players: Player[] };
		useGameStore.getState().setPlayers(players);
	});

	channel.on("farms", (payload: unknown) => {
		const { farms } = payload as { farms: FarmSummary[] };
		useGameStore.getState().setFarms(farms);
	});

	channel
		.join()
		.receive("ok", (payload: unknown) => {
			const { players, farms } = payload as {
				players: Player[];
				farms: FarmSummary[];
			};
			useGameStore.getState().setPlayers(players);
			useGameStore.getState().setFarms(farms);
		})
		.receive("error", () => {
			lobby = null;
		});

	lobby = channel;
	return channel;
}

export function requestFarms(): void {
	joinLobby()
		.push("farms", {})
		.receive("ok", (payload: unknown) => {
			const { farms } = payload as { farms: FarmSummary[] };
			useGameStore.getState().setFarms(farms);
		});
}

export function emitVisitFarm(
	owner: string,
	cb?: (res: FarmAck) => void,
): void {
	if (farmChannel && farmOwner === owner) {
		cb?.({ ok: true });
		return;
	}

	const channel = socket.channel(`farm:${owner}`, {});

	channel.on("farmUpdate", (payload: unknown) => {
		const { farm } = payload as { farm: ActiveFarm };
		useGameStore.getState().setActiveFarm(farm);
	});

	channel
		.join()
		.receive("ok", (payload: unknown) => {
			const { farm } = payload as { farm: ActiveFarm };
			const previous = farmChannel;
			farmChannel = channel;
			farmOwner = owner;
			useGameStore.getState().setActiveFarm(farm);
			// Leaving the old channel drops this socket's subscription.
			if (previous && previous !== channel) previous.leave();
			cb?.({ ok: true, farm });
		})
		.receive("error", (payload: unknown) =>
			cb?.({ ok: false, error: reasonOf(payload) ?? "Farm not found" }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Farm timed out" }));
}

export function emitLeaveFarm(cb?: (res: Ack) => void): void {
	const channel = farmChannel;
	if (!channel) {
		cb?.({ ok: true });
		return;
	}

	channel.leave();
	farmChannel = null;
	farmOwner = null;
	useGameStore.getState().setActiveFarm(null);
	cb?.({ ok: true });
}

/** Pushes one owner-only farm event and normalizes the reply. */
function pushFarm(
	owner: string,
	event: string,
	payload: Record<string, unknown>,
	fallback: string,
	cb?: (res: Ack) => void,
): void {
	const channel = farmChannel;
	if (!channel || farmOwner !== owner) {
		cb?.({ ok: false, error: "not visiting farm" });
		return;
	}

	channel
		.push(event, payload)
		.receive("ok", () => cb?.({ ok: true }))
		.receive("error", (response: unknown) =>
			cb?.({ ok: false, error: reasonOf(response) ?? fallback }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Timed out" }));
}

export function emitFarmAction(
	owner: string,
	action: FarmAction,
	cb?: (res: Ack) => void,
): void {
	pushFarm(owner, "farmAction", { action }, "Invalid action", cb);
}

export function emitFarmPropAction(
	owner: string,
	action: FarmPropAction,
	cb?: (res: Ack) => void,
): void {
	pushFarm(owner, "farmPropAction", { action }, "Invalid object action", cb);
}

/** Sells tomatoes from the visited farm's barn back to the market. */
export function emitSellTomatoes(
	owner: string,
	count: number,
	cb?: (res: Ack) => void,
): void {
	pushFarm(owner, "sellTomatoes", { count }, "Could not sell", cb);
}

export function emitBuySeed(
	owner: string,
	crop: CropId,
	quantity = 1,
	cb?: (res: Ack) => void,
): void {
	pushFarm(owner, "buySeed", { crop, quantity }, "Could not buy seeds", cb);
}

export function emitBuyMaterial(
	owner: string,
	material: MaterialId,
	quantity = 1,
	cb?: (res: Ack) => void,
): void {
	pushFarm(owner, "buyMaterial", { material, quantity }, "Could not buy material", cb);
}

export function emitBuildBrewery(owner: string, cb?: (res: Ack) => void): void {
	pushFarm(owner, "buildBrewery", {}, "Could not build the brewery", cb);
}

export function emitBrew(
	owner: string,
	potion: PotionId,
	cb?: (res: Ack) => void,
): void {
	pushFarm(owner, "brew", { potion }, "Could not brew", cb);
}

export function emitSellPotion(
	owner: string,
	potion: PotionId,
	cb?: (res: Ack) => void,
): void {
	pushFarm(owner, "sellPotion", { potion }, "Could not sell the potion", cb);
}

export function emitSellCrop(
	owner: string,
	crop: CropId,
	cb?: (res: Ack) => void,
): void {
	pushFarm(owner, "sellCrop", { crop }, "Could not sell the crop", cb);
}

export function emitUsePotion(
	owner: string,
	potion: PotionId,
	cb?: (res: Ack) => void,
): void {
	pushFarm(owner, "usePotion", { potion }, "Could not drink the potion", cb);
}

/** Registers global handlers and opens the lobby channel. */
export function initSocket(): void {
	socket.connect();
	socket.onOpen(() => {
		joinLobby();
	});
	joinLobby();
}

/**
 * Forces a fresh socket so the handshake re-runs with the new session cookie.
 * The initial connection happens before sign-in, so without this the server
 * would never learn who the user is.
 */
export function rebindAuth(): void {
	socket.disconnect();
	socket.connect();
	joinLobby();
}
