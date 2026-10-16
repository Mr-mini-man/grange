import { useEffect, useState } from "react";
import { economy } from "./EconomyManager";

/** Live grangecoin balance that re-renders the calling component on change. */
export function useEconomyBalance(): number {
	const [balance, setBalance] = useState(economy.getBalance());
	useEffect(() => economy.subscribe(setBalance), []);
	return balance;
}
