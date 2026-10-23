export interface FarmHoveredTile {
	column: number;
	row: number;
	state: string;
}

export interface FarmHudSnapshot {
	tomatoes: number;
	message: string;
	hovered: FarmHoveredTile | null;
	player: { x: number; y: number };
}
