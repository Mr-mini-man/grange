import { useEffect, useState } from "react";
import { CROPS, type CropId } from "../../shared/farm";
import { requestFarm, socket, type FarmAction } from "../socket";
import { useGameStore } from "../store";
import BarPanel from "./BarPanel";
import BreweryPanel from "./BreweryPanel";
import FarmGrid from "./FarmGrid";
import MarketPanel from "./MarketPanel";
import { CROP_COLORS, CROP_ORDER, EFFECT_LABEL, cropName } from "./farmUi";

type Tab = "market" | "brewery" | "bar";

const TOOLS: FarmAction[] = ["till", "plant", "water", "harvest"];

/** Re-renders once a second so effect countdowns tick down. */
function useNow(): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);
	return now;
}

export default function FarmHud() {
	const farm = useGameStore((s) => s.farm);
	const [tool, setTool] = useState<FarmAction>("till");
	const [crop, setCrop] = useState<CropId>("tomato");
	const [tab, setTab] = useState<Tab>("market");
	const now = useNow();

	useEffect(() => {
		if (socket.connected) {
			requestFarm();
			return;
		}
		socket.once("connect", () => requestFarm());
	}, []);

	if (!farm) {
		return <div className="farm-hud farm-hud--loading">Loading farm…</div>;
	}

	const inv = farm.inventory;
	const effects = farm.brewery.effects.filter((e) => e.expiresAt > now);

	return (
		<div className="farm-hud" data-testid="farm-hud">
			<div className="farm-status">
				<span className="farm-coin">Coins {inv.coins}</span>
				<span>Wood {inv.wood}</span>
				<span>Stone {inv.stone}</span>
			</div>

			{effects.length > 0 && (
				<div className="farm-effects" data-testid="farm-effects">
					{effects.map((e) => (
						<span key={e.kind} className="farm-effect">
							{EFFECT_LABEL[e.kind]} · {Math.ceil((e.expiresAt - now) / 1000)}s
						</span>
					))}
				</div>
			)}

			<div className="farm-tools">
				{TOOLS.map((t) => (
					<button
						key={t}
						type="button"
						className={`farm-tool ${tool === t ? "farm-tool--active" : ""}`}
						onClick={() => setTool(t)}
					>
						{t}
					</button>
				))}
			</div>

			{tool === "plant" && (
				<div className="farm-seeds">
					{CROP_ORDER.map((c) => (
						<button
							key={c}
							type="button"
							className={`farm-seed ${crop === c ? "farm-seed--active" : ""}`}
							style={{ borderColor: CROP_COLORS[c] }}
							title={`${cropName(c)} · have ${inv[CROPS[c].seedKey]}`}
							onClick={() => {
								setCrop(c);
								setTool("plant");
							}}
						>
							{cropName(c)} ({inv[CROPS[c].seedKey]})
						</button>
					))}
				</div>
			)}

			<FarmGrid tiles={farm.tiles} tool={tool} crop={crop} />

			<div className="farm-tabs">
				{(["market", "brewery", "bar"] as Tab[]).map((t) => (
					<button
						key={t}
						type="button"
						className={`farm-tab ${tab === t ? "farm-tab--active" : ""}`}
						onClick={() => setTab(t)}
					>
						{t}
					</button>
				))}
			</div>
			{tab === "market" && <MarketPanel />}
			{tab === "brewery" && <BreweryPanel />}
			{tab === "bar" && <BarPanel />}
		</div>
	);
}
