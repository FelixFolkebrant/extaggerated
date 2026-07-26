import assert from "node:assert/strict";
import { importBundled } from "./bundle-test-module.mts";

declare global {
	var __notices: string[];
	var __openRouterResponse: unknown;
	var __pluginApp: unknown;
	var __savedSettings: unknown;
}

const OBSIDIAN_STUB = `
	export class Notice {
		constructor(message) {
			globalThis.__notices.push(String(message));
		}
	}
	export class Plugin {
		constructor() {
			this.app = globalThis.__pluginApp;
			this.manifest = { id: "extaggerated" };
			this.commands = [];
		}
		addCommand(command) { this.commands.push(command); }
		addRibbonIcon(_icon, _name, callback) { this.ribbonCallback = callback; }
		addSettingTab() {}
		register() {}
		registerEvent() {}
		registerView() {}
		loadData() { return Promise.resolve(globalThis.__savedSettings); }
	}
	export class PluginSettingTab {}
	export class Setting {}
	export class ItemView {}
	export class Modal {}
	export class Menu {}
	export class TFolder {}
	export function requestUrl() { throw new Error("provider called"); }
	export function getFrontMatterInfo(content) {
		const match = /^---\\r?\\n([\\s\\S]*?)\\r?\\n---\\r?\\n?/.exec(content);
		if (!match) {
			return { contentStart: 0, exists: false, from: 0, frontmatter: "", to: 0 };
		}
		const from = content.indexOf("\\n") + 1;
		return {
			contentStart: match[0].length,
			exists: true,
			from,
			frontmatter: match[1],
			to: from + match[1].length,
		};
	}
	export const parseYaml = JSON.parse;
	export const stringifyYaml = JSON.stringify;
`;

