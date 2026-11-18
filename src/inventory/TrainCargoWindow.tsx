import { useEffect } from "react";
import { useGameStore } from "../store";
import { CargoSlot } from "./CargoSlot";
import { GRID_SIZE, HOTBAR_SIZE, useInventoryStore } from "./inventoryStore";
import { InventorySlot } from "./InventorySlot";
import type { ItemId } from "./items";
import { cargoEntries } from "./trainCargo";
import { useTrainCargo } from "./useTrainCargo";

interface Props {
	owner: string;
	onClose: () => void;
}

/**
 * The train cargo window. Each cart shows one cell per cargo slot; drag a stack
 * from the inventory onto a cart to load it, click a cart cell to unload, or
 * press Shift+E to load the selected hotbar stack. The player inventory renders
 * its own slots so the modal is self-contained.
 */
export function TrainCargoWindow({ owner, onClose }: Props) {
	const train = useGameStore((s) => s.activeFarm?.train);
	const selectedHotbar = useInventoryStore((s) => s.selectedHotbar);
	const { message, depositFrom, withdraw } = useTrainCargo(owner);
	const carts = train?.carts ?? [];

	// Shift+E quick-loads the stack the player is holding.
	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
			if (!e.shiftKey || e.code !== "KeyE") return;
			e.preventDefault();
			depositFrom({ area: "hotbar", index: selectedHotbar });
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [depositFrom, selectedHotbar]);

	function onBackdropClick(e: React.MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is a shortcut; keyboard path is Esc + Close button
		<div
			data-testid="train-cargo-window"
			role="dialog"
			aria-modal="true"
			aria-label="Train cargo"
			className="inv-backdrop"
			onClick={onBackdropClick}
		>
			<div className="inv-modal barn-modal">
				<header className="inv-header">
					<h2>Train Cargo</h2>
					<button
						type="button"
						data-testid="train-cargo-close"
						className="inv-close"
						onClick={onClose}
					>
						Close [Esc]
					</button>
				</header>
				<div className="barn-body">
					<section className="barn-section">
						<h3 className="barn-heading">
							Carts — {carts.reduce((sum, cart) => sum + cart.capacity, 0)}{" "}
							slots
						</h3>
						<div data-testid="train-carts" className="train-cart-list">
							{carts.map((cart) => {
								const entries = cargoEntries(cart);
								return (
									<div
										key={cart.index}
										className="train-cart"
										data-testid={`train-cart-${cart.index}`}
									>
										<span className="train-cart-label">
											Cart {cart.index} · {cart.capacity} slots
										</span>
										<section
											aria-label={`Cart ${cart.index} cargo`}
											className="inv-grid"
										>
											{Array.from({ length: cart.capacity }, (_, i) => (
												<CargoSlot
													// biome-ignore lint/suspicious/noArrayIndexKey: slot position is the stable, meaningful key
													key={`cart-${cart.index}-${i}`}
													cartIndex={cart.index}
													slotIndex={i}
													itemId={entries[i]?.itemId ?? null}
													count={entries[i]?.count ?? 0}
													onWithdraw={(cartIndex, item: ItemId) =>
														withdraw(cartIndex, item)
													}
													onDeposit={depositFrom}
												/>
											))}
										</section>
									</div>
								);
							})}
						</div>
					</section>
					<section className="barn-section">
						<h3 className="barn-heading">Your inventory</h3>
						<section
							data-testid="train-cargo-player-grid"
							aria-label="Inventory slots"
							className="inv-grid"
						>
							{Array.from({ length: GRID_SIZE }, (_, i) => (
								<InventorySlot
									// biome-ignore lint/suspicious/noArrayIndexKey: grid position is the stable, meaningful key
									key={`train-grid-${i}`}
									area="grid"
									index={i}
								/>
							))}
						</section>
						<section
							data-testid="train-cargo-player-hotbar"
							aria-label="Hotbar slots"
							className="inv-hotbar-row"
						>
							{Array.from({ length: HOTBAR_SIZE }, (_, i) => (
								<InventorySlot
									// biome-ignore lint/suspicious/noArrayIndexKey: hotbar position is the stable, meaningful key
									key={`train-hotbar-${i}`}
									area="hotbar"
									index={i}
								/>
							))}
						</section>
					</section>
				</div>
				<p className="inv-hint barn-hint">
					Drag stacks onto a cart to load · click a cart cell to unload ·
					Shift+E loads the selected hotbar stack
				</p>
				{message && (
					<p className="barn-message" data-testid="train-cargo-message">
						{message}
					</p>
				)}
			</div>
		</div>
	);
}
