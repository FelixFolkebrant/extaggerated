import { ItemView, Notice } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { Root } from "react-dom/client";
import type ExtaggeratedPlugin from "../main";
import {
	getChangedFileQueue,
	isTaggableFile,
	type ChangedFileQueueItem,
} from "../freshness";
import { syncNoteTags } from "../noteSync";
import type { BatchSyncStatus } from "./ChangedFileQueue";
import { TagAllConfirmationModal } from "./TagAllConfirmationModal";
import {
	mountExtaggeratedView,
	renderExtaggeratedView,
	type ExtaggeratedViewState,
} from "./mount";

export const XT_VIEW_TYPE = "extaggerated-view";

export class ExtaggeratedPanelView extends ItemView {
	private changedFiles: ChangedFileQueueItem[] = [];
	private root: Root | null = null;
	private queueLoading = false;
	private queueRefreshId = 0;
	private searchQuery = "";
	private selectedPaths = new Set<string>();
	private sortAscending = true;
	private syncStatuses: Record<string, BatchSyncStatus> = {};

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: ExtaggeratedPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return XT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Extaggerated";
	}

	getIcon(): string {
		return "tags";
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		const container = this.contentEl.createDiv();
		this.root = mountExtaggeratedView({
			container,
			...this.viewState(),
		});

		await this.refreshQueue();
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	private render(): void {
		if (!this.root) {
			return;
		}

		renderExtaggeratedView(this.root, this.viewState());
	}

	private viewState(): ExtaggeratedViewState {
		return {
			changedFiles: this.changedFiles,
			hasApiKey: this.plugin.settings.openRouterApiKey.length > 0,
			onRefreshQueue: () => {
				void this.refreshQueue();
			},
			onSearchChange: (query) => {
				this.searchQuery = query;
				this.render();
			},
			onSyncAll: () => {
				void this.confirmAndSyncAll();
			},
			onSyncSelected: () => {
				void this.syncQueuedFiles(
					this.syncableQueuePaths().filter((path) =>
						this.selectedPaths.has(path),
					),
				);
			},
			onToggleQueuedFile: (path) => {
				this.toggleQueuedFile(path);
			},
			onToggleSortDirection: () => {
				this.sortAscending = !this.sortAscending;
				this.render();
			},
			queueLoading: this.queueLoading,
			searchQuery: this.searchQuery,
			selectedPaths: [...this.selectedPaths],
			sortAscending: this.sortAscending,
			syncStatuses: this.syncStatuses,
		};
	}

	private async refreshQueue(): Promise<void> {
		const refreshId = ++this.queueRefreshId;
		this.queueLoading = true;
		this.render();

		const changedFiles = await getChangedFileQueue(this.plugin);

		if (refreshId !== this.queueRefreshId) {
			return;
		}

		this.changedFiles = changedFiles;
		this.queueLoading = false;
		this.selectedPaths = new Set(
			[...this.selectedPaths].filter((path) =>
				this.changedFiles.some(
					(file) => file.path === path && isTaggableFile(file),
				),
			),
		);
		this.render();
	}

	private toggleQueuedFile(path: string): void {
		if (this.selectedPaths.has(path)) {
			this.selectedPaths.delete(path);
		} else {
			this.selectedPaths.add(path);
		}

		this.render();
	}

	private syncableQueuePaths(): string[] {
		return this.changedFiles.filter(isTaggableFile).map((file) => file.path);
	}

	private async confirmAndSyncAll(): Promise<void> {
		const paths = this.syncableQueuePaths();

		if (paths.length === 0) {
			new Notice("No changed or untagged notes are available to tag.");
			return;
		}

		const confirmed = await new TagAllConfirmationModal(
			this.app,
			paths.length,
		).openAndWait();

		if (confirmed) {
			await this.syncQueuedFiles(paths);
		}
	}

	private async syncQueuedFiles(paths: string[]): Promise<void> {
		if (paths.length === 0) {
			new Notice("Select at least one queued note to sync.");
			return;
		}

		if (this.plugin.settings.openRouterApiKey.length === 0) {
			new Notice("Add an OpenRouter API key before syncing XT tags.");
			return;
		}

		for (const path of paths) {
			const file = this.plugin.app.vault.getFileByPath(path);

			if (!file) {
				this.syncStatuses = {
					...this.syncStatuses,
					[path]: { message: "File no longer exists.", type: "failed" },
				};
				this.render();
				continue;
			}

			this.syncStatuses = {
				...this.syncStatuses,
				[path]: { type: "syncing" },
			};
			this.render();

			try {
				const result = await syncNoteTags(this.plugin, file);
				this.syncStatuses = {
					...this.syncStatuses,
					[path]: {
						message: `${result.tagCount} tags`,
						type: "synced",
					},
				};
			} catch (error) {
				this.syncStatuses = {
					...this.syncStatuses,
					[path]: {
						message: error instanceof Error ? error.message : String(error),
						type: "failed",
					},
				};
			}
			this.render();
		}

		await this.refreshQueue();
	}
}
