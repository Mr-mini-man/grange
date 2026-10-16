import { useEffect } from "react";
import type { NoticeKind } from "../notifications/notificationStore";
import { MOVABLE_PROP_ASSETS } from "./mapData";

/** Routes a hint for the held hotbar farm item into the notification feed. */
export function useFarmItemNotice(
	heldItem: string | null | undefined,
	push: (text: string, kind?: NoticeKind) => void,
): void {
	useEffect(() => {
		if (heldItem === "fence")
			push("Fence: click clear grass to place a post.", "system");
		if (heldItem === "shovel")
			push("Shovel: click a fence or farm object to dig it up.", "system");
		if (heldItem && MOVABLE_PROP_ASSETS.some((asset) => asset === heldItem))
			push(`Click clear ground to place ${heldItem}.`, "system");
	}, [heldItem, push]);
}
