import { useState } from "react";
import type { ChangedFileQueueItem } from "../freshness";
import { type BatchSyncStatus, ChangedFileQueue } from "./ChangedFileQueue";

export interface NodeDraft {
	description: string;
	name: string;
}

interface ExtaggeratedViewProps {
	changedFiles: ChangedFileQueueItem[];
	hasApiKey: boolean;
	onCreateNode: (draft: NodeDraft) => void;
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
	const [creatingNode, setCreatingNode] = useState(false);
	const [nodeDescription, setNodeDescription] = useState("");
	const [nodeName, setNodeName] = useState("");
	const draft: NodeDraft = {
		description: nodeDescription.trim(),
		name: nodeName.trim(),
	};
	const canCreateNode = draft.name.length > 0 && draft.description.length > 0;

	function closeNodeForm(): void {
		setCreatingNode(false);
		setNodeName("");
		setNodeDescription("");
	}

	return (
		<section className="flex h-full flex-col overflow-hidden py-3 font-(family-name:--font-interface) text-sm text-(--text-normal)">
			<ChangedFileQueue {...props} />
			<div className="border-t border-(--background-modifier-border) px-3 pt-3">
				{creatingNode ? (
					<form
						className="grid gap-3"
						onSubmit={(event) => {
							event.preventDefault();

							if (!canCreateNode) {
								return;
							}

							props.onCreateNode(draft);
							closeNodeForm();
						}}
					>
						<label className="grid gap-1">
							<span className="text-xs text-(--text-muted)">Name</span>
							<input
								autoFocus
								className="rounded bg-(--background-primary-alt) px-3 py-2 outline-none focus:ring-1 focus:ring-(--interactive-accent)"
								onChange={(event) => {
									setNodeName(event.target.value);
								}}
								required
								value={nodeName}
							/>
						</label>
						<label className="grid gap-1">
							<span className="text-xs text-(--text-muted)">Description</span>
							<textarea
								className="min-h-20 resize-y rounded bg-(--background-primary-alt) px-3 py-2 outline-none focus:ring-1 focus:ring-(--interactive-accent)"
								onChange={(event) => {
									setNodeDescription(event.target.value);
								}}
								required
								value={nodeDescription}
							/>
						</label>
						<div className="grid grid-cols-2 gap-3">
							<button
								className="rounded bg-(--interactive-accent) px-3 py-2 font-medium text-(--text-on-accent) disabled:cursor-not-allowed disabled:opacity-60"
								disabled={!canCreateNode}
								type="submit"
							>
								Create
							</button>
							<button
								className="rounded bg-(--background-primary-alt) px-3 py-2 font-medium"
								onClick={closeNodeForm}
								type="button"
							>
								Cancel
							</button>
						</div>
					</form>
				) : (
					<button
						className="w-full rounded bg-(--background-primary-alt) px-3 py-2 font-medium"
						onClick={() => {
							setCreatingNode(true);
						}}
						type="button"
					>
						Create node
					</button>
				)}
			</div>
		</section>
	);
}
