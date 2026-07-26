import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { importBundled } from "./bundle-test-module.mts";

declare global {
	var __batchCalls: number;
	var __confirmationCounts: number[];
	var __confirmationResult: boolean;
	var __notices: string[];
}

const result = await build({
	bundle: true,
	format: "cjs",
	jsx: "automatic",
	packages: "external",
	platform: "node",
	plugins: [
		{
			name: "freshness-stub",
			setup(build) {
				build.onResolve({ filter: /^\.\.\/freshness$/ }, () => ({
					namespace: "freshness-stub",
					path: "freshness",
				}));
				build.onLoad({ filter: /.*/, namespace: "freshness-stub" }, () => ({
					contents:
						'export const isTaggableFile = (file) => file.status === "stale" || file.status === "untagged";',
				}));
			},
		},
	],
	stdin: {
		contents: `
			import { createElement } from "react";
			import { renderToStaticMarkup } from "react-dom/server";
			import { ChangedFileQueue } from "./src/ui/ChangedFileQueue";
			import { ExtaggeratedView } from "./src/ui/ExtaggeratedView";

			const noop = () => {};
			const props = {
				changedFiles: [{
					fileName: "Unreadable",
					message: "Permission denied",
					path: "Notes/Unreadable.md",
					status: "unavailable",
				}],
				developerMode: false,
				hasApiKey: true,
				onOpenFailure: noop,
				onOpenFile: noop,
				onOpenNodeCreation: noop,
				onOpenSettings: noop,
				onRefreshQueue: noop,
				onSearchChange: noop,
				onSyncAll: noop,
				onSyncSelected: noop,
				onToggleQueuedFile: noop,
				onToggleSortDirection: noop,
				queueLoading: false,
				searchQuery: "",
				selectedPaths: ["Notes/Unreadable.md"],
				sortAscending: true,
				syncStatuses: {
					"Notes/Unreadable.md": {
						error: new Error("Old tag failure"),
						type: "failed",
					},
				},
				taggingPaths: ["Notes/Unreadable.md"],
			};

			export const queueHtml = renderToStaticMarkup(
				createElement(ChangedFileQueue, props),
			);
			export const viewHtml = renderToStaticMarkup(
				createElement(ExtaggeratedView, props),
			);
		`,
		loader: "ts",
		resolveDir: process.cwd(),
	},
	write: false,
});

const checkModule = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(
	createRequire(import.meta.url),
	checkModule,
	checkModule.exports,
);
const { queueHtml, viewHtml } = checkModule.exports as {
	queueHtml: string;
	viewHtml: string;
};

assert.match(
	queueHtml,
	/<button[^>]*title="Open Notes\/Unreadable.md"[^>]*>Unreadable<\/button>/,
);
assert.match(queueHtml, />Permission denied<\/span>/);
assert.match(
	queueHtml,
	/<input[^>]*aria-label="Cannot tag Notes\/Unreadable.md: Unavailable: Permission denied"[^>]*disabled=""/,
);
assert.doesNotMatch(
	queueHtml,
	/<input[^>]*aria-label="Cannot tag Notes\/Unreadable.md:[^"]*"[^>]*checked/,
);
assert.doesNotMatch(queueHtml, /Tagging \(/);
assert.match(queueHtml, /disabled=""[^>]*>Tag selected \(0\)<\/button>/);
assert.match(queueHtml, /disabled=""[^>]*>Tag all<\/button>/);
assert.match(viewHtml, /Unavailable: 1/);

const panelModule = await importBundled("src/ui/ExtaggeratedPanelView.ts", {
	"../freshness": `
		export const getChangedFileQueue = async () => [];
		export const getXtFailure = () => null;
		export const isTaggableFile = (file) =>
			file.status === "stale" || file.status === "untagged";
	`,
	"../nodeGeneration":
		"export async function generateNode() { throw new Error('not used'); }",
	"../noteSync": `
		export async function syncNoteTagBatch(_plugin, files, onComplete) {
			globalThis.__batchCalls += 1;
			for (const file of files) {
				onComplete({ file, result: { tagCount: 1 } });
			}
		}
	`,
	"./TagConfirmationModal": `
		export class TagConfirmationModal {
			constructor(_app, count) {
				globalThis.__confirmationCounts.push(count);
			}
			async openAndWait() {
				return globalThis.__confirmationResult;
			}
		}
	`,
	obsidian: `
		export class ItemView {
			constructor(leaf) {
				this.app = leaf.app;
				this.contentEl = {};
			}
		}
		export class Modal {}
		export class Notice {
			constructor(message) { globalThis.__notices.push(String(message)); }
		}
		export class Setting {}
	`,
});
const PanelView = panelModule.ExtaggeratedPanelView as new (
	leaf: unknown,
	plugin: unknown,
) => {
	changedFiles: unknown[];
	selectedPaths: Set<string>;
	viewState: () => { onSyncSelected: () => void };
};
const queuedFile = {
	basename: "Queued",
	extension: "md",
	path: "Notes/Queued.md",
};
const panel = new PanelView(
	{
		app: {
			metadataCache: { getFileCache: () => ({}) },
			vault: { getFileByPath: () => queuedFile },
		},
	},
	{
		app: {
			metadataCache: { getFileCache: () => ({}) },
			vault: { getFileByPath: () => queuedFile },
		},
		settings: {
			developerMode: false,
			openRouterApiKey: "secret",
		},
	},
);
panel.changedFiles = [
	{ fileName: "Queued", path: queuedFile.path, status: "stale" },
];
panel.selectedPaths = new Set([queuedFile.path]);
globalThis.__batchCalls = 0;
globalThis.__confirmationCounts = [];
globalThis.__confirmationResult = false;
globalThis.__notices = [];

panel.viewState().onSyncSelected();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(globalThis.__batchCalls, 0);
assert.deepEqual(globalThis.__confirmationCounts, [1]);

globalThis.__confirmationResult = true;
panel.viewState().onSyncSelected();
await new Promise((resolve) => setImmediate(resolve));
await new Promise((resolve) => setImmediate(resolve));
assert.equal(globalThis.__batchCalls, 1);
assert.deepEqual(globalThis.__confirmationCounts, [1, 1]);
