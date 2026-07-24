import type { ChangedFileQueueItem } from "../freshness";
import { type BatchSyncStatus, ChangedFileQueue } from "./ChangedFileQueue";

interface ExtaggeratedViewProps {
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

export function ExtaggeratedView(props: ExtaggeratedViewProps) {
	return (
		<section className="flex h-full flex-col overflow-hidden py-3 font-(family-name:--font-interface) text-sm text-(--text-normal)">
			<ChangedFileQueue {...props} />
		</section>
	);
}
