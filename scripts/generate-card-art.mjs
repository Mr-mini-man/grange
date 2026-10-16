#!/usr/bin/env node
// Generates the blackjack card art as SVG files under public/assets/cards.
// Run with `node scripts/generate-card-art.mjs` (or `pnpm art:cards`).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "assets", "cards");

const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const W = 240;
const H = 336;
const RED = "#c0392b";
const BLACK = "#1b1b1b";
const FACE = "#fdfbf4";
const BORDER = "#cbbfa6";
const BACK_RED = "#b3261e";
const BACK_BLACK = "#1b1b1b";
const BACK_BORDER = "#e8dcc4";

const HEART =
	"M50 92 C50 92 8 60 8 34 C8 18 20 6 34 6 C43 6 48 11 50 18 " +
	"C52 11 57 6 66 6 C80 6 92 18 92 34 C92 60 50 92 50 92 Z";
const SPADE =
	"M50 4 C50 4 90 42 90 64 C90 78 80 88 67 88 C58 88 51 82 49 75 " +
	"L43 96 L57 96 L51 75 C49 82 42 88 33 88 C20 88 10 78 10 64 " +
	"C10 42 50 4 50 4 Z";
const DIAMOND = "50,4 96,50 50,96 4,50";

/** The four suit symbols drawn inside a 100x100 box. */
function suitShape(suit, color) {
	if (suit === "hearts") return `<path d="${HEART}" fill="${color}"/>`;
	if (suit === "spades") return `<path d="${SPADE}" fill="${color}"/>`;
	if (suit === "diamonds") return `<polygon points="${DIAMOND}" fill="${color}"/>`;
	return (
		`<circle cx="50" cy="24" r="19" fill="${color}"/>` +
		`<circle cx="28" cy="60" r="19" fill="${color}"/>` +
		`<circle cx="72" cy="60" r="19" fill="${color}"/>` +
		`<polygon points="45,92 55,92 53,62 47,62" fill="${color}"/>`
	);
}

/** A suit pip centered at (x, y), optionally flipped for the lower half. */
function pip(suit, color, x, y, scale, flip) {
	const rot = flip ? " rotate(180)" : "";
	return `<g transform="translate(${x},${y})${rot} scale(${scale}) translate(-50,-50)">${suitShape(suit, color)}</g>`;
}

/** Standard pip coordinates for the number cards. */
function pipLayout(rank) {
	const L = 90;
	const R = 150;
	const C = 120;
	const T = 70;
	const B = 266;
	const M = 168;
	switch (rank) {
		case "A":
			return [[C, M, 0.82]];
		case "2":
			return [[C, T, 0.42], [C, B, 0.42]];
		case "3":
			return [[C, T, 0.42], [C, M, 0.42], [C, B, 0.42]];
		case "4":
			return [[L, T, 0.42], [R, T, 0.42], [L, B, 0.42], [R, B, 0.42]];
		case "5":
			return [[L, T, 0.42], [R, T, 0.42], [C, M, 0.42], [L, B, 0.42], [R, B, 0.42]];
		case "6":
			return [[L, T, 0.42], [R, T, 0.42], [L, M, 0.42], [R, M, 0.42], [L, B, 0.42], [R, B, 0.42]];
		case "7":
			return [[L, T, 0.42], [R, T, 0.42], [C, 119, 0.42], [L, M, 0.42], [R, M, 0.42], [L, B, 0.42], [R, B, 0.42]];
		case "8":
			return [[L, T, 0.42], [R, T, 0.42], [C, 119, 0.42], [L, M, 0.42], [R, M, 0.42], [C, 217, 0.42], [L, B, 0.42], [R, B, 0.42]];
		case "9":
			return [[L, T, 0.42], [R, T, 0.42], [L, 135, 0.42], [R, 135, 0.42], [C, M, 0.42], [L, 201, 0.42], [R, 201, 0.42], [L, B, 0.42], [R, B, 0.42]];
		default:
			return [[L, T, 0.42], [R, T, 0.42], [C, 102, 0.42], [L, 135, 0.42], [R, 135, 0.42], [L, 201, 0.42], [R, 201, 0.42], [C, 234, 0.42], [L, B, 0.42], [R, B, 0.42]];
	}
}

/** Corner rank + suit marker. The bottom one is a 180deg rotation of this. */
function indexMark(rank, suit, color) {
	return (
		`<g transform="translate(16,14)">` +
		`<text x="0" y="30" font-family="Georgia,'Times New Roman',serif" ` +
		`font-size="34" font-weight="700" fill="${color}">${rank}</text>` +
		`<g transform="translate(18,54) scale(0.22) translate(-50,-50)">${suitShape(suit, color)}</g>` +
		`</g>`
	);
}

function faceCard(rank, suit, color) {
	return (
		`<rect x="32" y="32" width="176" height="272" rx="10" fill="none" stroke="${color}" stroke-width="2" opacity="0.45"/>` +
		`<rect x="40" y="40" width="160" height="256" rx="8" fill="${color}" opacity="0.07"/>` +
		`<text x="120" y="176" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" ` +
		`font-size="100" font-weight="700" fill="${color}">${rank}</text>` +
		`<g transform="translate(120,242) scale(0.5) translate(-50,-50)">${suitShape(suit, color)}</g>`
	);
}

function faceSvg(rank, suit) {
	const color = suit === "hearts" || suit === "diamonds" ? RED : BLACK;
	const center =
		rank === "J" || rank === "Q" || rank === "K"
			? faceCard(rank, suit, color)
			: pipLayout(rank)
					.map(([x, y, s]) => pip(suit, color, x, y, s, y > 168))
					.join("");
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
		`<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="16" fill="${FACE}" stroke="${BORDER}" stroke-width="3"/>` +
		center +
		indexMark(rank, suit, color) +
		`<g transform="rotate(180 120 168)">${indexMark(rank, suit, color)}</g>` +
		`</svg>\n`
	);
}

/** Card back: a rounded rectangle split diagonally into red and black halves. */
function backSvg() {
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
		`<defs><clipPath id="card"><rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="16"/></clipPath></defs>` +
		`<g clip-path="url(#card)">` +
		`<rect x="0" y="0" width="${W}" height="${H}" fill="${BACK_BLACK}"/>` +
		`<polygon points="0,0 ${W},0 0,${H}" fill="${BACK_RED}"/>` +
		`</g>` +
		`<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="16" fill="none" stroke="${BACK_BORDER}" stroke-width="5"/>` +
		`<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="10" fill="none" stroke="${BACK_BORDER}" stroke-width="2" opacity="0.7"/>` +
		`<line x1="3" y1="3" x2="${W - 3}" y2="${H - 3}" stroke="${BACK_BORDER}" stroke-width="2" opacity="0.8"/>` +
		`</svg>\n`
	);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "back.svg"), backSvg());
let count = 1;
for (const suit of SUITS) {
	for (const rank of RANKS) {
		writeFileSync(join(OUT, `${suit}-${rank}.svg`), faceSvg(rank, suit));
		count += 1;
	}
}
console.log(`Wrote ${count} card SVGs to ${OUT}`);
