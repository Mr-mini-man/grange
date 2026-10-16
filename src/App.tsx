import { Route, Routes } from "react-router-dom";
import Dashboard from "./routes/Dashboard";
import Login from "./routes/Login";
import MainMenu from "./routes/MainMenu";
import RequireAuth from "./routes/RequireAuth";
import FarmMap from "./world/FarmMap";

export default function App() {
	return (
		<Routes>
			<Route path="/" element={<MainMenu />} />
			<Route path="/login" element={<Login />} />
			<Route
				path="/world"
				element={
					<RequireAuth>
						<FarmMap />
					</RequireAuth>
				}
			/>
			<Route
				path="/farms/:owner"
				element={
					<RequireAuth>
						<FarmMap />
					</RequireAuth>
				}
			/>
			<Route
				path="/dashboard"
				element={
					<RequireAuth>
						<Dashboard />
					</RequireAuth>
				}
			/>
		</Routes>
	);
}
