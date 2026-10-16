#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const CODE_LIMIT = 300;
const TOTAL_LIMIT = 500;
const ROOT = process.cwd();
const DIRS = ["src", "shared", "e2e", "scripts"];
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

/**
 * Counts the lines that contain code, ignoring blank lines and comments
 * (both `//` line comments and `/* ... *\/` blocks, including multi-line ones).
 */
function countCodeLines(lines) {
	let count = 0;
	let inBlock = false;

	for (const line of lines) {
		let hasCode = false;
		let i = 0;

		while (i < line.length) {
			const c = line[i];
			const next = line[i + 1];

			if (inBlock) {
				if (c === "*" && next === "/") {
					inBlock = false;
					i += 2;
				} else {
					i += 1;
				}
				continue;
			}

			if (c === "/" && next === "/") break;
			if (c === "/" && next === "*") {
				inBlock = true;
				i += 2;
				continue;
			}
			if (c === " " || c === "\t") {
				i += 1;
				continue;
			}

			hasCode = true;
			i += 1;
		}

		if (hasCode) count += 1;
	}

	return count;
}

/** Splits into lines, dropping the trailing empty element from a final newline. */
function splitLines(source) {
	const lines = [];
	for (const raw of source.split("\n")) {
		lines.push(raw.endsWith("\r") ? raw.slice(0, -1) : raw);
	}
	if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
	return lines;
}

function collectFiles(dir) {
	const out = [];
	for (const entry of readdirSync(join(ROOT, dir))) {
		const full = join(ROOT, dir, entry);
		if (statSync(full).isDirectory()) {
			out.push(...collectFiles(join(dir, entry)));
		} else if (EXTS.has(extname(entry))) {
			out.push(full);
		}
	}
	return out;
}

const files = DIRS.flatMap(collectFiles);
const violations = [];

for (const file of files) {
	const lines = splitLines(readFileSync(file, "utf8"));
	const code = countCodeLines(lines);
	const total = lines.length;
	if (code > CODE_LIMIT || total > TOTAL_LIMIT) {
		violations.push({ file: file.slice(ROOT.length + 1), code, total });
	}
}

if (violations.length > 0) {
	for (const v of violations) {
		console.error(
			`FAIL ${v.file}: ${v.code} code lines (limit ${CODE_LIMIT}), ` +
				`${v.total} total lines (limit ${TOTAL_LIMIT})`,
		);
	}
	console.error(
		`\n${violations.length} file(s) exceed ${CODE_LIMIT} code lines or ${TOTAL_LIMIT} total lines.`,
	);
	process.exit(1);
}

console.log(
	`OK: ${files.length} file(s) at or under ${CODE_LIMIT} code lines and ${TOTAL_LIMIT} total lines.`,
);
