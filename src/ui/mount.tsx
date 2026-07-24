import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ChangedFileQueueItem } from "../freshness";
import type { BatchSyncStatus } from "./ChangedFileQueue";
import { ExtaggeratedView } from "./ExtaggeratedView";

export interface ExtaggeratedViewState {
	changedFiles: ChangedFileQueueItem[];
	hasApiKey: boolean;
	onRefreshQueue: () => void;
	onSearchChange: (query: string) => void;
	onSyncAll: () => void;
	onSyncSelected: () => void;
	onToggleQueuedFile: (path: string) => void;
	onToggleSortDirection: () => void;
	queueLoading: boolean;
	searchQuery: string;
	selectedPaths: string[];
	sortAscending: boolean;
	syncStatuses: Record<string, BatchSyncStatus>;
}

interface MountExtaggeratedViewOptions extends ExtaggeratedViewState {
	container: HTMLElement;
}

export function mountExtaggeratedView({
	container,
	...state
}: MountExtaggeratedViewOptions): Root {
	const root = createRoot(container);
	renderExtaggeratedView(root, state);
	return root;
}

export function renderExtaggeratedView(
	root: Root,
	state: ExtaggeratedViewState,
): void {
	root.render(
		<StrictMode>
			<ExtaggeratedView {...state} />
		</StrictMode>,
	);
}
