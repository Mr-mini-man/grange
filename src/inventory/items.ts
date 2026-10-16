import type { FarmToolId } from "../../shared/farm";
import type { MovablePropKey } from "../world/mapData";

export type ItemId =
	| "hoe"
	| "watering-can"
	| "scythe"
	| "seed-bag"
	| "tomato"
	| "fence"
	| "shovel"
	| MovablePropKey;

export type ItemKind = "tool" | "seed" | "crop" | "building";

export interface ItemDef {
	id: ItemId;
	name: string;
	kind: ItemKind;
	maxStack: number;
	/** Asset path (starts with "/") or emoji fallback for stub art. */
	icon: string;
	description: string;
}

export const ITEMS: Record<ItemId, ItemDef> = {
	hoe: {
		id: "hoe",
		name: "Hoe",
		kind: "tool",
		maxStack: 1,
		icon: "/assets/farm/objects/hoe.svg",
		description: "Till soil for planting.",
	},
	"watering-can": {
		id: "watering-can",
		name: "Watering Can",
		kind: "tool",
		maxStack: 1,
		icon: "/assets/farm/objects/watering-can.webp",
		description: "Water planted crops.",
	},
	scythe: {
		id: "scythe",
		name: "Scythe",
		kind: "tool",
		maxStack: 1,
		icon: "/assets/farm/objects/scythe.svg",
		description: "Harvest ready crops.",
	},
	"seed-bag": {
		id: "seed-bag",
		name: "Tomato Seeds",
		kind: "seed",
		maxStack: 99,
		icon: "/assets/farm/objects/seed-bag.webp",
		description: "Plant in tilled soil.",
	},
	tomato: {
		id: "tomato",
		name: "Tomato",
		kind: "crop",
		maxStack: 99,
		icon: "/assets/farm/plants/tomato-plant.webp",
		description: "Harvested crop. Sells for Grangecoin.",
	},
	fence: {
		id: "fence", name: "Fence", kind: "building", maxStack: 99,
		icon: "/assets/farm/fences/post.webp",
		description: "Click grass to place a fence post. Adjacent posts connect automatically.",
	},
	shovel: {
		id: "shovel", name: "Shovel", kind: "tool", maxStack: 1,
		icon: "/assets/farm/objects/shovel.svg",
		description: "Click a fence or farm object to dig it up into inventory.",
	},
	farmhouse: { id: "farmhouse", name: "Farmhouse", kind: "building", maxStack: 99,
		icon: "/assets/farm/buildings/farmhouse.webp", description: "Place your farmhouse on clear ground." },
	barn: { id: "barn", name: "Barn", kind: "building", maxStack: 99,
		icon: "/assets/farm/buildings/barn.webp", description: "Place your barn on clear ground." },
	well: { id: "well", name: "Well", kind: "building", maxStack: 99,
		icon: "/assets/farm/objects/well.webp", description: "Place a well on clear ground." },
	bench: { id: "bench", name: "Bench", kind: "building", maxStack: 99,
		icon: "/assets/farm/objects/bench.webp", description: "Place a bench on clear ground." },
	sign: { id: "sign", name: "Sign", kind: "building", maxStack: 99,
		icon: "/assets/farm/objects/sign.webp", description: "Place a sign on clear ground." },
	barrel: { id: "barrel", name: "Barrel", kind: "building", maxStack: 99,
		icon: "/assets/farm/objects/barrel.webp", description: "Place a barrel on clear ground." },
	crate: { id: "crate", name: "Crate", kind: "building", maxStack: 99,
		icon: "/assets/farm/objects/crate.webp", description: "Place a crate on clear ground." },
	"oak-tree": { id: "oak-tree", name: "Oak Tree", kind: "building", maxStack: 99,
		icon: "/assets/farm/plants/oak-tree.webp", description: "Replant an oak tree." },
	"pine-tree": { id: "pine-tree", name: "Pine Tree", kind: "building", maxStack: 99,
		icon: "/assets/farm/plants/pine-tree.webp", description: "Replant a pine tree." },
	"apple-tree": { id: "apple-tree", name: "Apple Tree", kind: "building", maxStack: 99,
		icon: "/assets/farm/plants/apple-tree.webp", description: "Replant an apple tree." },
	daisies: { id: "daisies", name: "Daisies", kind: "building", maxStack: 99,
		icon: "/assets/farm/plants/daisies.webp", description: "Place a daisy bush." },
	marigolds: { id: "marigolds", name: "Marigolds", kind: "building", maxStack: 99,
		icon: "/assets/farm/plants/marigolds.webp", description: "Place a marigold bush." },
	"blue-flowers": { id: "blue-flowers", name: "Blue Flowers", kind: "building", maxStack: 99,
		icon: "/assets/farm/plants/blue-flowers.webp", description: "Place blue flowers." },
};

export function getItemDef(id: ItemId): ItemDef {
	return ITEMS[id];
}

export function isStackable(id: ItemId): boolean {
	return ITEMS[id].maxStack > 1;
}

/**
 * Maps a held inventory item to the farm action it performs. Selecting the
 * matching hotbar slot makes the hotbar the single tool selector.
 */
export function farmToolForItem(itemId: ItemId | null): FarmToolId | null {
	switch (itemId) {
		case "hoe":
			return "hoe";
		case "seed-bag":
			return "seed";
		case "watering-can":
			return "bucket";
		case "scythe":
			return "scythe";
		default:
			return null;
	}
}
