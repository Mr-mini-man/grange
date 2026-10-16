import { create } from "zustand";

export type NoticeKind = "chat" | "system" | "error";

export interface Notice {
	id: number;
	text: string;
	kind: NoticeKind;
	/** Epoch ms; the feed fades once the newest notice goes stale. */
	at: number;
}

/** How long a notice stays visible before the feed fades out. */
export const NOTICE_TTL_MS = 6_000;

/** Cap the backlog so a chatty farm can't grow the feed without bound. */
const MAX_NOTICES = 30;

let nextId = 1;

interface NotificationState {
	notices: Notice[];
	push: (text: string, kind?: NoticeKind) => void;
	clear: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
	notices: [],
	push: (text, kind = "chat") => {
		const trimmed = text.trim();
		if (!trimmed) return;
		set((state) => {
			const last = state.notices[state.notices.length - 1];
			// Collapse immediate duplicates (e.g. a held tool re-emitting
			// the same hint on every frame).
			if (last && last.text === trimmed && Date.now() - last.at < 750) {
				return state;
			}
			const next = [
				...state.notices,
				{ id: nextId++, text: trimmed, kind, at: Date.now() },
			];
			return { notices: next.slice(-MAX_NOTICES) };
		});
	},
	clear: () => set({ notices: [] }),
}));
