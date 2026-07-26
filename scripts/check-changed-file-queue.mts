import assert from "node:assert/strict";
import { importBundled } from "./bundle-test-module.mts";

declare global {
	var __batchCalls: number;
	var __confirmationCounts: number[];
	var __confirmationResolvers: Array<(confirmed: boolean) => void>;
	var __confirmationResult: boolean;
	var __deferConfirmation: boolean;
	var __notices: string[];
}

const { queueHtml, viewHtml } = (await importBundled(
	"scripts/fixtures/changed-file-queue-render.tsx",
	{
		"../freshness":
			'export const isTaggableFile = (file) => file.status === "stale" || file.status === "untagged";',
	},
	true,
)) as {
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
				if (globalThis.__deferConfirmation) {
					return new Promise((resolve) => {
						globalThis.__confirmationResolvers.push(resolve);
					});
				}
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
const app = {
	metadataCache: { getFileCache: () => ({}) },
	vault: { getFileByPath: () => queuedFile },
};
const panel = new PanelView(
	{ app },
	{
		app,
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
globalThis.__confirmationResolvers = [];
globalThis.__confirmationResult = false;
globalThis.__deferConfirmation = false;
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

panel.changedFiles = [
	{ fileName: "Queued", path: queuedFile.path, status: "stale" },
];
panel.selectedPaths = new Set([queuedFile.path]);
globalThis.__deferConfirmation = true;
panel.viewState().onSyncSelected();
panel.viewState().onSyncSelected();
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(globalThis.__confirmationCounts, [1, 1, 1]);
assert.equal(globalThis.__confirmationResolvers.length, 1);
assert.equal(globalThis.__batchCalls, 1);

globalThis.__confirmationResolvers[0](true);
await new Promise((resolve) => setImmediate(resolve));
await new Promise((resolve) => setImmediate(resolve));
assert.equal(globalThis.__batchCalls, 2);
