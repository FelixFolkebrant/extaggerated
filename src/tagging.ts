import { requestOpenRouterJson } from "./openRouter";

export interface TaggingRequest {
	apiKey: string;
	model: string;
	notes: TaggingNote[];
}

export interface TaggingNote {
	id: string;
	noteText: string;
}

export interface RetrievalTagRequest {
	apiKey: string;
	description: string;
	model: string;
	name: string;
}

export const TAGGING_PROMPT =
	'You generate Obsidian tags. Return only JSON in the format {"results":[{"id":"input note id","tags":["tag"]}]}. Return one result for every input note and preserve its id. Tags must be lowercase, factual, singular nouns by default, one concept each, and use kebab-case when multiple words are needed. Avoid broad tags like note, information, interesting, idea, notes, or knowledge.';

export function normalizeTags(tags: string[]): string[] {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const tag of tags) {
		const value = tag
			.trim()
			.toLowerCase()
			.normalize("NFC")
			.replace(/^#/, "")
			.replace(/['"]/g, "")
			.replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
			.replace(/^-+|-+$/g, "");

		if (value.length === 0 || seen.has(value)) {
			continue;
		}

		seen.add(value);
		normalized.push(value);
	}

	return normalized;
}

export function noteBodyForHash(markdown: string): string {
	return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

export async function hashNoteBody(markdown: string): Promise<string> {
	const bytes = new TextEncoder().encode(noteBodyForHash(markdown));
	const digest = await crypto.subtle.digest("SHA-256", bytes);

	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

export async function generateTagsForNotes({
	apiKey,
	model,
	notes,
}: TaggingRequest): Promise<Map<string, string[]>> {
	if (notes.length === 0) {
		throw new Error("OpenRouter needs at least one note to generate tags.");
	}

	const maxCompletionTokens = Math.max(1_024, notes.length * 128);

	const parsed = await requestOpenRouterJson<{ results?: unknown }>({
		apiKey,
		emptyResponseMessage: "OpenRouter returned no tags.",
		incompleteJsonMessage:
			"OpenRouter returned incomplete JSON. Lower the maximum batch token budget.",
		maxCompletionTokens,
		messages: [
			{
				content: TAGGING_PROMPT,
				role: "system",
			},
			{
				content: JSON.stringify(notes),
				role: "user",
			},
		],
		model,
		truncatedResponseMessage: `OpenRouter cut off the batch response at ${maxCompletionTokens} completion tokens. Lower the maximum batch token budget.`,
	});
	if (!Array.isArray(parsed.results)) {
		throw new Error("OpenRouter returned batch tags in an unexpected format.");
	}

	const requestedIds = new Set(notes.map((note) => note.id));
	const tagsById = new Map<string, string[]>();

	for (const [index, result] of parsed.results.entries()) {
		if (
			typeof result !== "object" ||
			result === null ||
			!("id" in result) ||
			!("tags" in result) ||
			typeof result.id !== "string" ||
			!Array.isArray(result.tags) ||
			!result.tags.every((tag: unknown) => typeof tag === "string") ||
			!requestedIds.has(result.id) ||
			tagsById.has(result.id)
		) {
			throw new Error(
				`OpenRouter returned an invalid result at position ${index + 1}.`,
			);
		}

		tagsById.set(result.id, normalizeTags(result.tags));
	}

	if (tagsById.size !== requestedIds.size) {
		throw new Error("OpenRouter returned incomplete batch tags.");
	}

	return tagsById;
}

export async function generateRetrievalTags({
	apiKey,
	description,
	model,
	name,
}: RetrievalTagRequest): Promise<string[]> {
	const tags = (
		await generateTagsForNotes({
			apiKey,
			model,
			notes: [
				{
					id: "node",
					noteText: `Node name: ${name}\nDescription: ${description}`,
				},
			],
		})
	).get("node");

	if (!tags || tags.length === 0) {
		throw new Error("OpenRouter returned no usable retrieval tags.");
	}

	return tags;
}
