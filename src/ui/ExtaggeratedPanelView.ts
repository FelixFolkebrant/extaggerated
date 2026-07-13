import { ItemView, Notice } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { Root } from "react-dom/client";
import type ExtaggeratedPlugin from "../main";
import {
	getActiveNoteFreshness,
	getChangedFileQueue,
	type ChangedFileQueueItem,
	type FreshnessStatus,
} from "../freshness";
import { syncNoteTags } from "../noteSync";
import type { BatchSyncStatus } from "./ChangedFileQueue";
import {
	mountExtaggeratedView,
	renderExtaggeratedView,
	type ExtaggeratedViewState,
} from "./mount";

export const XT_VIEW_TYPE = "extaggerated-view";

export class ExtaggeratedPanelView extends ItemView {
	private changedFiles: ChangedFileQueueItem[] = [];
	private root: Root | null = null;
	private freshnessStatus: FreshnessStatus = { type: "no-note" };
	private freshnessRefreshId = 0;
	private queueLoading = false;
	private queueRefreshId = 0;
	private selectedPaths = new Set<string>();
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

		this.registerEvent(
			this.app.workspace.on("file-open", () => {
				void this.refreshFreshness();
			}),
		);
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file === this.app.workspace.getActiveFile()) {
					void this.refreshFreshness();
				}
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (file === this.app.workspace.getActiveFile()) {
					void this.refreshFreshness();
				}
			}),
		);

		await this.refreshFreshness();
		await this.refreshQueue();
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	private async refreshFreshness(): Promise<void> {
		const refreshId = ++this.freshnessRefreshId;
		const freshnessStatus = await getActiveNoteFreshness(this.plugin);

		if (refreshId !== this.freshnessRefreshId) {
			return;
		}

		this.freshnessStatus = freshnessStatus;
		this.render();
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
			freshnessStatus: this.freshnessStatus,
			hasApiKey: this.plugin.settings.openRouterApiKey.length > 0,
			model: this.plugin.settings.model,
			onInitializeTagging: () => {
				void this.plugin.initializeTagging();
			},
			onRefreshQueue: () => {
				void this.refreshQueue();
			},
			onSyncAll: () => {
				void this.syncQueuedFiles(this.syncableQueuePaths());
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
			queueLoading: this.queueLoading,
			selectedPaths: [...this.selectedPaths],
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
				this.changedFiles.some((file) => file.path === path),
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
		return this.changedFiles
			.filter((file) => file.status !== "unavailable")
			.map((file) => file.path);
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
