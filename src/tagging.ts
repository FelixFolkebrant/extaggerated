import { requestUrl } from "obsidian";

export interface TaggingRequest {
	apiKey: string;
	model: string;
	notes: TaggingNote[];
}

export interface TaggingNote {
	id: string;
	noteText: string;
}

export const TAGGING_PROMPT =
	"You generate Obsidian tags. Return only JSON with a tags array of strings. Tags must be lowercase, factual, singular nouns by default, one concept each, and use kebab-case when multiple words are needed. Avoid broad tags like note, information, interesting, idea, notes, or knowledge.";

interface OpenRouterChoice {
	finish_reason?: string;
	message?: {
		content?: string | Array<{ text?: string }>;
	};
}

interface OpenRouterResponse {
	choices?: OpenRouterChoice[];
	error?: {
		message?: string;
	};
}

export function normalizeTags(tags: string[]): string[] {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const tag of tags) {
		const value = tag
			.trim()
			.toLowerCase()
			.replace(/^#/, "")
			.replace(/['"]/g, "")
			.replace(/[^a-z0-9]+/g, "-")
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

	const response = await requestUrl({
		body: JSON.stringify({
			max_completion_tokens: maxCompletionTokens,
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
			response_format: { type: "json_object" },
		}),
		contentType: "application/json",
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
		method: "POST",
		url: "https://openrouter.ai/api/v1/chat/completions",
	});

	const data = response.json as OpenRouterResponse;
	if (data.error?.message) {
		throw new Error(data.error.message);
	}

	const choice = data.choices?.[0];
	if (choice?.finish_reason === "length") {
		throw new Error(
			`OpenRouter cut off the batch response at ${maxCompletionTokens} completion tokens. Lower the maximum batch token budget.`,
		);
	}

	const content = choice?.message?.content;
	const text = Array.isArray(content)
		? content.map((part) => part.text ?? "").join("")
		: content;

	if (!text) {
		throw new Error("OpenRouter returned no tags.");
	}

	let parsed: { results?: unknown };
	try {
		parsed = JSON.parse(text) as { results?: unknown };
	} catch {
		throw new Error(
			"OpenRouter returned incomplete JSON. Lower the maximum batch token budget.",
		);
	}
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
			!requestedIds.has(result.id) ||
			tagsById.has(result.id)
		) {
			throw new Error(
				`OpenRouter returned an invalid result at position ${index + 1}.`,
			);
		}

		tagsById.set(
			result.id,
			normalizeTags(
				result.tags.filter(
					(tag: unknown): tag is string => typeof tag === "string",
				),
			),
		);
	}

	if (tagsById.size !== requestedIds.size) {
		throw new Error("OpenRouter returned incomplete batch tags.");
	}

	return tagsById;
}
