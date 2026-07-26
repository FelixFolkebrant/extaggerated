import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";

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
