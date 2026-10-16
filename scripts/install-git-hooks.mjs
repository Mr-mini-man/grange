#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hooksDir = join(root, ".githooks");

function git(args) {
	return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

// A packed release or tarball is not a git checkout; nothing to install.
try {
	if (git(["rev-parse", "--is-inside-work-tree"]) !== "true") process.exit(0);
} catch {
	process.exit(0);
}

if (!existsSync(hooksDir)) process.exit(0);

// Point git at the committed hooks instead of copying files into .git/hooks.
git(["config", "core.hooksPath", ".githooks"]);

for (const entry of readdirSync(hooksDir)) {
	chmodSync(join(hooksDir, entry), 0o755);
}

console.log("Git hooks installed (core.hooksPath=.githooks).");
