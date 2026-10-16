import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cwd = resolve(root, "backend");
const args = process.argv.slice(2);

function onPath(command) {
	const result = spawnSync(command, ["--version"], { stdio: "ignore" });
	return result.error?.code !== "ENOENT";
}

/**
 * Visual Studio Build Tools install `cl`/`nmake`, but only expose them via a
 * batch script that also sets INCLUDE/LIB. Native deps (argon2_elixir) need
 * that environment, so capture it once and merge it into the child env.
 */
function msvcEnvironment() {
	if (process.platform !== "win32" || onPath("nmake")) return {};

	const vswhere = join(
		process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
		"Microsoft Visual Studio",
		"Installer",
		"vswhere.exe",
	);
	if (!existsSync(vswhere)) return {};

	const found = spawnSync(
		vswhere,
		[
			"-latest",
			"-products",
			"*",
			"-requires",
			"Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
			"-property",
			"installationPath",
		],
		{ encoding: "utf8" },
	);
	const install = found.stdout?.trim();
	if (!install) return {};

	const vcvars = join(install, "VC", "Auxiliary", "Build", "vcvars64.bat");
	if (!existsSync(vcvars)) return {};

	const captured = spawnSync(`call "${vcvars}" >nul && set`, {
		encoding: "utf8",
		shell: true,
	});
	const env = {};
	for (const line of captured.stdout?.split(/\r?\n/) ?? []) {
		const eq = line.indexOf("=");
		if (eq > 0) env[line.slice(0, eq)] = line.slice(eq + 1);
	}
	return env;
}

const env = { ...process.env, ...msvcEnvironment() };

const direct = spawnSync("mix", args, { cwd, stdio: "inherit", env });
if (direct.error?.code !== "ENOENT") {
	process.exit(direct.status ?? 1);
}

const viaMise = spawnSync("mise", ["x", "--", "mix", ...args], {
	cwd,
	stdio: "inherit",
	env,
});
if (viaMise.error?.code === "ENOENT") {
	console.error("Could not find mix or mise. Install Elixir or mise first.");
}
process.exit(viaMise.status ?? 1);
