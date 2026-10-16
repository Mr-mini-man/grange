/** The two enterable market stalls placed in the marketplace. */
export type MarketId = "seed" | "produce";

/** A buy/sell tab shown inside a market window. */
export type MarketCategoryId = "seeds" | "tools" | "train" | "sell";

/** A good that can be traded at a market. */
export type MarketItemId = "tomato-seed" | "tomato";

export interface MarketItem {
	id: MarketItemId;
	name: string;
	emoji: string;
	/** "buy" spends grangecoin, "sell" earns it. */
	kind: "buy" | "sell";
	/** Grangecoin spent or earned per transaction. */
	price: number;
	/** Units granted or taken per transaction. */
	quantity: number;
	blurb: string;
}

export const MARKET_ITEMS: Record<MarketItemId, MarketItem> = {
	"tomato-seed": {
		id: "tomato-seed",
		name: "Tomato Seeds",
		emoji: "🌱",
		kind: "buy",
		price: 1,
		quantity: 10,
		blurb: "10 seeds for $1",
	},
	tomato: {
		id: "tomato",
		name: "Tomatoes",
		emoji: "🍅",
		kind: "sell",
		price: 1,
		quantity: 1,
		blurb: "$1 each",
	},
};

export interface MarketCategory {
	id: MarketCategoryId;
	label: string;
	description: string;
	/** Items sold here; empty squares fill the rest of the grid. */
	items: MarketItemId[];
	/** Total cells drawn in the grid. */
	slots: number;
}

export const MARKET_CATEGORIES: Record<MarketCategoryId, MarketCategory> = {
	seeds: {
		id: "seeds",
		label: "Seeds",
		description: "Buy seeds to plant on your farm.",
		items: ["tomato-seed"],
		slots: 8,
	},
	tools: {
		id: "tools",
		label: "Tools",
		description: "Buy tools for working the fields.",
		items: [],
		slots: 8,
	},
	train: {
		id: "train",
		label: "Train",
		description: "Buy train carts and upgrades.",
		items: [],
		slots: 6,
	},
	sell: {
		id: "sell",
		label: "Sell",
		description: "Sell crops and goods from your barn.",
		items: ["tomato"],
		slots: 12,
	},
};

export interface MarketDefinition {
	id: MarketId;
	title: string;
	categories: MarketCategoryId[];
	/** Tab selected when the window first opens. */
	defaultCategory: MarketCategoryId;
}

export const MARKETS: Record<MarketId, MarketDefinition> = {
	seed: {
		id: "seed",
		title: "Seed Market",
		categories: ["seeds"],
		defaultCategory: "seeds",
	},
	produce: {
		id: "produce",
		title: "Produce Market",
		categories: ["sell", "tools", "train"],
		defaultCategory: "sell",
	},
};

/** Clamps a sell quantity into the 1..max range (at least 1). */
export function clampQuantity(value: number, max: number): number {
	const upper = Math.max(1, Math.floor(max));
	if (!Number.isFinite(value)) return 1;
	return Math.min(Math.max(1, Math.floor(value)), upper);
}
