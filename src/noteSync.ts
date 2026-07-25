import type { TFile } from "obsidian";
import { Notice } from "obsidian";
import { hasXtTags, isFileIgnored } from "./freshness";
import type ExtaggeratedPlugin from "./main";
import { groupByTokenBudget, estimateTokens } from "./tagBatching";
import { generateTagsForNotes, hashNoteBody, noteBodyForHash } from "./tagging";

export interface SyncNoteTagsResult {
	tagCount: number;
}

export interface SyncNoteTagBatchOutcome {
	error?: Error;
	file: TFile;
	result?: SyncNoteTagsResult;
}

interface PreparedNote {
	contentHash: string;
	file: TFile;
	noteText: string;
	estimatedTokens: number;
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

export async function clearXtStateFromActiveNote(
	plugin: ExtaggeratedPlugin,
): Promise<boolean> {
	const file = plugin.app.workspace.getActiveFile();

	if (file?.extension !== "md") {
		new Notice("Open a markdown note before clearing XT metadata.");
		return false;
	}

	if (!hasXtMetadata(plugin, file)) {
		new Notice(`${file.basename} has no XT metadata to clear.`);
		return false;
	}

	if (
		!window.confirm(
			`XT will clear its metadata from ${file.basename}. Continue?`,
		)
	) {
		return false;
	}

	await clearXtState(plugin, file);
	new Notice(`Cleared XT metadata from ${file.basename}.`);
	return true;
}

export async function clearXtStateFromVault(
	plugin: ExtaggeratedPlugin,
): Promise<void> {
	const files = plugin.app.vault
		.getMarkdownFiles()
		.filter((file) => hasXtMetadata(plugin, file));

	if (files.length === 0) {
		new Notice("No notes have XT metadata to clear.");
		return;
	}

	if (
		!window.confirm(
			`XT will clear its metadata from ${files.length} note${files.length === 1 ? "" : "s"}. Continue?`,
		)
	) {
		return;
	}

	for (const file of files) {
		await clearXtState(plugin, file);
	}

	new Notice(
		`Cleared XT metadata from ${files.length} note${files.length === 1 ? "" : "s"}.`,
	);
}

export async function syncNoteTags(
	plugin: ExtaggeratedPlugin,
	file: TFile,
): Promise<SyncNoteTagsResult> {
	let outcome: SyncNoteTagBatchOutcome | undefined;
	await syncNoteTagBatch(plugin, [file], (result) => {
		outcome = result;
	});

	if (outcome?.result) {
		return outcome.result;
	}

	throw outcome?.error ?? new Error("XT tag sync failed.");
}

export async function syncNoteTagBatch(
	plugin: ExtaggeratedPlugin,
	files: TFile[],
	onComplete: (outcome: SyncNoteTagBatchOutcome) => void,
): Promise<void> {
	if (plugin.settings.openRouterApiKey.length === 0) {
		throw new Error("Add an OpenRouter API key before syncing XT tags.");
	}

	const notes: PreparedNote[] = [];
	for (const file of files) {
		if (isFileIgnored(plugin, file)) {
			onComplete({
				error: new Error(`${file.basename} is ignored by XT.`),
				file,
			});
			continue;
		}

		try {
			const markdown = await plugin.app.vault.read(file);
			const noteText = noteBodyForHash(markdown);
			notes.push({
				contentHash: await hashNoteBody(markdown),
				estimatedTokens: estimateTokens(noteText),
				file,
				noteText,
			});
		} catch (error) {
			onComplete({ error: toError(error), file });
		}
	}

	const batches = groupByTokenBudget(notes, plugin.settings.maxBatchTokens);

	for (const batch of batches) {
		const taggedNotes = batch.map((note, index) => ({
			id: String(index),
			note,
		}));

		try {
			const tagsById = await generateTagsForNotes({
				apiKey: plugin.settings.openRouterApiKey,
				model: plugin.settings.model,
				notes: taggedNotes.map(({ id, note }) => ({
					id,
					noteText: note.noteText,
				})),
			});

			for (const { id, note } of taggedNotes) {
				const tags = tagsById.get(id);
				if (!tags || tags.length === 0) {
					onComplete({
						error: new Error("OpenRouter returned no usable tags."),
						file: note.file,
					});
					continue;
				}

				try {
					await writeTags(plugin, note.file, tags, note.contentHash);
					onComplete({ file: note.file, result: { tagCount: tags.length } });
				} catch (error) {
					onComplete({ error: toError(error), file: note.file });
				}
			}
		} catch (error) {
			const batchError = toError(error);
			for (const note of batch) {
				onComplete({ error: batchError, file: note.file });
			}
		}
	}
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

function hasXtMetadata(plugin: ExtaggeratedPlugin, file: TFile): boolean {
	const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;

	return (
		frontmatter !== undefined &&
		(Object.hasOwn(frontmatter, "xt_content_hash") ||
			Object.hasOwn(frontmatter, "xt_ignore"))
	);
}

async function clearXtState(
	plugin: ExtaggeratedPlugin,
	file: TFile,
): Promise<void> {
	await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
		if (Object.hasOwn(frontmatter, "xt_content_hash")) {
			delete frontmatter.tags;
			delete frontmatter.xt_content_hash;
		}
		delete frontmatter.xt_ignore;
	});
}
