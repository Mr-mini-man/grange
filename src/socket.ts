import { io } from "socket.io-client";
import type {
	Game,
	GameEvent,
	GameSummary,
	Player,
	Submission,
} from "../shared/types";
import type {
	CropId,
	FarmView,
	MaterialId,
	PotionId,
} from "../shared/farm";
import { useGameStore } from "./store";

/** Single shared socket connection for the whole SPA. */
export const socket = io();

export interface Ack {
	ok: boolean;
	error?: string;
}

export interface ResumeAck extends Ack {
	player?: Player;
}

export interface GameAck extends Ack {
	game?: Game;
	role?: "player" | "observer";
	removed?: boolean;
}

/**
 * Re-establishes game room membership after a reconnect. Identity is not sent -
 * the server reads it from the session cookie on the socket handshake.
 */
export function emitResume(cb?: (res: ResumeAck) => void): void {
	socket.emit("resume", cb);
}

export function requestGames(): void {
	socket.emit("games", ({ games }: { games: GameSummary[] }) => {
		useGameStore.getState().setGames(games);
	});
}

export function emitCreateGame(cb?: (res: GameAck) => void): void {
	socket.emit("createGame", cb);
}

export function emitJoinGame(
	gameId: string,
	cb?: (res: GameAck) => void,
): void {
	socket.emit("joinGame", { gameId }, cb);
}

export function emitLeaveGame(cb?: (res: GameAck) => void): void {
	socket.emit("leaveGame", cb);
}

export function emitDeleteGame(
	gameId: string,
	cb?: (res: GameAck) => void,
): void {
	socket.emit("deleteGame", { gameId }, cb);
}

export function emitSubmit(
	choice: Submission,
	cb?: (res: GameAck & { status?: "waiting" | "resolved" }) => void,
): void {
	socket.emit("submit", { choice }, cb);
}

export interface FarmAck extends Ack {
	farm?: FarmView;
}

/** Requests the signed-in player's farm snapshot. */
export function requestFarm(cb?: (res: FarmAck) => void): void {
	socket.emit("farm", (res: FarmAck) => {
		if (res.farm) useGameStore.getState().setFarm(res.farm);
		cb?.(res);
	});
}

export type FarmAction = "till" | "plant" | "water" | "harvest";

export function emitFarmAction(
	action: FarmAction,
	x: number,
	y: number,
	cropId?: CropId,
	cb?: (res: FarmAck) => void,
): void {
	socket.emit("farmAction", { action, x, y, cropId }, cb);
}

export function emitBuildBrewery(cb?: (res: FarmAck) => void): void {
	socket.emit("buildBrewery", cb);
}

export function emitBuyMaterial(
	material: MaterialId,
	quantity = 1,
	cb?: (res: FarmAck) => void,
): void {
	socket.emit("buyMaterial", { material, quantity }, cb);
}

export function emitBuySeed(
	cropId: CropId,
	quantity = 1,
	cb?: (res: FarmAck) => void,
): void {
	socket.emit("buySeed", { cropId, quantity }, cb);
}

export function emitBrew(
	potionId: PotionId,
	cb?: (res: FarmAck) => void,
): void {
	socket.emit("brew", { potionId }, cb);
}

export function emitSellPotion(
	potionId: PotionId,
	cb?: (res: FarmAck) => void,
): void {
	socket.emit("sellPotion", { potionId }, cb);
}

export function emitSellCrop(
	cropId: CropId,
	cb?: (res: FarmAck) => void,
): void {
	socket.emit("sellCrop", { cropId }, cb);
}

export function emitUsePotion(
	potionId: PotionId,
	cb?: (res: FarmAck) => void,
): void {
	socket.emit("usePotion", { potionId }, cb);
}

/**
 * Forces a fresh socket so the io.use() handshake re-runs with the new session
 * cookie. The initial connection happens before sign-in, so without this the
 * server would never learn who the user is and every game event would be
 * rejected as "not logged in".
 */
export function rebindAuth(): void {
	socket.disconnect();
	socket.connect();
}

/** Registers global socket listeners. */
export function initSocket(): void {
	socket.on("players", ({ players }: { players: Player[] }) => {
		useGameStore.getState().setPlayers(players);
	});

	socket.on("games", ({ games }: { games: GameSummary[] }) => {
		useGameStore.getState().setGames(games);
	});

	socket.on(
		"gameUpdate",
		({ game, events }: { game: Game; events?: GameEvent[] }) => {
			useGameStore.getState().setActiveGame(game, events ?? []);
			const { username } = useGameStore.getState();
			useGameStore.getState().setMyGameId(game.id);
			if (username) {
				const isPlayer = game.players.some((p) => p.name === username);
				const isObserver = game.observers.includes(username);
				if (!isPlayer && !isObserver) {
					useGameStore.getState().setMyGameId(null);
				}
			}
		},
	);

	socket.on("gameDeleted", ({ gameId }: { gameId: string }) => {
		const st = useGameStore.getState();
		if (st.activeGame?.id === gameId) st.setActiveGame(null);
		if (st.myGameId === gameId) st.setMyGameId(null);
	});

	socket.on("farmUpdate", ({ farm }: { farm: FarmView }) => {
		useGameStore.getState().setFarm(farm);
	});

	// rebindAuth() forces a fresh handshake after sign-in or sign-out, and
	// reconnection does the same on its own. Either way the server has just
	// re-resolved the session cookie, so ask it to restore game membership.
	socket.on("connect", () => {
		if (useGameStore.getState().user) emitResume();
	});
}
