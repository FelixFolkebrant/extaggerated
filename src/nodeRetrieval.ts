import type { MetadataCache, TFile, Vault } from "obsidian";

export function findNodeCandidates(
	vault: Pick<Vault, "getMarkdownFiles">,
	metadataCache: Pick<MetadataCache, "getFileCache">,
	retrievalTags: string[],
	nodesFolder: string,
): TFile[] {
	const tags = new Set(retrievalTags.map(normalizeTag).filter(Boolean));
	const folder = nodesFolder.trim().replace(/^\/+|\/+$/g, "");

	if (tags.size === 0) {
		return [];
	}

	return vault
		.getMarkdownFiles()
		.filter((file) => {
			if (folder.length > 0 && file.path.startsWith(`${folder}/`)) {
				return false;
			}

			const frontmatter = metadataCache.getFileCache(file)?.frontmatter;
			if (frontmatter?.xt_ignore === true) {
				return false;
			}

			return frontmatterTags(frontmatter?.tags).some((tag) => tags.has(tag));
		})
		.sort((a, b) => a.path.localeCompare(b.path));
}

function frontmatterTags(value: unknown): string[] {
	const values = Array.isArray(value)
		? value
		: typeof value === "string"
			? value.split(/[\s,]+/)
			: [];

	return values
		.filter((tag): tag is string => typeof tag === "string")
		.map(normalizeTag)
		.filter(Boolean);
}

function normalizeTag(tag: string): string {
	return tag.trim().replace(/^#/, "").toLowerCase();
}
