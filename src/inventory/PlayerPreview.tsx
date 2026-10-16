import { useEffect, useState } from "react";
import { economy } from "../world/EconomyManager";
import { getItemDef } from "./items";
import { useInventoryStore } from "./inventoryStore";
import { SlotIcon } from "./SlotIcon";

/**
 * 2D stand-in for the wireframe's "3D preview": a pixel-style paper-doll
 * (player color block from FarmMapScene) plus the currently equipped hotbar
 * item and the Grangecoin wallet balance.
 */
export function PlayerPreview() {
	const hotbar = useInventoryStore((s) => s.hotbar);
	const selectedHotbar = useInventoryStore((s) => s.selectedHotbar);
	const equipped = hotbar[selectedHotbar];
	const equippedDef = equipped.itemId ? getItemDef(equipped.itemId) : null;
	const [coins, setCoins] = useState(economy.getBalance());

	useEffect(() => economy.subscribe(setCoins), []);

	return (
		<section aria-label="Player preview" className="inv-preview">
			<h3 className="inv-preview-title">Farmer</h3>
			<div className="inv-paperdoll" aria-hidden="true">
				<div className="inv-paperdoll-body" />
				{equippedDef && (
					<div className="inv-paperdoll-gear">
						<SlotIcon itemId={equipped.itemId} />
					</div>
				)}
			</div>
			<dl className="inv-preview-meta">
				<div>
					<dt>Equipped</dt>
					<dd data-testid="preview-equipped">
						{equippedDef ? equippedDef.name : "Hands"}
					</dd>
				</div>
				<div>
					<dt>Grangecoin balance</dt>
					<dd data-testid="preview-coins">{coins.toLocaleString()}</dd>
				</div>
			</dl>
			<p className="inv-preview-note">
				Grangecoin is kept in your wallet, not in inventory slots.
			</p>
		</section>
	);
}
