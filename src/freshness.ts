import type { TFile } from "obsidian";
import type ExtaggeratedPlugin from "./main";
import { hashNoteBody } from "./tagging";

export type FreshnessStatus =
	| { type: "no-note" }
	| { type: "untagged"; fileName: string }
	| { type: "fresh"; fileName: string }
	| { type: "stale"; fileName: string }
	| { type: "unavailable"; fileName: string; message: string };

export type QueueFreshnessStatus = Exclude<
	FreshnessStatus,
	{ type: "no-note" }
>;

export interface ChangedFileQueueItem {
	fileName: string;
	path: string;
	status: QueueFreshnessStatus["type"];
	message?: string;
}

export async function getActiveNoteFreshness(
	plugin: ExtaggeratedPlugin,
): Promise<FreshnessStatus> {
	const file = plugin.app.workspace.getActiveFile();

	if (!file || file.extension !== "md") {
		return { type: "no-note" };
	}

	return getFileFreshness(plugin, file);
}

export async function getChangedFileQueue(
	plugin: ExtaggeratedPlugin,
): Promise<ChangedFileQueueItem[]> {
	const queue: ChangedFileQueueItem[] = [];

	for (const file of plugin.app.vault.getMarkdownFiles()) {
		const freshness = await getFileFreshness(plugin, file);

		if (freshness.type === "fresh") {
			continue;
		}

		queue.push({
			fileName: freshness.fileName,
			message: freshness.type === "unavailable" ? freshness.message : undefined,
			path: file.path,
			status: freshness.type,
		});
	}

	return queue.sort((a, b) => a.path.localeCompare(b.path));
}

async function getFileFreshness(
	plugin: ExtaggeratedPlugin,
	file: TFile,
): Promise<QueueFreshnessStatus> {
	try {
		const markdown = await plugin.app.vault.read(file);
		const storedHash = frontmatterHash(plugin, file);

		if (!storedHash) {
			return { fileName: file.basename, type: "untagged" };
		}

		const currentHash = await hashNoteBody(markdown);

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
