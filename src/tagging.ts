import { requestUrl } from "obsidian";

export interface TaggingRequest {
	apiKey: string;
	model: string;
	noteText: string;
}

interface OpenRouterChoice {
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

export async function generateTags({
	apiKey,
	model,
	noteText,
}: TaggingRequest): Promise<string[]> {
	const response = await requestUrl({
		body: JSON.stringify({
			messages: [
				{
					content:
						"You generate Obsidian tags. Return only JSON with a tags array of strings. Tags must be lowercase, factual, singular nouns by default, one concept each, and use kebab-case when multiple words are needed. Avoid broad tags like note, information, interesting, idea, notes, or knowledge.",
					role: "system",
				},
				{
					content: noteText,
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

	const content = data.choices?.[0]?.message?.content;
	const text = Array.isArray(content)
		? content.map((part) => part.text ?? "").join("")
		: content;

	if (!text) {
		throw new Error("OpenRouter returned no tags.");
	}

	const parsed = JSON.parse(text) as { tags?: unknown };
	if (!Array.isArray(parsed.tags)) {
		throw new Error("OpenRouter returned tags in an unexpected format.");
	}

	return normalizeTags(
		parsed.tags.filter((tag): tag is string => typeof tag === "string"),
	);
}
