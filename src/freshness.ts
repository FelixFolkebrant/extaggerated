import type { TFile } from "obsidian";
import type ExtaggeratedPlugin from "./main";
import { hashNoteBody } from "./tagging";

export type FreshnessStatus =
	| { type: "no-note" }
	| { type: "untagged"; fileName: string }
	| { type: "fresh"; fileName: string }
	| { type: "stale"; fileName: string }
	| { type: "unavailable"; fileName: string; message: string };

export async function getActiveNoteFreshness(
	plugin: ExtaggeratedPlugin,
): Promise<FreshnessStatus> {
	const file = plugin.app.workspace.getActiveFile();

	if (!file || file.extension !== "md") {
		return { type: "no-note" };
	}

	const storedHash = frontmatterHash(plugin, file);
	if (!storedHash) {
		return { fileName: file.basename, type: "untagged" };
	}

	try {
		const currentHash = await hashNoteBody(await plugin.app.vault.read(file));

		return {
			fileName: file.basename,
			type: currentHash === storedHash ? "fresh" : "stale",
		};
	} catch (error) {
		return {
			fileName: file.basename,
			message: error instanceof Error ? error.message : String(error),
			type: "unavailable",
		};
	}
}

function frontmatterHash(
	plugin: ExtaggeratedPlugin,
	file: TFile,
): string | null {
	const hash =
		plugin.app.metadataCache.getFileCache(file)?.frontmatter?.xt_content_hash;

	return typeof hash === "string" && hash.length > 0 ? hash : null;
}
