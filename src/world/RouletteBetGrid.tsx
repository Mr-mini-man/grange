import { type PocketId, pocketColor } from "./roulette";
import { BET_SPOTS, FELT_HEIGHT, FELT_WIDTH } from "./rouletteLayout";
import type { BetSpot, PlacedBet } from "./rouletteTypes";

interface RouletteBetGridProps {
	bets: PlacedBet[];
	disabled: boolean;
	result: PocketId | null;
	onSpotClick: (spot: BetSpot) => void;
}

const NUMBER_FILL: Record<string, string> = {
	red: "#b3282d",
	black: "#1b1b1b",
	green: "#157347",
};

const HOTSPOT_KINDS = new Set([
	"split",
	"street",
	"corner",
	"five-number",
	"line",
]);

function spotFill(spot: BetSpot): string {
	if (spot.kind === "straight")
		return NUMBER_FILL[pocketColor(spot.numbers[0])];
	if (HOTSPOT_KINDS.has(spot.kind)) return "transparent";
	return "#0e5c33";
}

export function RouletteBetGrid({
	bets,
	disabled,
	result,
	onSpotClick,
}: RouletteBetGridProps) {
	const betIds = new Set(bets.map((bet) => bet.spotId));
	return (
		<svg
			className="rl-felt-svg"
			viewBox={`0 0 ${FELT_WIDTH} ${FELT_HEIGHT}`}
			aria-label="Roulette betting layout"
		>
			{BET_SPOTS.map((spot) => {
				const hotspot = HOTSPOT_KINDS.has(spot.kind);
				const isNumber = spot.kind === "straight";
				const winning =
					result !== null && isNumber && spot.numbers[0] === result;
				const classes = ["rl-spot"];
				if (hotspot) classes.push("rl-spot-hotspot");
				if (isNumber) classes.push("rl-spot-number");
				if (betIds.has(spot.id)) classes.push("rl-spot-bet");
				return (
					<g key={spot.id}>
						{/* biome-ignore lint/a11y/noStaticElementInteractions: the felt is a pointer-driven game board; the surrounding controls are native buttons. */}
						<rect
							className={classes.join(" ")}
							x={spot.x}
							y={spot.y}
							width={spot.w}
							height={spot.h}
							fill={spotFill(spot)}
							tabIndex={-1}
							data-testid={`roulette-spot-${spot.id}`}
							onClick={() => {
								if (!disabled) onSpotClick(spot);
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									if (!disabled) onSpotClick(spot);
								}
							}}
						>
							<title>
								{spot.label} — pays {spot.payout}:1
							</title>
						</rect>
						{!hotspot && (
							<text
								className={isNumber ? "rl-felt-number" : "rl-felt-outside"}
								x={spot.x + spot.w / 2}
								y={spot.y + spot.h / 2}
							>
								{spot.label}
							</text>
						)}
						{winning && (
							<rect
								className="rl-felt-win"
								x={spot.x}
								y={spot.y}
								width={spot.w}
								height={spot.h}
								pointerEvents="none"
							/>
						)}
					</g>
				);
			})}
		</svg>
	);
}
