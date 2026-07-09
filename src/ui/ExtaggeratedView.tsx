import type { BatchSyncStatus } from "../main";
import type { ChangedFileQueueItem, FreshnessStatus } from "../freshness";

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
	const freshness = freshnessDisplay(freshnessStatus);
	const selected = new Set(selectedPaths);
	const syncableCount = changedFiles.filter(
		(file) => file.status !== "unavailable",
	).length;
	const selectedSyncableCount = changedFiles.filter(
		(file) => file.status !== "unavailable" && selected.has(file.path),
	).length;

	return (
		<section className="xt-view flex h-full flex-col gap-4 overflow-hidden p-4 text-sm text-(--text-normal)">
			<header className="flex items-center justify-between border-b border-[var(--background-modifier-border)] pb-3">
				<div className="min-w-0">
					<h1 className="truncate text-base font-semibold">Extaggerated</h1>
					<p className="text-xs text-[var(--text-muted)]">XT</p>
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
					<dt className="text-xs uppercase text-[var(--text-muted)]">
						Tagging
					</dt>
					<dd className="grid gap-2">
						<button
							className="rounded bg-[var(--interactive-accent)] px-3 py-2 text-left text-sm font-medium text-[var(--text-on-accent)] disabled:cursor-not-allowed disabled:opacity-50"
							disabled={!hasApiKey}
							onClick={onInitializeTagging}
							type="button"
						>
							Initialize tagging
						</button>
						{!hasApiKey ? (
							<p className="text-xs text-[var(--text-muted)]">
								Add an OpenRouter API key in settings first.
							</p>
						) : null}
					</dd>
				</div>
				<div className="grid gap-1">
					<dt className="text-xs uppercase text-[var(--text-muted)]">
						Active note
					</dt>
					<dd className="flex items-center justify-between gap-3">
						<span className="min-w-0 truncate" title={freshness.note}>
							{freshness.note}
						</span>
						<span
							className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${freshness.className}`}
							title={freshness.title}
						>
							{freshness.label}
						</span>
					</dd>
				</div>
				<div className="grid gap-1">
					<dt className="text-xs uppercase text-[var(--text-muted)]">
						Provider
					</dt>
					<dd>OpenRouter</dd>
				</div>
				<div className="grid gap-1">
					<dt className="text-xs uppercase text-[var(--text-muted)]">Model</dt>
					<dd className="truncate" title={model}>
						{model}
					</dd>
				</div>
			</dl>

			<section className="flex min-h-0 flex-1 flex-col gap-3 border-t border-[var(--background-modifier-border)] pt-3">
				<div className="flex items-center justify-between gap-2">
					<div className="min-w-0">
						<h2 className="truncate text-xs font-semibold uppercase text-[var(--text-muted)]">
							Changed files
						</h2>
						<p className="text-xs text-[var(--text-muted)]">
							{queueLoading
								? "Refreshing"
								: `${changedFiles.length} queued, ${selectedSyncableCount} selected`}
						</p>
					</div>
					<button
						className="shrink-0 rounded border border-[var(--background-modifier-border)] px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
						disabled={queueLoading}
						onClick={onRefreshQueue}
						type="button"
					>
						Refresh
					</button>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<button
						className="rounded bg-[var(--interactive-accent)] px-3 py-2 text-sm font-medium text-[var(--text-on-accent)] disabled:cursor-not-allowed disabled:opacity-50"
						disabled={!hasApiKey || queueLoading || selectedSyncableCount === 0}
						onClick={onSyncSelected}
						type="button"
					>
						Sync selected
					</button>
					<button
						className="rounded border border-[var(--background-modifier-border)] px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
						disabled={!hasApiKey || queueLoading || syncableCount === 0}
						onClick={onSyncAll}
						type="button"
					>
						Sync all
					</button>
				</div>

				<div className="min-h-0 overflow-auto">
					{changedFiles.length === 0 ? (
						<p className="text-xs text-[var(--text-muted)]">
							No changed markdown files.
						</p>
					) : (
						<ul className="grid gap-2">
							{changedFiles.map((file) => {
								const status = queueStatusDisplay(file);
								const syncStatus = syncStatuses[file.path];
								const syncDisplay = syncStatus
									? syncStatusDisplay(syncStatus)
									: null;
								const disabled = file.status === "unavailable";

								return (
									<li
										className="grid gap-1 border-b border-[var(--background-modifier-border)] pb-2 last:border-b-0"
										key={file.path}
									>
										<label className="flex min-w-0 items-start gap-2">
											<input
												checked={selected.has(file.path)}
												className="mt-1"
												disabled={disabled}
												onChange={() => {
													onToggleQueuedFile(file.path);
												}}
												type="checkbox"
											/>
											<span className="grid min-w-0 flex-1 gap-1">
												<span className="truncate" title={file.path}>
													{file.path}
												</span>
												<span className="flex flex-wrap items-center gap-2 text-xs">
													<span className={status.className}>
														{status.label}
													</span>
													{syncDisplay ? (
														<span
															className={syncDisplay.className}
															title={syncDisplay.title}
														>
															{syncDisplay.label}
														</span>
													) : null}
												</span>
											</span>
										</label>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			</section>
		</section>
	);
}

function freshnessDisplay(status: FreshnessStatus): {
	className: string;
	label: string;
	note: string;
	title: string;
} {
	switch (status.type) {
		case "fresh":
			return {
				className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
				label: "Fresh",
				note: status.fileName,
				title: "Tags match the current note body.",
			};
		case "stale":
			return {
				className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
				label: "Stale",
				note: status.fileName,
				title: "The note body changed after the last XT tag sync.",
			};
		case "untagged":
			return {
				className: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
				label: "Untagged",
				note: status.fileName,
				title: "No XT content hash is stored on this note.",
			};
		case "unavailable":
			return {
				className: "bg-red-500/15 text-red-700 dark:text-red-300",
				label: "Unavailable",
				note: status.fileName,
				title: status.message,
			};
		case "no-note":
			return {
				className:
					"bg-[var(--background-modifier-border)] text-[var(--text-muted)]",
				label: "No note",
				note: "No markdown note selected",
				title: "Open a markdown note to see XT freshness.",
			};
	}
}

function queueStatusDisplay(file: ChangedFileQueueItem): {
	className: string;
	label: string;
} {
	switch (file.status) {
		case "stale":
			return {
				className: "text-amber-700 dark:text-amber-300",
				label: "Stale",
			};
		case "untagged":
			return {
				className: "text-sky-700 dark:text-sky-300",
				label: "Untagged",
			};
		case "unavailable":
			return {
				className: "text-red-700 dark:text-red-300",
				label: file.message ? `Unavailable: ${file.message}` : "Unavailable",
			};
		case "fresh":
			return {
				className: "text-emerald-700 dark:text-emerald-300",
				label: "Fresh",
			};
	}
}

function syncStatusDisplay(status: BatchSyncStatus): {
	className: string;
	label: string;
	title: string;
} {
	switch (status.type) {
		case "syncing":
			return {
				className: "text-[var(--text-muted)]",
				label: "Syncing",
				title: "Sync in progress.",
			};
		case "synced":
			return {
				className: "text-emerald-700 dark:text-emerald-300",
				label: `Synced: ${status.message}`,
				title: status.message,
			};
		case "failed":
			return {
				className: "text-red-700 dark:text-red-300",
				label: `Failed: ${status.message}`,
				title: status.message,
			};
	}
}
