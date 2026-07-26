import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { resolve } from "node:path";
import { build } from "esbuild";

declare global {
	var __notices: string[];
	var __openRouterResponse: unknown;
}

async function loadModule(path: string): Promise<Record<string, unknown>> {
	const result = await build({
		bundle: true,
		entryPoints: [resolve(path)],
		format: "esm",
		platform: "node",
		plugins: [
			{
				name: "obsidian-stub",
				setup(build) {
					build.onResolve({ filter: /^obsidian$/ }, () => ({
						namespace: "stub",
						path: "obsidian",
					}));
					build.onResolve({ filter: /^\.\/openRouter$/ }, () => ({
						namespace: "stub",
						path: "openRouter",
					}));
					build.onLoad({ filter: /.*/, namespace: "stub" }, ({ path }) => ({
						contents:
							path === "obsidian"
								? `export class Notice {
										constructor(message) {
											globalThis.__notices.push(String(message));
										}
									}
									export class PluginSettingTab {}
									export class Setting {}`
								: `export async function requestOpenRouterJson() {
										return globalThis.__openRouterResponse;
									}`,
						loader: "js",
					}));
				},
			},
		],
		write: false,
	});
	const source = result.outputFiles[0].contents;
	return import(
		`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
	);
}

const { DEFAULT_SETTINGS, parseSettings } = (await loadModule(
	"src/settings.ts",
)) as {
	DEFAULT_SETTINGS: Record<string, unknown>;
	parseSettings: (value: unknown) => Record<string, unknown>;
};
const validSettings = {
	developerMode: true,
	maxBatchTokens: 1234,
	model: "provider/model",
	nodesFolder: "Nodes",
	openRouterApiKey: "secret",
};
const invalidSettings: Array<[keyof typeof validSettings, unknown]> = [
	["developerMode", "true"],
	["maxBatchTokens", 1.5],
	["model", false],
	["model", "   "],
	["nodesFolder", null],
	["nodesFolder", "   "],
	["openRouterApiKey", 123],
];
for (const [field, invalidValue] of invalidSettings) {
	assert.deepEqual(parseSettings({ ...validSettings, [field]: invalidValue }), {
		...validSettings,
		[field]: DEFAULT_SETTINGS[field],
	});
}
assert.deepEqual(
	parseSettings({
		...validSettings,
		model: "  provider/model ",
		nodesFolder: " Nodes  ",
		openRouterApiKey: " secret ",
	}),
	validSettings,
);
assert.deepEqual(parseSettings(null), DEFAULT_SETTINGS);

const { generateTagsForNotes } = (await loadModule("src/tagging.ts")) as {
	generateTagsForNotes: (request: {
		apiKey: string;
		model: string;
		notes: Array<{ id: string; noteText: string }>;
	}) => Promise<Map<string, string[]>>;
};
const taggingRequest = {
	apiKey: "secret",
	model: "provider/model",
	notes: [{ id: "0", noteText: "Body" }],
};
globalThis.__openRouterResponse = {
	results: [
		{
			id: "0",
			tags: ["#Säkerhet", "東京 2026", "crème brûlée", "säkerhet"],
		},
	],
};
assert.deepEqual((await generateTagsForNotes(taggingRequest)).get("0"), [
	"säkerhet",
	"東京-2026",
	"crème-brûlée",
]);
globalThis.__openRouterResponse = {
	results: [{ id: "0", tags: ["security", 42] }],
};
await assert.rejects(
	generateTagsForNotes(taggingRequest),
	/invalid result at position 1/,
);

const {
	clearXtStateFromActiveNote,
	clearXtStateFromVault,
	ignoreActiveNote,
	syncNoteTagBatch,
} = (await loadModule("src/noteSync.ts")) as {
	clearXtStateFromActiveNote: (plugin: unknown) => Promise<boolean>;
	clearXtStateFromVault: (plugin: unknown) => Promise<void>;
	ignoreActiveNote: (plugin: unknown) => Promise<boolean>;
	syncNoteTagBatch: (
		plugin: unknown,
		files: unknown[],
		onComplete: (outcome: {
			error?: Error;
			result?: { tagCount: number };
		}) => void,
	) => Promise<void>;
};
const file = {
	basename: "Example",
	extension: "md",
	path: "notes/Example.md",
};

async function syncWithReads(reads: string[]) {
	let readIndex = 0;
	const frontmatter: Record<string, unknown> = {};
	let outcome: { error?: Error; result?: { tagCount: number } } | undefined;
	const plugin = {
		app: {
			fileManager: {
				processFrontMatter: async (
					_file: unknown,
					mutate: (value: Record<string, unknown>) => void,
				) => mutate(frontmatter),
			},
			metadataCache: { getFileCache: () => ({ frontmatter }) },
			vault: {
				read: async () => reads[Math.min(readIndex++, reads.length - 1)],
			},
		},
		settings: {
			maxBatchTokens: 4000,
			model: "provider/model",
			openRouterApiKey: "secret",
		},
	};

	globalThis.__openRouterResponse = {
		results: [{ id: "0", tags: ["security"] }],
	};
	await syncNoteTagBatch(plugin, [file], (value) => {
		outcome = value;
	});
	return { frontmatter, outcome, readCount: readIndex };
}

const changed = await syncWithReads(["Original body", "Edited body"]);
assert.equal(changed.readCount, 2);
assert.equal(changed.frontmatter.tags, undefined);
assert.match(changed.outcome?.error?.message ?? "", /changed while XT/);
assert.match(
	(changed.frontmatter.xt_failure as { message: string }).message,
	/changed while XT/,
);

const frontmatterOnly = await syncWithReads([
	"---\ntitle: Before\n---\nSame body",
	"---\ntitle: After\n---\nSame body",
]);
assert.deepEqual(frontmatterOnly.frontmatter.tags, ["security"]);
assert.deepEqual(frontmatterOnly.outcome?.result, { tagCount: 1 });

Object.assign(globalThis, { window: { confirm: () => true } });
globalThis.__notices = [];
const failingActivePlugin = {
	app: {
		fileManager: {
			processFrontMatter: async () => {
				throw new Error("vault is read-only");
			},
		},
		metadataCache: { getFileCache: () => ({ frontmatter: {} }) },
		workspace: { getActiveFile: () => file },
	},
};
assert.equal(await ignoreActiveNote(failingActivePlugin), false);
assert.match(
	globalThis.__notices.at(-1) ?? "",
	/notes\/Example\.md: vault is read-only/,
);

globalThis.__notices = [];
failingActivePlugin.app.metadataCache.getFileCache = () => ({
	frontmatter: { xt_ignore: true },
});
assert.equal(await clearXtStateFromActiveNote(failingActivePlugin), false);
assert.match(
	globalThis.__notices.at(-1) ?? "",
	/notes\/Example\.md: vault is read-only/,
);

globalThis.__notices = [];
const cleanupFiles = ["a.md", "b.md", "c.md"].map((path) => ({
	basename: path.slice(0, -3),
	extension: "md",
	path,
}));
const attempted: string[] = [];
await clearXtStateFromVault({
	app: {
		fileManager: {
			processFrontMatter: async (
				cleanupFile: { path: string },
				mutate: (value: Record<string, unknown>) => void,
			) => {
				attempted.push(cleanupFile.path);
				if (cleanupFile.path === "b.md") {
					throw new Error("locked");
				}
				mutate({ xt_ignore: true });
			},
		},
		metadataCache: {
			getFileCache: () => ({ frontmatter: { xt_ignore: true } }),
		},
		vault: { getMarkdownFiles: () => cleanupFiles },
	},
});
assert.deepEqual(attempted, ["a.md", "b.md", "c.md"]);
assert.equal(
	globalThis.__notices.at(-1),
	"Cleared XT metadata from 2 of 3 notes. Failed: b.md: locked",
);
