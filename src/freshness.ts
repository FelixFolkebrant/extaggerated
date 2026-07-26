import type { TFile } from "obsidian";
import type ExtaggeratedPlugin from "./main";
import { hashNoteBody } from "./tagging";

export type FreshnessStatus =
	| { type: "no-note" }
	| { type: "ignored"; fileName: string }
	| { type: "untagged"; fileName: string }
	| { type: "fresh"; fileName: string }
	| { type: "stale"; fileName: string }
	| { type: "unavailable"; fileName: string; message: string };

export type FileFreshnessStatus = Exclude<FreshnessStatus, { type: "no-note" }>;

type CalculatedFreshnessStatus = Exclude<
	FileFreshnessStatus,
	{ type: "ignored" }
>;

export interface ChangedFileQueueItem {
	fileName: string;
	path: string;
	status: FileFreshnessStatus["type"];
	message?: string;
}

const XT_FAILURE_PROPERTY = "xt_failure";

export async function getActiveNoteFreshness(
	plugin: ExtaggeratedPlugin,
): Promise<FreshnessStatus> {
	const file = plugin.app.workspace.getActiveFile();

	if (file?.extension !== "md") {
		return { type: "no-note" };
	}

	if (isFileIgnored(plugin, file)) {
		return { fileName: file.basename, type: "ignored" };
	}

	return getFileFreshness(plugin, file);
}

export async function getChangedFileQueue(
	plugin: ExtaggeratedPlugin,
): Promise<ChangedFileQueueItem[]> {
	const queue: ChangedFileQueueItem[] = [];

	for (const file of plugin.app.vault.getMarkdownFiles()) {
		const freshness = isFileIgnored(plugin, file)
			? { fileName: file.basename, type: "ignored" as const }
			: await getFileFreshness(plugin, file);

		queue.push({
			fileName: freshness.fileName,
			message: freshness.type === "unavailable" ? freshness.message : undefined,
			path: file.path,
			status: freshness.type,
		});
	}

	return queue.sort((a, b) => a.path.localeCompare(b.path));
}

export function isTaggableFile(file: ChangedFileQueueItem): boolean {
	return file.status === "stale" || file.status === "untagged";
}

async function getFileFreshness(
	plugin: ExtaggeratedPlugin,
	file: TFile,
): Promise<CalculatedFreshnessStatus> {
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

export function isFileIgnored(
	plugin: ExtaggeratedPlugin,
	file: TFile,
): boolean {
	return (
		plugin.app.metadataCache.getFileCache(file)?.frontmatter?.xt_ignore === true
	);
}

export function hasXtTags(plugin: ExtaggeratedPlugin, file: TFile): boolean {
	return frontmatterHash(plugin, file) !== null;
}

export function getXtFailure(
	plugin: ExtaggeratedPlugin,
	file: TFile,
): Error | null {
	const value =
		plugin.app.metadataCache.getFileCache(file)?.frontmatter?.[
			XT_FAILURE_PROPERTY
		];

	if (typeof value === "string" && value.length > 0) {
		return new Error(value);
	}

	if (
		typeof value !== "object" ||
		value === null ||
		!("message" in value) ||
		typeof value.message !== "string"
	) {
		return null;
	}

	const error = new Error(value.message);
	if ("name" in value && typeof value.name === "string") {
		error.name = value.name;
	}
	if ("stack" in value && typeof value.stack === "string") {
		error.stack = value.stack;
	}
	return error;
}
