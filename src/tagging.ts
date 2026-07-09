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
