import { create } from "zustand";

interface PauseState {
	paused: boolean;
	setPaused: (paused: boolean) => void;
	togglePause: () => void;
}

/**
 * Global pause-menu state. Kept out of the inventory store so input blocking
 * can consult both overlays without either importing the other's members.
 */
export const usePauseStore = create<PauseState>((set) => ({
	paused: false,
	setPaused: (paused) => set({ paused }),
	togglePause: () => set((s) => ({ paused: !s.paused })),
}));
