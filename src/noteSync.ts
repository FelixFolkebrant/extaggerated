import type { TFile } from "obsidian";
import { getFrontMatterInfo, Notice, parseYaml, stringifyYaml } from "obsidian";
import { hasXtTags, isFileIgnored } from "./freshness";
import type ExtaggeratedPlugin from "./main";
import { estimateTokens, groupByTokenBudget } from "./tagBatching";
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
): Promise<boolean> {
	const file = plugin.app.workspace.getActiveFile();

	if (file?.extension !== "md") {
		new Notice("Open a markdown note before ignoring it.");
		return false;
	}

	if (isFileIgnored(plugin, file)) {
		new Notice(`${file.basename} is already ignored by XT.`);
		return false;
	}

	const removesXtTags = hasXtTags(plugin, file);
	if (
		removesXtTags &&
		!window.confirm(
			`XT will remove the tags it created in ${file.basename} and its sync metadata, then set xt_ignore: true. Continue?`,
		)
	) {
		return false;
	}

	try {
		await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			if (removesXtTags) {
				delete frontmatter.tags;
				delete frontmatter.xt_content_hash;
			}
			delete frontmatter.xt_failure;
			frontmatter.xt_ignore = true;
		});
	} catch (error) {
		new Notice(`Could not ignore ${file.path}: ${toError(error).message}`);
		return false;
	}

	new Notice(`XT now ignores ${file.basename}.`);
	return true;
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

	try {
		await clearXtState(plugin, file);
	} catch (error) {
		new Notice(
			`Could not clear XT metadata from ${file.path}: ${toError(error).message}`,
		);
		return false;
	}

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

	const failures: string[] = [];
	for (const file of files) {
		try {
			await clearXtState(plugin, file);
		} catch (error) {
			failures.push(`${file.path}: ${toError(error).message}`);
		}
	}

	const cleared = files.length - failures.length;
	if (failures.length > 0) {
		new Notice(
			`Cleared XT metadata from ${cleared} of ${files.length} notes. Failed: ${failures.join("; ")}`,
		);
		return;
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
			await completeFailure(
				plugin,
				file,
				new Error(`${file.basename} is ignored by XT.`),
				onComplete,
			);
			continue;
		}

		try {
			await clearXtFailure(plugin, file);
			const markdown = await plugin.app.vault.read(file);
			const noteText = noteBodyForHash(markdown);
			notes.push({
				contentHash: await hashNoteBody(markdown),
				estimatedTokens: estimateTokens(noteText),
				file,
				noteText,
			});
		} catch (error) {
			await completeFailure(plugin, file, toError(error), onComplete);
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
					await completeFailure(
						plugin,
						note.file,
						new Error("OpenRouter returned no usable tags."),
						onComplete,
					);
					continue;
				}

				try {
					await writeTags(
						plugin,
						note.file,
						tags,
						note.contentHash,
						note.noteText,
					);
					onComplete({ file: note.file, result: { tagCount: tags.length } });
				} catch (error) {
					await completeFailure(plugin, note.file, toError(error), onComplete);
				}
			}
		} catch (error) {
			const batchError = toError(error);
			for (const note of batch) {
				await completeFailure(plugin, note.file, batchError, onComplete);
			}
		}
	}
}

async function writeTags(
	plugin: ExtaggeratedPlugin,
	file: TFile,
	tags: string[],
	contentHash: string,
	expectedBody: string,
): Promise<void> {
	await plugin.app.vault.process(file, (markdown) => {
		if (noteBodyForHash(markdown) !== expectedBody) {
			throw new Error(`${file.basename} changed while XT was generating tags.`);
		}

		return updateFrontmatter(markdown, (frontmatter) => {
			frontmatter.tags = tags;
			frontmatter.xt_content_hash = contentHash;
			delete frontmatter.xt_failure;
		});
	});
}

function updateFrontmatter(
	markdown: string,
	mutate: (frontmatter: Record<string, unknown>) => void,
): string {
	const info = getFrontMatterInfo(markdown);
	const parsed = info.exists ? parseYaml(info.frontmatter) : {};
	const frontmatter =
		typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
			? parsed
			: {};

	mutate(frontmatter);
	const yaml = stringifyYaml(frontmatter).trimEnd();

	if (!info.exists) {
		return `---\n${yaml}\n---\n${markdown}`;
	}

	return `${markdown.slice(0, info.from)}${yaml}\n${markdown.slice(info.to)}`;
}

async function completeFailure(
	plugin: ExtaggeratedPlugin,
	file: TFile,
	error: Error,
	onComplete: (outcome: SyncNoteTagBatchOutcome) => void,
): Promise<void> {
	try {
		await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter.xt_failure = {
				message: error.message,
				name: error.name,
				...(error.stack === undefined ? {} : { stack: error.stack }),
			};
		});
	} catch (cause) {
		onComplete({
			error: new Error(
				`XT could not save the failure report: ${toError(cause).message}`,
			),
			file,
		});
		return;
	}

	onComplete({ error, file });
}

async function clearXtFailure(
	plugin: ExtaggeratedPlugin,
	file: TFile,
): Promise<void> {
	const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
	if (!frontmatter || !Object.hasOwn(frontmatter, "xt_failure")) {
		return;
	}

	await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
		delete frontmatter.xt_failure;
	});
}

function hasXtMetadata(plugin: ExtaggeratedPlugin, file: TFile): boolean {
	const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;

	return (
		frontmatter !== undefined &&
		(Object.hasOwn(frontmatter, "xt_content_hash") ||
			Object.hasOwn(frontmatter, "xt_failure") ||
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
		delete frontmatter.xt_failure;
		delete frontmatter.xt_ignore;
	});
}

function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}
