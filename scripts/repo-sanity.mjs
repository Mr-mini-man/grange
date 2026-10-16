#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const MAX_BYTES = 1_000_000;
const REV = process.env.SANITY_REV || "HEAD";

const NODE_MODULES = /(^|\/)node_modules(\/|$)/;

const JUNK_PATTERNS = [
	/(^|\/)dist\//,
	/(^|\/)build\//,
	/(^|\/)out\//,
	/(^|\/)deps\//,
	/(^|\/)_build\//,
	/(^|\/)priv\/static\//,
	/(^|\/)coverage\//,
	/(^|\/)playwright-report\//,
	/(^|\/)test-results\//,
	/\.log$/,
	/\.tsbuildinfo$/,
	/(^|\/)\.DS_Store$/,
	/(^|\/)Thumbs\.db$/,
	/\.swp$/,
	/~$/,
	/(^|\/)\.idea\//,
];

const SECRET_FILE = /(^|\/)(\.env(\.[^/]+)?|.*\.pem|.*\.key|.*\.p12|.*\.pfx|id_rsa|id_ed25519)$/;
const SECRET_FILE_ALLOW = /(^|\/)\.env\.(example|sample|template)$/;

const TEXT_EXTS = new Set([
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".ex",
	".exs",
	".heex",
	".json",
	".jsonc",
	".yml",
	".yaml",
	".md",
	".css",
	".html",
	".txt",
	".toml",
	".sh",
	".conf",
]);

function git(args) {
	return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function listCommittedFiles() {
	const out = git(["ls-tree", "-r", "-l", "-z", REV]);
	const files = [];
	for (const record of out.split("\0")) {
		if (!record) continue;
		const match = record.match(/^\d+ blob [0-9a-f]+ +(\d+)\t(.*)$/s);
		if (!match) continue;
		files.push({ size: Number(match[1]), path: match[2] });
	}
	return files;
}

function hasConflictMarkers(path, ext) {
	if (!TEXT_EXTS.has(ext)) return false;
	let source;
	try {
		source = git(["cat-file", "blob", `${REV}:${path}`]);
	} catch {
		return false;
	}
	let open = false;
	let separator = false;
	for (const raw of source.split("\n")) {
		const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
		if (/^<{7}( |$)/.test(line)) {
			open = true;
			separator = false;
		} else if (open && /^={7}( |$)/.test(line)) {
			separator = true;
		} else if (open && separator && /^>{7}( |$)/.test(line)) {
			return true;
		}
	}
	return false;
}

function extname(path) {
	const base = path.slice(path.lastIndexOf("/") + 1);
	const dot = base.lastIndexOf(".");
	return dot > 0 ? base.slice(dot) : "";
}

function human(bytes) {
	if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
	if (bytes >= 1000) return `${(bytes / 1000).toFixed(1)}KB`;
	return `${bytes}B`;
}

const files = listCommittedFiles();
const violations = [];
const seen = new Map();

for (const { path, size } of files) {
	if (NODE_MODULES.test(path)) {
		violations.push(`FAIL ${path}: node_modules must not be committed`);
	}
	if (size > MAX_BYTES) {
		violations.push(`FAIL ${path}: ${human(size)} exceeds ${human(MAX_BYTES)} limit`);
	}
	if (JUNK_PATTERNS.some((pattern) => pattern.test(path))) {
		violations.push(`FAIL ${path}: generated/build artifact or junk file`);
	}
	if (SECRET_FILE.test(path) && !SECRET_FILE_ALLOW.test(path)) {
		violations.push(`FAIL ${path}: file looks like a secret`);
	}
	if (hasConflictMarkers(path, extname(path))) {
		violations.push(`FAIL ${path}: contains merge conflict markers`);
	}

	const lower = path.toLowerCase();
	if (seen.has(lower)) {
		violations.push(`FAIL ${path}: case-only collision with ${seen.get(lower)}`);
	} else {
		seen.set(lower, path);
	}
}

if (violations.length > 0) {
	for (const violation of violations) {
		console.error(violation);
	}
	console.error(`\n${violations.length} violation(s) found in ${files.length} committed file(s).`);
	process.exit(1);
}

console.log(`OK: ${files.length} committed file(s); no node_modules, junk, secrets, conflict markers, case collisions, or oversized files.`);
