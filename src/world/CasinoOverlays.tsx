import { BlackjackOverlay } from "./BlackjackOverlay";
import { PokerOverlay } from "./PokerOverlay";
import { RouletteOverlay } from "./RouletteOverlay";
import { SlotsOverlay } from "./SlotsOverlay";

/** Which casino game overlay is open, if any. */
export type CasinoOverlay = "blackjack" | "poker" | "roulette" | "slots";

interface CasinoOverlaysProps {
	open: CasinoOverlay | null;
	onClose: () => void;
}

/** Renders the active casino table overlay, if one is open. */
export function CasinoOverlays({ open, onClose }: CasinoOverlaysProps) {
	switch (open) {
		case "blackjack":
			return <BlackjackOverlay onClose={onClose} />;
		case "poker":
			return <PokerOverlay onClose={onClose} />;
		case "roulette":
			return <RouletteOverlay onClose={onClose} />;
		case "slots":
			return <SlotsOverlay onClose={onClose} />;
		default:
			return null;
	}
}
