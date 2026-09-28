import { Route, Routes } from "react-router-dom";
import Dashboard from "./routes/Dashboard";
import Game from "./routes/Game";
import Login from "./routes/Login";
import RequireAuth from "./routes/RequireAuth";

export default function App() {
	return (
		<Routes>
			<Route path="/" element={<Login />} />
			<Route
				path="/dashboard"
				element={
					<RequireAuth>
						<Dashboard />
					</RequireAuth>
				}
			/>
			<Route
				path="/games/:uuid"
				element={
					<RequireAuth>
						<Game />
					</RequireAuth>
				}
			/>
		</Routes>
	);
}
