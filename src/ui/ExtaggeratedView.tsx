import { useState } from "react";
import type { ChangedFileQueueItem } from "../freshness";
import { type BatchSyncStatus, ChangedFileQueue } from "./ChangedFileQueue";
import { XtMark } from "./XtMark";

type PanelMode = "tagging" | "nodes";

interface ExtaggeratedViewProps {
	changedFiles: ChangedFileQueueItem[];
	hasApiKey: boolean;
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
				onSelectMode={setMode}
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
	onSelectMode,
	queueLoading,
}: {
	changedFiles: ChangedFileQueueItem[];
	mode: PanelMode;
	onOpenSettings: () => void;
	onRefreshQueue: () => void;
	onSelectMode: (mode: PanelMode) => void;
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
					<div
						aria-label="Panel mode"
						className="flex rounded-full bg-(--background-primary-alt) p-0.5"
					>
						<button
							aria-label="Show tagging"
							aria-pressed={mode === "tagging"}
							className={`rounded-full px-2 py-1 text-sm ${mode === "tagging" ? "bg-(--background-primary) text-(--text-normal) shadow-sm" : "text-(--text-muted)"}`}
							onClick={() => {
								onSelectMode("tagging");
							}}
							title="Tagging"
							type="button"
						>
							#
						</button>
						<button
							aria-label="Show nodes"
							aria-pressed={mode === "nodes"}
							className={`rounded-full px-2 py-1 text-sm ${mode === "nodes" ? "bg-(--background-primary) text-(--text-normal) shadow-sm" : "text-(--text-muted)"}`}
							onClick={() => {
								onSelectMode("nodes");
							}}
							title="Nodes"
							type="button"
						>
							✦
						</button>
					</div>
					<button
						aria-label="Open Extaggerated settings"
						className="rounded p-1 text-lg text-(--text-muted) hover:text-(--text-normal)"
						onClick={onOpenSettings}
						title="Open Extaggerated settings"
						type="button"
					>
						⚙
					</button>
					{mode === "tagging" ? (
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
					) : null}
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
