import { create } from "zustand";
import type { Game, GameEvent, GameSummary, Player } from "../shared/types";
import type { AuthUser } from "../shared/auth";
import type { FarmView } from "../shared/farm";

interface GameStore {
	user: AuthUser | null;
	username: string;
	players: Player[];
	games: GameSummary[];
	myGameId: string | null;
	activeGame: Game | null;
	pendingEvents: GameEvent[] | null;
	farm: FarmView | null;
	setUser: (user: AuthUser) => void;
	clearUser: () => void;
	setPlayers: (players: Player[]) => void;
	setGames: (games: GameSummary[]) => void;
	setMyGameId: (gameId: string | null) => void;
	setActiveGame: (game: Game | null, events?: GameEvent[] | null) => void;
	clearEvents: () => void;
	setFarm: (farm: FarmView | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
	user: null,
	// Derived from the session, never persisted. The card-game screens still
	// read `username`; it is empty until a session is resolved.
	username: "",
	players: [],
	games: [],
	myGameId: null,
	activeGame: null,
	pendingEvents: null,
	farm: null,
	setUser: (user) => set({ user, username: user.username }),
	clearUser: () => set({ user: null, username: "" }),
	setPlayers: (players) => set({ players }),
	setGames: (games) => set({ games }),
	setMyGameId: (myGameId) => set({ myGameId }),
	setActiveGame: (activeGame, pendingEvents = null) =>
		set({ activeGame, pendingEvents }),
	clearEvents: () => set({ pendingEvents: null }),
	setFarm: (farm) => set({ farm }),
}));
