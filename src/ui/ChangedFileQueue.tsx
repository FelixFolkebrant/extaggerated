import { isTaggableFile, type ChangedFileQueueItem } from "../freshness";
import { XtMark } from "./XtMark";

export type BatchSyncStatus =
	| { type: "syncing" }
	| { type: "synced"; message: string }
	| { type: "failed"; message: string };

interface ChangedFileQueueProps {
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

export function ChangedFileQueue({
	changedFiles,
	hasApiKey,
	onRefreshQueue,
	onSearchChange,
	onSyncAll,
	onSyncSelected,
	onToggleQueuedFile,
	onToggleSortDirection,
	queueLoading,
	searchQuery,
	selectedPaths,
	sortAscending,
	syncStatuses,
}: ChangedFileQueueProps) {
	const selected = new Set(selectedPaths);
	const syncableCount = changedFiles.filter(isTaggableFile).length;
	const selectedSyncableCount = changedFiles.filter(
		(file) => isTaggableFile(file) && selected.has(file.path),
	).length;
	const visibleFiles = changedFiles
		.filter((file) =>
			file.path.toLowerCase().includes(searchQuery.toLowerCase()),
		)
		.sort((a, b) => {
			const order = a.path.localeCompare(b.path);
			return sortAscending ? order : -order;
		});

	return (
		<section className="flex min-h-0 flex-1 flex-col gap-4">
			<header className="grid gap-3">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2 text-(--text-normal)">
						<XtMark className="h-auto w-12" />
						<span className="sr-only">Extaggerated</span>
					</div>
					<button
						aria-label="Refresh file status"
						className="rounded p-1 text-lg text-(--text-muted) hover:text-(--text-normal) disabled:cursor-not-allowed disabled:opacity-50"
						disabled={queueLoading}
						onClick={onRefreshQueue}
						title="Refresh file status"
						type="button"
					>
						↻
					</button>
				</div>
				<FileStatusBar changedFiles={changedFiles} />
			</header>

			<input
				aria-label="Search files"
				className="w-full rounded bg-(--background-primary-alt) px-3 py-2 text-sm outline-none placeholder:text-(--text-muted) focus:ring-1 focus:ring-(--interactive-accent)"
				onChange={(event) => {
					onSearchChange(event.target.value);
				}}
				placeholder="Search"
				spellCheck={false}
				type="search"
				value={searchQuery}
			/>

			<div className="grid grid-cols-2 gap-3">
				<button
					className="rounded bg-(--interactive-accent) px-3 py-2 text-sm font-medium text-(--text-on-accent) disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!hasApiKey || queueLoading || selectedSyncableCount === 0}
					onClick={onSyncSelected}
					type="button"
				>
					Tag selected ({selectedSyncableCount})
				</button>
				<button
					className="rounded bg-(--background-primary-alt) px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!hasApiKey || queueLoading || syncableCount === 0}
					onClick={onSyncAll}
					type="button"
				>
					Tag all
				</button>
			</div>

			<div className="flex items-center justify-between">
				<button
					aria-label={`Sort alphabetically ${sortAscending ? "descending" : "ascending"}`}
					className="flex items-center gap-2 rounded px-2 py-1 text-sm text-(--text-muted) hover:bg-(--background-primary-alt) hover:text-(--text-normal)"
					onClick={onToggleSortDirection}
					type="button"
				>
					Name {sortAscending ? "↑" : "↓"}
				</button>
				<span className="text-xs text-(--text-muted)">
					{queueLoading ? "Refreshing" : `${visibleFiles.length} files`}
				</span>
			</div>

			<div className="min-h-0 overflow-auto">
				{visibleFiles.length === 0 ? (
					<p className="text-xs text-(--text-muted)">No matching files.</p>
				) : (
					<ul>
						{visibleFiles.map((file) => (
							<ChangedFileQueueRow
								file={file}
								key={file.path}
								onToggleQueuedFile={onToggleQueuedFile}
								selected={selected.has(file.path)}
								syncStatus={syncStatuses[file.path]}
							/>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}

function FileStatusBar({
	changedFiles,
}: {
	changedFiles: ChangedFileQueueItem[];
}) {
	const statuses = [
		{ className: "bg-(--interactive-accent)", label: "Tagged", type: "fresh" },
		{
			className: "bg-(--interactive-accent) opacity-40",
			label: "Edited since tagging",
			type: "stale",
		},
		{
			className: "bg-(--text-muted) opacity-70",
			label: "Never tagged",
			type: "untagged",
		},
		{
			className: "bg-(--background-modifier-border)",
			label: "XT ignored",
			type: "ignored",
		},
	] as const;

	return (
		<div
			aria-label="File status distribution"
			className="flex h-2 overflow-hidden rounded-full bg-(--background-primary-alt)"
		>
			{statuses.map((status) => {
				const count = changedFiles.filter(
					(file) => file.status === status.type,
				).length;

				return count > 0 ? (
					<span
						className={status.className}
						key={status.type}
						style={{ flexGrow: count }}
						title={`${status.label}: ${count}`}
					/>
				) : null;
			})}
		</div>
	);
}

interface ChangedFileQueueRowProps {
	file: ChangedFileQueueItem;
	onToggleQueuedFile: (path: string) => void;
	selected: boolean;
	syncStatus?: BatchSyncStatus;
}

function ChangedFileQueueRow({
	file,
	onToggleQueuedFile,
	selected,
	syncStatus,
}: ChangedFileQueueRowProps) {
	const status = queueStatusDisplay(file);
	const taggable = isTaggableFile(file);

	return (
		<li
			className="flex min-w-0 items-center gap-3 py-1.5"
			title={`${file.path} — ${status.label}`}
		>
			<input
				aria-label={`Tag ${file.path}`}
				checked={selected}
				className="h-4 w-4 shrink-0 accent-(--interactive-accent) disabled:cursor-default"
				disabled={!taggable}
				onChange={() => {
					onToggleQueuedFile(file.path);
				}}
				type="checkbox"
			/>
			<span className={`min-w-0 flex-1 truncate ${status.className}`}>
				{file.path}
			</span>
			<RowEnd file={file} syncStatus={syncStatus} />
		</li>
	);
}

function RowEnd({
	file,
	syncStatus,
}: {
	file: ChangedFileQueueItem;
	syncStatus?: BatchSyncStatus;
}) {
	if (syncStatus?.type === "syncing") {
		return <span className="text-(--text-muted)">…</span>;
	}

	if (syncStatus?.type === "failed") {
		return <span className="text-(--color-red)">!</span>;
	}

	return file.status === "untagged" ? (
		<span aria-label="Never tagged" className="text-lg text-(--text-muted)">
			+
		</span>
	) : null;
}

function queueStatusDisplay(file: ChangedFileQueueItem): {
	className: string;
	label: string;
} {
	switch (file.status) {
		case "fresh":
			return { className: "text-(--text-normal)", label: "Tagged" };
		case "stale":
			return {
				className: "text-(--interactive-accent) opacity-60",
				label: "Edited since tagging",
			};
		case "untagged":
			return { className: "text-(--text-muted)", label: "Never tagged" };
		case "ignored":
			return { className: "text-(--text-faint)", label: "XT ignored" };
		case "unavailable":
			return {
				className: "text-(--color-red)",
				label: file.message ? `Unavailable: ${file.message}` : "Unavailable",
			};
	}
}
