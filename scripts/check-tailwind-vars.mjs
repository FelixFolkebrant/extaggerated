import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const badPattern = "-[var(--";
const roots = ["src"];
const matches = [];

async function scan(path) {
	const entries = await readdir(path, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = join(path, entry.name);

		if (entry.isDirectory()) {
			await scan(entryPath);
			continue;
		}

		if (!/\.(ts|tsx)$/.test(entry.name)) {
			continue;
		}

		const text = await readFile(entryPath, "utf8");
		const lines = text.split("\n");

		lines.forEach((line, index) => {
			if (line.includes(badPattern)) {
				matches.push(`${entryPath}:${index + 1}: ${line.trim()}`);
			}
		});
	}
}

for (const root of roots) {
	await scan(root);
}

if (matches.length > 0) {
	console.error(
		[
			"Use Tailwind CSS variable shorthand like text-(--text-muted), not text-[var(--text-muted)].",
			...matches,
		].join("\n"),
	);
	process.exit(1);
}
