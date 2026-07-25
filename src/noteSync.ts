import type { TFile } from "obsidian";
import { Notice } from "obsidian";
import { hasXtTags, isFileIgnored } from "./freshness";
import type ExtaggeratedPlugin from "./main";
import { generateTags, hashNoteBody, noteBodyForHash } from "./tagging";

export interface SyncNoteTagsResult {
	tagCount: number;
}

export async function syncActiveNoteTags(
	plugin: ExtaggeratedPlugin,
): Promise<void> {
	const file = plugin.app.workspace.getActiveFile();

	if (file?.extension !== "md") {
		new Notice("Open a markdown note before syncing XT tags.");
		return;
	}

	if (isFileIgnored(plugin, file)) {
		new Notice(`${file.basename} is ignored by XT.`);
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

export async function ignoreActiveNote(
	plugin: ExtaggeratedPlugin,
): Promise<void> {
	const file = plugin.app.workspace.getActiveFile();

	if (file?.extension !== "md") {
		new Notice("Open a markdown note before ignoring it.");
		return;
	}

	if (isFileIgnored(plugin, file)) {
		new Notice(`${file.basename} is already ignored by XT.`);
		return;
	}

	const removesXtTags = hasXtTags(plugin, file);
	if (
		removesXtTags &&
		!window.confirm(
			`XT will remove the tags it created in ${file.basename} and its sync metadata, then set xt_ignore: true. Continue?`,
		)
	) {
		return;
	}

	await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
		if (removesXtTags) {
			delete frontmatter.tags;
			delete frontmatter.xt_content_hash;
		}
		frontmatter.xt_ignore = true;
	});

	new Notice(`XT now ignores ${file.basename}.`);
}

export async function syncNoteTags(
	plugin: ExtaggeratedPlugin,
	file: TFile,
): Promise<SyncNoteTagsResult> {
	if (isFileIgnored(plugin, file)) {
		throw new Error(`${file.basename} is ignored by XT.`);
	}

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
