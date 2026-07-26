import { type ChangedFileQueueItem, isTaggableFile } from "../freshness";

export type BatchSyncStatus =
	| { type: "syncing" }
	| { type: "synced"; message: string }
	| { type: "failed"; error: Error };

export function canSyncFile(
	file: ChangedFileQueueItem,
	status?: BatchSyncStatus,
): boolean {
	return (
		file.status !== "ignored" &&
		file.status !== "unavailable" &&
		(isTaggableFile(file) || status?.type === "failed")
	);
}

interface ChangedFileQueueProps {
	changedFiles: ChangedFileQueueItem[];
	developerMode: boolean;
	hasApiKey: boolean;
	onOpenFailure: (file: ChangedFileQueueItem, error: Error) => void;
	onOpenFile: (file: ChangedFileQueueItem) => void;
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
	onOpenFile,
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
	const isSyncable = (file: ChangedFileQueueItem) =>
		canSyncFile(file, syncStatuses[file.path]);
	const syncableCount = changedFiles.filter(isSyncable).length;
	const selectedSyncableCount = changedFiles.filter(
		(file) => isSyncable(file) && selected.has(file.path),
	).length;
	const queueFiles = changedFiles
		.filter((file) => isSyncable(file) || file.status === "unavailable")
		.sort((a, b) => {
			const order = a.path.localeCompare(b.path);
			return sortAscending ? order : -order;
		});
	const taggingFiles = queueFiles.filter(
		(file) => isSyncable(file) && tagging.has(file.path),
	);
	const matchesSearch = (file: ChangedFileQueueItem) =>
		file.path.toLowerCase().includes(searchQuery.toLowerCase());
	const failedFiles = queueFiles.filter(
		(file) =>
			isSyncable(file) &&
			!tagging.has(file.path) &&
			syncStatuses[file.path]?.type === "failed" &&
			matchesSearch(file),
	);
	const visibleFiles = queueFiles.filter(
		(file) =>
			(!isSyncable(file) ||
				(!tagging.has(file.path) &&
					syncStatuses[file.path]?.type !== "failed")) &&
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
									onOpenFile={onOpenFile}
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
									onOpenFile={onOpenFile}
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
								onOpenFile={onOpenFile}
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
	onOpenFile: (file: ChangedFileQueueItem) => void;
	onToggleQueuedFile: (path: string) => void;
	selected: boolean;
	syncStatus?: BatchSyncStatus;
	tagging?: boolean;
}

function ChangedFileQueueRow({
	developerMode,
	file,
	onOpenFailure,
	onOpenFile,
	onToggleQueuedFile,
	selected,
	syncStatus,
	tagging,
}: ChangedFileQueueRowProps) {
	const status = queueStatusDisplay(file);
	const taggable = canSyncFile(file, syncStatus);
	const isSelected = taggable && selected;
	const selectionClassName = isSelected ? "opacity-100" : "opacity-50";

	if (tagging) {
		return (
			<li title={`${file.path} — Tagging`}>
				<div className="flex w-full min-w-0 items-center gap-2 px-3 py-1.5">
					<span
						aria-label="Tagging"
						className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-(--interactive-accent) border-r-transparent"
						role="status"
					/>
					<button
						className="min-w-0 flex-1 truncate animate-pulse border-0 bg-transparent p-0 text-left text-(--interactive-accent) shadow-none hover:bg-transparent"
						onClick={() => {
							onOpenFile(file);
						}}
						title={`Open ${file.path}`}
						type="button"
					>
						{file.fileName}
					</button>
				</div>
			</li>
		);
	}

	return (
		<li title={`${file.path} — ${status.label}`}>
			<div className="flex w-full min-w-0 items-center gap-2 px-3 py-1.5 hover:bg-(--background-primary-alt)">
				<input
					aria-label={
						taggable
							? `Tag ${file.path}`
							: `Cannot tag ${file.path}: ${status.label}`
					}
					checked={isSelected}
					className="h-4 w-4 shrink-0 accent-(--interactive-accent) disabled:cursor-default"
					disabled={!taggable}
					onChange={() => {
						onToggleQueuedFile(file.path);
					}}
					type="checkbox"
				/>
				<button
					className={`min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left shadow-none hover:bg-transparent ${status.className} ${selectionClassName}`}
					onClick={() => {
						onOpenFile(file);
					}}
					title={`Open ${file.path}`}
					type="button"
				>
					{file.fileName}
				</button>
				{file.status === "unavailable" ? (
					<span
						className="max-w-[40%] truncate text-xs text-(--color-red)"
						title={file.message}
					>
						{file.message}
					</span>
				) : (
					<RowEnd
						developerMode={developerMode}
						file={file}
						onOpenFailure={onOpenFailure}
						selected={isSelected}
						syncStatus={syncStatus}
					/>
				)}
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
		<>
			<span
				aria-hidden="true"
				className={`text-lg text-(--text-muted) ${selected ? "opacity-100" : "opacity-50"}`}
				title="Never tagged"
			>
				+
			</span>
			<span className="sr-only">Never tagged</span>
		</>
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
