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
		containsModelLink(value.overview) ||
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
			containsModelLink(source.context) ||
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

function containsModelLink(value: string): boolean {
	return /\[\[|\]\(/.test(value);
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
