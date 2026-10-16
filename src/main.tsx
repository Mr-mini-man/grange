import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { saveBalanceDelta } from "./auth";
import { initSocket } from "./socket";
import { economy } from "./world/EconomyManager";
import "./index.css";

// Mirror in-game spending and earnings to the signed-in account.
economy.setOnChange(saveBalanceDelta);
initSocket();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
	<StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</StrictMode>,
);
