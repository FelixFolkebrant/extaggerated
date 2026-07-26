import { useState } from "react";
import type { ChangedFileQueueItem } from "../freshness";
import { type BatchSyncStatus, ChangedFileQueue } from "./ChangedFileQueue";
import { XtMark } from "./XtMark";

type PanelMode = "tagging" | "nodes";

interface ExtaggeratedViewProps {
	changedFiles: ChangedFileQueueItem[];
	developerMode: boolean;
	hasApiKey: boolean;
	onOpenFailure: (file: ChangedFileQueueItem, error: Error) => void;
	onOpenFile: (file: ChangedFileQueueItem) => void;
	onOpenNodeCreation: () => void;
	onOpenSettings: () => void;
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
	taggingPaths: string[];
}

export function ExtaggeratedView(props: ExtaggeratedViewProps) {
	const [mode, setMode] = useState<PanelMode>("tagging");

	return (
		<section className="flex h-full flex-col overflow-hidden py-3 font-(family-name:--font-interface) text-sm text-(--text-normal)">
			<PanelHeader
				changedFiles={props.changedFiles}
				mode={mode}
				onOpenSettings={props.onOpenSettings}
				onRefreshQueue={props.onRefreshQueue}
				onToggleMode={() => {
					setMode(mode === "tagging" ? "nodes" : "tagging");
				}}
				queueLoading={props.queueLoading}
			/>
			{mode === "tagging" ? (
				<ChangedFileQueue {...props} />
			) : (
				<section className="flex flex-1 flex-col px-3 pt-3">
					<button
						className="rounded bg-(--interactive-accent) px-3 py-2 font-medium text-(--text-on-accent)"
						onClick={props.onOpenNodeCreation}
						type="button"
					>
						Create node
					</button>
				</section>
			)}
		</section>
	);
}

function PanelHeader({
	changedFiles,
	mode,
	onOpenSettings,
	onRefreshQueue,
	onToggleMode,
	queueLoading,
}: {
	changedFiles: ChangedFileQueueItem[];
	mode: PanelMode;
	onOpenSettings: () => void;
	onRefreshQueue: () => void;
	onToggleMode: () => void;
	queueLoading: boolean;
}) {
	return (
		<header className="grid gap-3 px-3">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2 text-(--text-normal)">
					<XtMark className="h-auto w-12" />
					<span className="sr-only">Extaggerated</span>
				</div>
				<div className="flex items-center gap-1">
					<button
						aria-label={`Switch to ${mode === "tagging" ? "nodes" : "tagging"}`}
						aria-pressed={mode === "nodes"}
						className="relative h-6 w-11 rounded-full bg-(--background-primary-alt)"
						onClick={onToggleMode}
						title={`Show ${mode === "tagging" ? "nodes" : "tagging"}`}
						type="button"
					>
						<span
							aria-hidden="true"
							className={`absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-(--interactive-accent) text-xs text-(--text-on-accent) transition-transform ${mode === "tagging" ? "translate-x-0" : "translate-x-5"}`}
						>
							{mode === "tagging" ? "#" : "✦"}
						</span>
					</button>
					<button
						aria-label="Open Extaggerated settings"
						className="rounded p-1 text-lg text-(--text-muted) hover:text-(--text-normal)"
						onClick={onOpenSettings}
						title="Open Extaggerated settings"
						type="button"
					>
						⚙
					</button>
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
			</div>
			{mode === "tagging" ? (
				<FileStatusBar changedFiles={changedFiles} />
			) : null}
		</header>
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
