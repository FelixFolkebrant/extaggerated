import { type ChangedFileQueueItem, isTaggableFile } from "../freshness";

export type BatchSyncStatus =
	| { type: "syncing" }
	| { type: "synced"; message: string }
	| { type: "failed"; error: Error };

interface ChangedFileQueueProps {
	changedFiles: ChangedFileQueueItem[];
	developerMode: boolean;
	hasApiKey: boolean;
	onOpenFailure: (file: ChangedFileQueueItem, error: Error) => void;
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
	taggingPaths: string[];
}

export function ChangedFileQueue({
	changedFiles,
	developerMode,
	hasApiKey,
	onOpenFailure,
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
	taggingPaths,
}: ChangedFileQueueProps) {
	const selected = new Set(selectedPaths);
	const tagging = new Set(taggingPaths);
	const isTagging = tagging.size > 0;
	const syncableCount = changedFiles.filter(isTaggableFile).length;
	const selectedSyncableCount = changedFiles.filter(
		(file) => isTaggableFile(file) && selected.has(file.path),
	).length;
	const queueFiles = changedFiles.filter(isTaggableFile).sort((a, b) => {
		const order = a.path.localeCompare(b.path);
		return sortAscending ? order : -order;
	});
	const taggingFiles = queueFiles.filter((file) => tagging.has(file.path));
	const matchesSearch = (file: ChangedFileQueueItem) =>
		file.path.toLowerCase().includes(searchQuery.toLowerCase());
	const failedFiles = queueFiles.filter(
		(file) =>
			!tagging.has(file.path) &&
			syncStatuses[file.path]?.type === "failed" &&
			matchesSearch(file),
	);
	const visibleFiles = queueFiles.filter(
		(file) =>
			!tagging.has(file.path) &&
			syncStatuses[file.path]?.type !== "failed" &&
			matchesSearch(file),
	);

	return (
		<section className="flex min-h-0 flex-1 flex-col gap-3">
			<input
				aria-label="Search files"
				className="mx-3 w-auto rounded bg-(--background-primary-alt) my-4 px-4 py-3 text-sm outline-none placeholder:text-(--text-muted) focus:ring-1 focus:ring-(--interactive-accent)"
				onChange={(event) => {
					onSearchChange(event.target.value);
				}}
				placeholder="Search"
				spellCheck={false}
				type="search"
				value={searchQuery}
			/>

			<div className="mx-3 grid grid-cols-2 gap-3">
				<button
					className="rounded bg-(--interactive-accent) px-3 py-2 text-sm font-medium text-(--text-on-accent) disabled:cursor-not-allowed disabled:opacity-60"
					disabled={
						!hasApiKey ||
						queueLoading ||
						isTagging ||
						selectedSyncableCount === 0
					}
					onClick={onSyncSelected}
					type="button"
				>
					Tag selected ({selectedSyncableCount})
				</button>
				<button
					className="rounded bg-(--background-primary-alt) px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
					disabled={
						!hasApiKey || queueLoading || isTagging || syncableCount === 0
					}
					onClick={onSyncAll}
					type="button"
				>
					Tag all
				</button>
			</div>

			<div className="flex items-center justify-between px-3">
				<button
					aria-label={`Sort alphabetically ${sortAscending ? "descending" : "ascending"}`}
					className="flex items-center gap-2 rounded px-2 py-1 text-sm text-(--text-muted) hover:bg-(--background-primary-alt) hover:text-(--text-normal)"
					onClick={onToggleSortDirection}
					type="button"
				>
					Name {sortAscending ? "↑" : "↓"}
				</button>
				<span className="text-xs text-(--text-muted)">
					{queueLoading
						? "Refreshing"
						: `${visibleFiles.length + failedFiles.length} files`}
				</span>
			</div>

			<div className="min-h-0 overflow-auto">
				{taggingFiles.length > 0 ? (
					<details
						className="mb-2 rounded bg-(--background-primary-alt) py-1"
						open
					>
						<summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-(--text-muted)">
							Tagging ({taggingFiles.length})
						</summary>
						<ul className="m-0 list-none p-0">
							{taggingFiles.map((file) => (
								<ChangedFileQueueRow
									developerMode={developerMode}
									file={file}
									key={file.path}
									onOpenFailure={onOpenFailure}
									onToggleQueuedFile={onToggleQueuedFile}
									selected={selected.has(file.path)}
									syncStatus={syncStatuses[file.path]}
									tagging
								/>
							))}
						</ul>
					</details>
				) : null}
				{failedFiles.length > 0 ? (
					<details
						className="mb-2 rounded bg-(--background-primary-alt) py-1"
						open
					>
						<summary className="cursor-pointer select-none px-3 py-1.5 text-xs font-medium text-(--color-red)">
							Failed ({failedFiles.length})
						</summary>
						<ul className="m-0 list-none p-0">
							{failedFiles.map((file) => (
								<ChangedFileQueueRow
									developerMode={developerMode}
									file={file}
									key={file.path}
									onOpenFailure={onOpenFailure}
									onToggleQueuedFile={onToggleQueuedFile}
									selected={selected.has(file.path)}
									syncStatus={syncStatuses[file.path]}
								/>
							))}
						</ul>
					</details>
				) : null}
				{visibleFiles.length === 0 ? (
					<p className="text-xs text-(--text-muted)">No matching files.</p>
				) : (
					<ul className="m-0 list-none p-0">
						{visibleFiles.map((file) => (
							<ChangedFileQueueRow
								developerMode={developerMode}
								file={file}
								key={file.path}
								onOpenFailure={onOpenFailure}
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

interface ChangedFileQueueRowProps {
	developerMode: boolean;
	file: ChangedFileQueueItem;
	onOpenFailure: (file: ChangedFileQueueItem, error: Error) => void;
	onToggleQueuedFile: (path: string) => void;
	selected: boolean;
	syncStatus?: BatchSyncStatus;
	tagging?: boolean;
}

function ChangedFileQueueRow({
	developerMode,
	file,
	onOpenFailure,
	onToggleQueuedFile,
	selected,
	syncStatus,
	tagging,
}: ChangedFileQueueRowProps) {
	const status = queueStatusDisplay(file);
	const taggable = isTaggableFile(file);
	const selectionClassName = selected ? "opacity-100" : "opacity-50";

	if (tagging) {
		return (
			<li title={`${file.path} — Tagging`}>
				<div className="flex w-full min-w-0 items-center gap-2 px-3 py-1.5">
					<span
						aria-label="Tagging"
						className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-(--interactive-accent) border-r-transparent"
						role="status"
					/>
					<span className="min-w-0 flex-1 truncate animate-pulse text-(--interactive-accent)">
						{file.fileName}
					</span>
				</div>
			</li>
		);
	}

	return (
		<li title={`${file.path} — ${status.label}`}>
			<div className="flex w-full min-w-0 items-center gap-2 px-3 py-1.5 hover:bg-(--background-primary-alt)">
				<label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
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
					<span
						className={`min-w-0 flex-1 truncate ${status.className} ${selectionClassName}`}
					>
						{file.fileName}
					</span>
				</label>
				<RowEnd
					developerMode={developerMode}
					file={file}
					onOpenFailure={onOpenFailure}
					selected={selected}
					syncStatus={syncStatus}
				/>
			</div>
		</li>
	);
}

function RowEnd({
	developerMode,
	file,
	onOpenFailure,
	selected,
	syncStatus,
}: {
	developerMode: boolean;
	file: ChangedFileQueueItem;
	onOpenFailure: (file: ChangedFileQueueItem, error: Error) => void;
	selected: boolean;
	syncStatus?: BatchSyncStatus;
}) {
	if (syncStatus?.type === "syncing") {
		return <span className="text-(--text-muted)">…</span>;
	}

	if (syncStatus?.type === "failed") {
		return developerMode ? (
			<button
				aria-label={`Show tag failure report for ${file.path}`}
				className="text-(--color-red)"
				onClick={() => {
					onOpenFailure(file, syncStatus.error);
				}}
				title={syncStatus.error.message}
				type="button"
			>
				!
			</button>
		) : (
			<span className="text-(--color-red)" title={syncStatus.error.message}>
				!
			</span>
		);
	}

	return file.status === "untagged" ? (
		<span
			aria-label="Never tagged"
			className={`text-lg text-(--text-muted) ${selected ? "opacity-100" : "opacity-50"}`}
		>
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
				className: "text-(--interactive-accent)",
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
