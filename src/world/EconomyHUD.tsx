import type React from "react";
import { useEconomyBalance } from "./useEconomy";

export const EconomyHUD: React.FC = () => {
	const balance = useEconomyBalance();

	return (
		<span className="farm-map-balance" data-testid="farm-balance">
			<span className="farm-map-balance-symbol">$</span>
			{balance.toLocaleString()}
		</span>
	);
};
