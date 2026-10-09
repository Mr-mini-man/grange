import {
	CROPS,
	type CropId,
	type EffectKind,
	type FarmTileState,
} from "../../shared/farm";

export const CROP_ORDER: CropId[] = ["tomato", "wheat", "potato", "barley"];

export const CROP_COLORS: Record<CropId, string> = {
	tomato: "#d64541",
	wheat: "#f0c040",
	potato: "#c9a06a",
	barley: "#b8860b",
};

export const CROP_INITIAL: Record<CropId, string> = {
	tomato: "T",
	wheat: "W",
	potato: "P",
	barley: "B",
};

export const TILE_LABEL: Record<FarmTileState, string> = {
	tilled: "Tilled soil",
	planted: "Planted seed",
	watered: "Watered, growing",
	ready: "Ready to harvest",
};

export const EFFECT_LABEL: Record<EffectKind, string> = {
	growth: "Green Thumb: crops grow twice as fast",
	speed: "Swift Sip: move 60% faster",
	luck: "Lucky Draught: +2 crops per harvest",
};

export function cropName(cropId: CropId): string {
	return CROPS[cropId].name;
}
