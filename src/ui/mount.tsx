import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ExtaggeratedView } from "./ExtaggeratedView";
import type { ChangedFileQueueItem, FreshnessStatus } from "../freshness";
import type { BatchSyncStatus } from "./ChangedFileQueue";

export interface ExtaggeratedViewState {
	changedFiles: ChangedFileQueueItem[];
	hasApiKey: boolean;
	freshnessStatus: FreshnessStatus;
	model: string;
	onInitializeTagging: () => void;
	onRefreshQueue: () => void;
	onSyncAll: () => void;
	onSyncSelected: () => void;
	onToggleQueuedFile: (path: string) => void;
	queueLoading: boolean;
	selectedPaths: string[];
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
	{
		changedFiles,
		freshnessStatus,
		hasApiKey,
		model,
		onInitializeTagging,
		onRefreshQueue,
		onSyncAll,
		onSyncSelected,
		onToggleQueuedFile,
		queueLoading,
		selectedPaths,
		syncStatuses,
	}: ExtaggeratedViewState,
): void {
	root.render(
		<StrictMode>
			<ExtaggeratedView
				changedFiles={changedFiles}
				freshnessStatus={freshnessStatus}
				hasApiKey={hasApiKey}
				model={model}
				onInitializeTagging={onInitializeTagging}
				onRefreshQueue={onRefreshQueue}
				onSyncAll={onSyncAll}
				onSyncSelected={onSyncSelected}
				onToggleQueuedFile={onToggleQueuedFile}
				queueLoading={queueLoading}
				selectedPaths={selectedPaths}
				syncStatuses={syncStatuses}
			/>
		</StrictMode>,
	);
}