async function loadModule(path: string): Promise<Record<string, unknown>> {
	return importBundled(path, {
		"./openRouter": `export async function requestOpenRouterJson() {
			return globalThis.__openRouterResponse;
		}`,
		obsidian: OBSIDIAN_STUB,
	});
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

globalThis.__notices = [];
globalThis.__savedSettings = { ...validSettings, maxBatchTokens: "many" };
const PluginClass = (await loadModule("src/main.ts")).default as new () => {
	commands: Array<{ id: string; callback: () => void }>;
	loadSettings: () => Promise<void>;
	onload: () => Promise<void>;
	settings: Record<string, unknown>;
};
const settingsPlugin = new PluginClass();
await settingsPlugin.loadSettings();
assert.deepEqual(settingsPlugin.settings, {
	...validSettings,
	maxBatchTokens: DEFAULT_SETTINGS.maxBatchTokens,
});

const { generateTagsForNotes, hashNoteBody } = (await loadModule(
	"src/tagging.ts",
)) as {
	generateTagsForNotes: (request: {
		apiKey: string;
		model: string;
		notes: Array<{ id: string; noteText: string }>;
	}) => Promise<Map<string, string[]>>;
	hashNoteBody: (markdown: string) => Promise<string>;
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
			tags: [
				"#Säkerhet",
				"東京 ２０２６",
				"Cafe\u0301",
				"café",
				"हिन्दी",
				"säkerhet",
			],
		},
	],
};
assert.deepEqual((await generateTagsForNotes(taggingRequest)).get("0"), [
	"säkerhet",
	"東京-２０２６",
	"café",
	"हिन्दी",
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
	let writtenMarkdown: string | undefined;
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
				process: async (
					_file: unknown,
					mutate: (markdown: string) => string,
				) => {
					const current = reads[Math.min(readIndex++, reads.length - 1)];
					writtenMarkdown = mutate(current);
					const info = /^---\n([\s\S]*?)\n---\n?/.exec(writtenMarkdown);
					if (info) {
						Object.assign(frontmatter, JSON.parse(info[1]));
					}
					return writtenMarkdown;
				},
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
	return { frontmatter, outcome, readCount: readIndex, writtenMarkdown };
}

const changed = await syncWithReads(["Original body", "Edited body"]);
assert.equal(changed.readCount, 2);
assert.equal(changed.frontmatter.tags, undefined);
assert.match(changed.outcome?.error?.message ?? "", /changed while XT/);
assert.match(
	(changed.frontmatter.xt_failure as { message: string }).message,
	/changed while XT/,
);

const withoutFrontmatter = await syncWithReads(["Same body", "Same body"]);
assert.deepEqual(withoutFrontmatter.frontmatter.tags, ["security"]);
assert.equal(
	withoutFrontmatter.frontmatter.xt_content_hash,
	await hashNoteBody("Same body"),
);
assert.match(
	withoutFrontmatter.writtenMarkdown ?? "",
	/^---\n\{"tags":\["security"\],"xt_content_hash":"[a-f\d]{64}"\}\n---\nSame body$/,
);

const frontmatterOnly = await syncWithReads([
	'---\n{"title":"Before","xt_failure":{"message":"old"}}\n---\nSame body',
	'---\n{"title":"After","xt_failure":{"message":"old"}}\n---\nSame body',
]);
assert.deepEqual(frontmatterOnly.frontmatter.tags, ["security"]);
assert.deepEqual(frontmatterOnly.outcome?.result, { tagCount: 1 });
assert.equal(
	frontmatterOnly.frontmatter.xt_content_hash,
	await hashNoteBody("Same body"),
);
assert.equal(frontmatterOnly.frontmatter.xt_failure, undefined);
assert.match(frontmatterOnly.writtenMarkdown ?? "", /"title":"After"/);

Object.assign(globalThis, { window: { confirm: () => true } });
globalThis.__notices = [];
function activePlugin(frontmatter: Record<string, unknown>) {
	return {
		app: {
			fileManager: {
				processFrontMatter: async (
					_file: unknown,
					mutate: (value: Record<string, unknown>) => void,
				) => mutate(frontmatter),
			},
			metadataCache: { getFileCache: () => ({ frontmatter }) },
			workspace: { getActiveFile: () => file },
		},
	};
}

const ownedTags = {
	tags: ["xt-tag"],
	title: "Keep me",
	xt_content_hash: "owned",
	xt_failure: { message: "old" },
};
assert.equal(await ignoreActiveNote(activePlugin(ownedTags)), true);
assert.deepEqual(ownedTags, { title: "Keep me", xt_ignore: true });

const userTags = {
	tags: ["user-tag"],
	title: "Keep me",
	xt_failure: { message: "old" },
};
assert.equal(await ignoreActiveNote(activePlugin(userTags)), true);
assert.deepEqual(userTags, {
	tags: ["user-tag"],
	title: "Keep me",
	xt_ignore: true,
});

const activeCleanup = {
	tags: ["xt-tag"],
	title: "Keep me",
	xt_content_hash: "owned",
	xt_failure: { message: "old" },
	xt_ignore: true,
};
assert.equal(
	await clearXtStateFromActiveNote(activePlugin(activeCleanup)),
	true,
);
assert.deepEqual(activeCleanup, { title: "Keep me" });

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
const cleanupFrontmatter = new Map<string, Record<string, unknown>>([
	[
		"a.md",
		{
			tags: ["xt-tag"],
			title: "A",
			xt_content_hash: "owned",
			xt_failure: { message: "old" },
		},
	],
	["b.md", { title: "B", xt_ignore: true }],
	["c.md", { tags: ["user-tag"], title: "C", xt_failure: { message: "old" } }],
]);
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
				mutate(cleanupFrontmatter.get(cleanupFile.path) ?? {});
			},
		},
		metadataCache: {
			getFileCache: (cleanupFile: { path: string }) => ({
				frontmatter: cleanupFrontmatter.get(cleanupFile.path),
			}),
		},
		vault: { getMarkdownFiles: () => cleanupFiles },
	},
});
assert.deepEqual(attempted, ["a.md", "b.md", "c.md"]);
assert.equal(
	globalThis.__notices.at(-1),
	"Cleared XT metadata from 2 of 3 notes. Failed: b.md: locked",
);
assert.deepEqual(cleanupFrontmatter.get("a.md"), { title: "A" });
assert.deepEqual(cleanupFrontmatter.get("b.md"), {
	title: "B",
	xt_ignore: true,
});
assert.deepEqual(cleanupFrontmatter.get("c.md"), {
	tags: ["user-tag"],
	title: "C",
});

globalThis.__notices = [];
globalThis.__savedSettings = validSettings;
globalThis.__pluginApp = {
	metadataCache: { on: () => ({}) },
	vault: { on: () => ({}) },
	workspace: {
		getActiveFile: () => null,
		getLeavesOfType: () => {
			throw new Error("workspace unavailable");
		},
		on: () => ({}),
		onLayoutReady: () => {},
	},
};
const commandPlugin = new PluginClass();
await commandPlugin.onload();
const openCommand = commandPlugin.commands.find(
	(command) => command.id === "open-extaggerated",
);
assert.ok(openCommand);
const unhandled: unknown[] = [];
const captureUnhandled = (reason: unknown) => {
	unhandled.push(reason);
};
process.on("unhandledRejection", captureUnhandled);
openCommand.callback();
await new Promise((resolve) => setImmediate(resolve));
process.off("unhandledRejection", captureUnhandled);
assert.deepEqual(unhandled, []);
assert.equal(
	globalThis.__notices.at(-1),
	"Opening Extaggerated failed: workspace unavailable",
);
