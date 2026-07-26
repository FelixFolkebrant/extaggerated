import type { TFile } from "obsidian";
import { TFolder } from "obsidian";
import type ExtaggeratedPlugin from "./main";
import { parseNodeDocument, renderNodeDocument } from "./nodeDocument";
import { findNodeCandidates } from "./nodeRetrieval";
import { requestOpenRouterJson } from "./openRouter";
import { generateRetrievalTags } from "./tagging";

const NODE_DOCUMENT_PROMPT = `You create concise Obsidian megathreads. Return only JSON with an overview string and a sources array. Each source must have an id from the supplied candidates and a context string explaining why that note belongs in this node. Select at least one relevant candidate. Overview and context must be plain text: do not write Markdown links, wikilinks, paths, headings, or IDs other than the source id field.`;

export interface NodeDraft {
	description: string;
	name: string;
}

interface PreparedNodeCandidate {
	content: string;
	file: TFile;
	id: string;
}

export async function generateNode(
	plugin: ExtaggeratedPlugin,
	draft: NodeDraft,
): Promise<void> {
	if (plugin.settings.openRouterApiKey.length === 0) {
		throw new Error("Add an OpenRouter API key before creating a node.");
	}

	const name = nodeName(draft.name);
	const folder = nodeFolder(plugin.settings.nodesFolder);
	const destination = `${folder}/${name}.md`;
	assertDestinationAvailable(plugin, destination);

	const retrievalTags = await generateRetrievalTags({
		apiKey: plugin.settings.openRouterApiKey,
		description: draft.description,
		model: plugin.settings.model,
		name,
	});
	const files = findNodeCandidates(
		plugin.app.vault,
		plugin.app.metadataCache,
		retrievalTags,
		folder,
	);
	if (files.length === 0) {
		throw new Error("XT found no tagged notes for this node.");
	}

	const candidates = await readCandidates(plugin, files);
	const document = parseNodeDocument(
		await requestOpenRouterJson<unknown>({
			apiKey: plugin.settings.openRouterApiKey,
			emptyResponseMessage: "OpenRouter returned no node document.",
			incompleteJsonMessage: "OpenRouter returned incomplete node JSON.",
			maxCompletionTokens: Math.max(1_024, candidates.length * 256),
			messages: [
				{ content: NODE_DOCUMENT_PROMPT, role: "system" },
				{
					content: JSON.stringify({
						candidates: candidates.map(({ content, file, id }) => ({
							content,
							id,
							path: file.path,
						})),
						description: draft.description,
						name,
					}),
					role: "user",
				},
			],
			model: plugin.settings.model,
			truncatedResponseMessage:
				"OpenRouter cut off the node response. Narrow the node description or matching tags.",
		}),
		new Set(candidates.map((candidate) => candidate.id)),
	);
	const candidatesById = new Map(
		candidates.map((candidate) => [candidate.id, candidate]),
	);
	const markdown = renderNodeDocument(name, {
		overview: document.overview,
		sources: document.sources.map((source) => {
			const candidate = candidatesById.get(source.id);
			if (!candidate) {
				throw new Error("OpenRouter selected an unknown source note.");
			}

			return {
				context: source.context,
				link: plugin.app.fileManager.generateMarkdownLink(
					candidate.file,
					destination,
				),
			};
		}),
	});

	await ensureFolder(plugin, folder);
	assertDestinationAvailable(plugin, destination);
	const node = await plugin.app.vault.create(destination, markdown);
	await plugin.app.workspace.getLeaf(true).openFile(node);
}

export function nodeName(value: string): string {
	const name = value.trim();
	if (invalidPathSegment(name)) {
		throw new Error("Enter a node name that can be used as a file name.");
	}

	return name;
}

export function nodeFolder(value: string): string {
	const folder = value.trim().replace(/^\/+|\/+$/g, "");
	if (
		folder.length === 0 ||
		folder.split("/").some((segment) => invalidPathSegment(segment))
	) {
		throw new Error("Set a valid vault-relative nodes folder.");
	}

	return folder;
}

function invalidPathSegment(value: string): boolean {
	const segment = value.trim();
	return (
		segment.length === 0 ||
		segment !== value ||
		segment === "." ||
		segment === ".." ||
		segment.endsWith(".") ||
		/[\p{Cc}<>:"/\\|?*]/u.test(segment) ||
		/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(segment)
	);
}

function assertDestinationAvailable(
	plugin: ExtaggeratedPlugin,
	destination: string,
): void {
	if (plugin.app.vault.getAbstractFileByPath(destination)) {
		throw new Error(`A node already exists at ${destination}.`);
	}
}

async function readCandidates(
	plugin: ExtaggeratedPlugin,
	files: TFile[],
): Promise<PreparedNodeCandidate[]> {
	return Promise.all(
		files.map(async (file, index) => {
			try {
				return {
					content: await plugin.app.vault.read(file),
					file,
					id: String(index + 1),
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				throw new Error(`XT could not read ${file.path}: ${message}`);
			}
		}),
	);
}

async function ensureFolder(
	plugin: ExtaggeratedPlugin,
	folder: string,
): Promise<void> {
	let path = "";
	for (const segment of folder.split("/")) {
		path = path.length === 0 ? segment : `${path}/${segment}`;
		const existing = plugin.app.vault.getAbstractFileByPath(path);

		if (existing instanceof TFolder) {
			continue;
		}
		if (existing) {
			throw new Error(
				`Cannot create the nodes folder because ${path} is a file.`,
			);
		}

		await plugin.app.vault.createFolder(path);
	}
}
