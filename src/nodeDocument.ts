export interface NodeDocument {
	overview: string;
	sources: NodeDocumentSource[];
}

export interface NodeDocumentSource {
	context: string;
	id: string;
}

export interface RenderedNodeDocumentSource {
	context: string;
	link: string;
}

export function parseNodeDocument(
	value: unknown,
	candidateIds: ReadonlySet<string>,
): NodeDocument {
	if (
		typeof value !== "object" ||
		value === null ||
		!("overview" in value) ||
		!("sources" in value) ||
		typeof value.overview !== "string" ||
		value.overview.trim().length === 0 ||
		containsModelStructure(value.overview) ||
		!Array.isArray(value.sources)
	) {
		throw new Error("OpenRouter returned an invalid node document.");
	}

	if (value.sources.length === 0) {
		throw new Error("OpenRouter selected no source notes for this node.");
	}

	const usedIds = new Set<string>();
	const sources = value.sources.map((source, index) => {
		if (
			typeof source !== "object" ||
			source === null ||
			!("id" in source) ||
			!("context" in source) ||
			typeof source.id !== "string" ||
			typeof source.context !== "string" ||
			source.context.trim().length === 0 ||
			containsModelStructure(source.context) ||
			!candidateIds.has(source.id) ||
			usedIds.has(source.id)
		) {
			throw new Error(
				`OpenRouter returned an invalid source at position ${index + 1}.`,
			);
		}

		usedIds.add(source.id);
		return { context: source.context.trim(), id: source.id };
	});

	return { overview: value.overview.trim(), sources };
}

function containsModelStructure(value: string): boolean {
	return (
		/\b[a-z][a-z\d+.-]*:\/\/|\bmailto:|\bwww\./iu.test(value) ||
		/!?\[[^\]\n]*\]\([^)\n]*\)|!?\[[^\]\n]+\]\s*\[[^\]\n]*\]|!?\[\[[^\]\n]+\]\]/u.test(
			value,
		) ||
		/(?:^|\n)(?: {4}|\t)|(?:^|\n) {0,3}(?:#{1,6}(?:\s|$)|>|(?:[-+*]|\d+[.)])\s|(?:\*{3,}|_{3,})\s*(?:\n|$)|`{3}|~{3}|\[[^\]\n]+\]:\s*\S|\[\^[^\]\n]+\]:)/u.test(
			value,
		) ||
		/(?:^|\n) {0,3}(?:=+|-+)\s*(?:\n|$)/u.test(value) ||
		/(?:^|\n)\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}/u.test(value) ||
		/<(?:!--|\/?[a-z][a-z\d-]*(?:\s[^<>]*)?\/?|[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>/iu.test(
			value,
		) ||
		/(?:^|[^\p{L}\p{N}])#[\p{L}\p{N}_-]+/u.test(value) ||
		/\[\^[^\]\n]+\]|`|(?<![\p{L}\p{N}])(\*{1,3}|_{1,3})(?=\S)[^\n]*?\S\1(?![\p{L}\p{N}])|~~(?=\S)[^\n]*?\S~~/u.test(
			value,
		)
	);
}

export function renderNodeDocument(
	name: string,
	document: Pick<NodeDocument, "overview"> & {
		sources: RenderedNodeDocumentSource[];
	},
): string {
	const lines = [`# ${name}`, "", document.overview, "", "## Sources", ""];

	for (const source of document.sources) {
		lines.push(`### ${source.link}`, "", source.context, "");
	}

	return `${lines.join("\n").trimEnd()}\n`;
}
