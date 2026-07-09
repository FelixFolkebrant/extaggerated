import { Notice } from "obsidian";
import type { TFile } from "obsidian";
import type ExtaggeratedPlugin from "./main";
import { generateTags, hashNoteBody, noteBodyForHash } from "./tagging";

export interface SyncNoteTagsResult {
	tagCount: number;
}

export async function syncActiveNoteTags(
	plugin: ExtaggeratedPlugin,
): Promise<void> {
	const file = plugin.app.workspace.getActiveFile();

	if (!file || file.extension !== "md") {
		new Notice("Open a markdown note before syncing XT tags.");
		return;
	}

	if (plugin.settings.openRouterApiKey.length === 0) {
		new Notice("Add an OpenRouter API key before syncing XT tags.");
		return;
	}

	const confirmed = window.confirm(
		`XT will overwrite the tags property in ${file.basename}. Continue?`,
	);

	if (!confirmed) {
		return;
	}

	try {
		const result = await syncNoteTags(plugin, file);
		new Notice(`Synced ${result.tagCount} XT tags for ${file.basename}.`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		new Notice(`XT tag sync failed: ${message}`);
	}
}

export async function syncNoteTags(
	plugin: ExtaggeratedPlugin,
	file: TFile,
): Promise<SyncNoteTagsResult> {
	if (plugin.settings.openRouterApiKey.length === 0) {
		throw new Error("Add an OpenRouter API key before syncing XT tags.");
	}

	const markdown = await plugin.app.vault.read(file);
	const contentHash = await hashNoteBody(markdown);
	const tags = await generateTags({
		apiKey: plugin.settings.openRouterApiKey,
		model: plugin.settings.model,
		noteText: noteBodyForHash(markdown),
	});

	if (tags.length === 0) {
		throw new Error("OpenRouter returned no usable tags.");
	}

	await writeTags(plugin, file, tags, contentHash);

	return { tagCount: tags.length };
}

async function writeTags(
	plugin: ExtaggeratedPlugin,
	file: TFile,
	tags: string[],
	contentHash: string,
): Promise<void> {
	await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
		frontmatter.tags = tags;
		frontmatter.xt_content_hash = contentHash;
	});
}
