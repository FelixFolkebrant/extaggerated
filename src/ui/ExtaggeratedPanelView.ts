import { ItemView, Notice } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { Root } from "react-dom/client";
import type ExtaggeratedPlugin from "../main";
import {
	getChangedFileQueue,
	isTaggableFile,
	type ChangedFileQueueItem,
} from "../freshness";
import { syncNoteTagBatch } from "../noteSync";
import { generateNode } from "../nodeGeneration";
import type { BatchSyncStatus } from "./ChangedFileQueue";
import { TagAllConfirmationModal } from "./TagAllConfirmationModal";
import {
	mountExtaggeratedView,
	renderExtaggeratedView,
	type ExtaggeratedViewState,
} from "./mount";
import { NodeCreationModal, type NodeDraft } from "./NodeCreationModal";

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
	private taggingPaths = new Set<string>();
	private nodeCreating = false;

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
			onOpenNodeCreation: () => {
				this.openNodeCreation();
			},
			onOpenSettings: () => {
				this.plugin.openSettings();
			},
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
			taggingPaths: [...this.taggingPaths],
		};
	}

	private openNodeCreation(): void {
		new NodeCreationModal(this.app, (draft) => {
			return this.createNode(draft);
		}).open();
	}

	private async createNode(draft: NodeDraft): Promise<void> {
		if (this.nodeCreating) {
			throw new Error("XT is already creating a node.");
		}

		this.nodeCreating = true;
		try {
			await generateNode(this.plugin, draft);
			new Notice(`Created ${draft.name}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`XT could not create ${draft.name}: ${message}`, 8_000);
			throw error;
		} finally {
			this.nodeCreating = false;
		}
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
		if (this.taggingPaths.size > 0) {
			return;
		}

		if (paths.length === 0) {
			new Notice("Select at least one queued note to sync.");
			return;
		}

		if (this.plugin.settings.openRouterApiKey.length === 0) {
			new Notice("Add an OpenRouter API key before syncing XT tags.");
			return;
		}

		this.taggingPaths = new Set(paths);
		this.render();

		try {
			const files = paths.flatMap((path) => {
				const file = this.plugin.app.vault.getFileByPath(path);

				if (!file) {
					new Notice(`XT could not tag ${path}: file no longer exists.`, 8_000);
					this.syncStatuses = {
						...this.syncStatuses,
						[path]: { message: "File no longer exists.", type: "failed" },
					};
					this.render();
					return [];
				}

				this.syncStatuses = {
					...this.syncStatuses,
					[path]: { type: "syncing" },
				};
				this.render();
				return [file];
			});

			await syncNoteTagBatch(this.plugin, files, (outcome) => {
				if (outcome.result) {
					this.syncStatuses = {
						...this.syncStatuses,
						[outcome.file.path]: {
							message: `${outcome.result.tagCount} tags`,
							type: "synced",
						},
					};
				} else {
					const message = outcome.error?.message ?? "XT tag sync failed.";
					new Notice(
						`XT could not tag ${outcome.file.basename}: ${message}`,
						8_000,
					);
					this.syncStatuses = {
						...this.syncStatuses,
						[outcome.file.path]: {
							message,
							type: "failed",
						},
					};
				}
				this.render();
			});

			await this.refreshQueue();
		} finally {
			this.taggingPaths.clear();
			this.render();
		}
	}
}
