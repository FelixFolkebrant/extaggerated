import type { BatchSyncStatus } from "../main";
import type { ChangedFileQueueItem, FreshnessStatus } from "../freshness";
import { ActiveNoteSummary } from "./ActiveNoteSummary";
import { ChangedFileQueue } from "./ChangedFileQueue";

interface ExtaggeratedViewProps {
	changedFiles: ChangedFileQueueItem[];
	freshnessStatus: FreshnessStatus;
	hasApiKey: boolean;
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

export function ExtaggeratedView({
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
}: ExtaggeratedViewProps) {
	return (
		<section className="xt-view flex h-full flex-col gap-4 overflow-hidden p-4 text-sm text-(--text-normal)">
			<header className="flex items-center justify-between border-b border-(--background-modifier-border) pb-3">
				<div className="min-w-0">
					<h1 className="truncate text-base font-semibold">Extaggerated</h1>
					<p className="text-xs text-(--text-muted)">XT</p>
				</div>
				<span
					className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${
						hasApiKey
							? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
							: "bg-amber-500/15 text-amber-700 dark:text-amber-300"
					}`}
				>
					{hasApiKey ? "Configured" : "No key"}
				</span>
			</header>

			<dl className="grid gap-3">
				<div className="grid gap-2">
					<dt className="text-xs uppercase text-(--text-muted)">Tagging</dt>
					<dd className="grid gap-2">
						<button
							className="rounded bg-(--interactive-accent) px-3 py-2 text-left text-sm font-medium text-(--text-on-accent) disabled:cursor-not-allowed disabled:opacity-50"
							disabled={!hasApiKey}
							onClick={onInitializeTagging}
							type="button"
						>
							Initialize tagging
						</button>
						{!hasApiKey ? (
							<p className="text-xs text-(--text-muted)">
								Add an OpenRouter API key in settings first.
							</p>
						) : null}
					</dd>
				</div>
				<ActiveNoteSummary freshnessStatus={freshnessStatus} />
				<div className="grid gap-1">
					<dt className="text-xs uppercase text-(--text-muted)">Provider</dt>
					<dd>OpenRouter</dd>
				</div>
				<div className="grid gap-1">
					<dt className="text-xs uppercase text-(--text-muted)">Model</dt>
					<dd className="truncate" title={model}>
						{model}
					</dd>
				</div>
			</dl>

			<ChangedFileQueue
				changedFiles={changedFiles}
				hasApiKey={hasApiKey}
				onRefreshQueue={onRefreshQueue}
				onSyncAll={onSyncAll}
				onSyncSelected={onSyncSelected}
				onToggleQueuedFile={onToggleQueuedFile}
				queueLoading={queueLoading}
				selectedPaths={selectedPaths}
				syncStatuses={syncStatuses}
			/>
		</section>
	);
}
