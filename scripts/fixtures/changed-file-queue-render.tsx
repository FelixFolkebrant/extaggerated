import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChangedFileQueue } from "../../src/ui/ChangedFileQueue";
import { ExtaggeratedView } from "../../src/ui/ExtaggeratedView";

const noop = () => {};
const props = {
	changedFiles: [
		{
			fileName: "Unreadable",
			message: "Permission denied",
			path: "Notes/Unreadable.md",
			status: "unavailable" as const,
		},
	],
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
			type: "failed" as const,
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
