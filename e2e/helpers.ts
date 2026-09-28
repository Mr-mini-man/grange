import type { Page } from "@playwright/test";
import { io, type Socket } from "socket.io-client";
import type { Game } from "../shared/types";
import {
	CARD_H,
	CARD_W,
	CUR_BOARD_Y,
	CUR_HAND_Y,
	DESIGN_H,
	DESIGN_W,
	OPP_BOARD_Y,
	boardX,
	handX,
} from "../src/boardLayout";

export const BASE = "http://localhost:3000";

/** Unique suffix so tests don't collide with each other or prior runs. */
export function uniqueName(base: string): string {
	return `${base}-${Math.floor(Math.random() * 1e9)}`;
}

/** Resets the server's in-memory state so each test starts clean. */
export async function resetServer(): Promise<void> {
	await fetch(`${BASE}/api/reset`, { method: "POST" });
}

/** The session cookie for the current page's user, for use by GameWatcher. */
export async function sessionCookie(page: Page): Promise<string> {
	const cookies = await page.context().cookies(BASE);
	return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/**
 * Registers a fresh account through the UI and returns the user. `/api/reset`
 * wipes accounts too, so the username only has to be unique within a test.
 */
export async function register(
	page: Page,
	username: string,
	password = "harvest-please",
): Promise<string> {
	await page.goto(BASE);
	await page.getByTestId("toggle-mode").click();
	await page.getByTestId("username").fill(username);
	await page.getByTestId("email").fill(`${username}@example.test`);
	await page.getByTestId("password").fill(password);
	await page.getByRole("button", { name: /Create Account/i }).click();
	await page.waitForURL("**/dashboard");
	return username;
}

/** Registers an account then signs in, leaving the page on the dashboard. */
export async function login(
	page: Page,
	username: string,
	password = "harvest-please",
): Promise<void> {
	await register(page, username, password);
	await page.getByTestId("logout").click();
	await page.waitForURL(`${BASE}/`);
	await page.getByTestId("username").fill(username);
	await page.getByTestId("password").fill(password);
	await page.getByRole("button", { name: /Sign In/i }).click();
	await page.waitForURL("**/dashboard");
}

export async function createGame(page: Page): Promise<string> {
	await page.getByRole("button", { name: /Create Game/i }).click();
	await page.waitForURL(/\/games\/[0-9a-f-]+/);
	return page.url().split("/").pop() as string;
}

export async function joinFirstOpenGame(page: Page): Promise<void> {
	await page.getByRole("button", { name: /^Join$/ }).click();
	await page.waitForURL(/\/games\/[0-9a-f-]+/);
}

export async function waitForBoard(page: Page): Promise<void> {
	await page.locator("canvas").first().waitFor();
}

/** Maps a logical board point to viewport pixel coordinates. */
export async function canvasPoint(
	page: Page,
	lx: number,
	ly: number,
): Promise<{ x: number; y: number }> {
	const box = await page.locator("canvas").first().boundingBox();
	if (!box) throw new Error("board canvas not found");
	const scale = Math.min(box.width / DESIGN_W, box.height / DESIGN_H);
	const ox = (box.width - DESIGN_W * scale) / 2;
	const oy = (box.height - DESIGN_H * scale) / 2;
	return { x: box.x + ox + lx * scale, y: box.y + oy + ly * scale };
}

export function handCenter(index: number): { lx: number; ly: number } {
	return { lx: handX(index) + CARD_W / 2, ly: CUR_HAND_Y + CARD_H / 2 };
}

export function slotCenter(slot: number): { lx: number; ly: number } {
	return { lx: boardX(slot) + CARD_W / 2, ly: CUR_BOARD_Y + CARD_H / 2 };
}

export function opponentSlotCenter(slot: number): { lx: number; ly: number } {
	return { lx: boardX(2 - slot) + CARD_W / 2, ly: OPP_BOARD_Y + CARD_H / 2 };
}

/** The in-board PASS button (below the scrap pile). */
const PASS_CENTER = { lx: 840, ly: 419 };

export async function clickPass(page: Page): Promise<void> {
	// The PASS button only renders while the player is able to act.
	await page.waitForFunction(
		() =>
			(window as unknown as Record<string, unknown>).__grange?.canAct === true,
	);
	// Konva rebuilds its hit graph on the frame after a React commit. Without
	// waiting a frame, a click can land before the button is hit-testable and
	// be silently dropped.
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
			}),
	);
	const p = await canvasPoint(page, PASS_CENTER.lx, PASS_CENTER.ly);
	await page.mouse.click(p.x, p.y);
}

/** A socket.io observer that tracks authoritative game state during a test. */
export class GameWatcher {
	private socket: Socket;
	private state: Game | null = null;
	private listeners = new Set<() => void>();
	private gameId: string;

	constructor(
		watcherName: string,
		gameId: string,
		cookie?: string,
	) {
		this.gameId = gameId;
		// The handshake identifies the watcher by session cookie, exactly as a
		// browser would. Callers must have signed in first to obtain it.
		this.socket = io(BASE, cookie ? { extraHeaders: { Cookie: cookie } } : {});
		this.socket.on("connect", () => {
			this.socket.emit("resume");
			this.socket.emit("joinGame", { gameId });
		});
		this.socket.on("gameUpdate", ({ game }: { game: Game }) => {
			if (game.id !== gameId) return;
			this.state = game;
			for (const l of this.listeners) l();
		});
	}

	getState(): Game | null {
		return this.state;
	}

	async waitFor(pred: (g: Game | null) => boolean): Promise<Game> {
		if (this.state && pred(this.state)) return this.state;
		return new Promise((resolve) => {
			const l = () => {
				if (this.state && pred(this.state)) {
					this.listeners.delete(l);
					resolve(this.state as Game);
				}
			};
			this.listeners.add(l);
		});
	}

	close(): void {
		this.socket.disconnect();
	}
}
