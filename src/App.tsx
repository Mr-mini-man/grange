import { Route, Routes } from "react-router-dom";
import Dashboard from "./routes/Dashboard";
import ForgotPassword from "./routes/ForgotPassword";
import Game from "./routes/Game";
import Login from "./routes/Login";
import RequireAuth from "./routes/RequireAuth";
import ResetPassword from "./routes/ResetPassword";
import VerifyEmail from "./routes/VerifyEmail";
import FarmMap from "./world/FarmMap";

export default function App() {
	return (
		<Routes>
			<Route path="/" element={<Login />} />
			<Route path="/verify" element={<VerifyEmail />} />
			<Route path="/forgot" element={<ForgotPassword />} />
			<Route path="/reset" element={<ResetPassword />} />
			<Route
				path="/world"
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
