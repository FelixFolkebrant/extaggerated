import { ItemView, Modal, Notice, Plugin, Setting } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { Root } from "react-dom/client";
import {
	DEFAULT_SETTINGS,
	ExtaggeratedSettingTab,
	type ExtaggeratedSettings,
} from "./settings";
import {
	getActiveNoteFreshness,
	getChangedFileQueue,
	type ChangedFileQueueItem,
	type FreshnessStatus,
} from "./freshness";
import { syncActiveNoteTags, syncNoteTags } from "./noteSync";
import {
	mountExtaggeratedView,
	renderExtaggeratedView,
	type ExtaggeratedViewState,
} from "./ui/mount";

const XT_VIEW_TYPE = "extaggerated-view";

export type BatchSyncStatus =
	| { type: "syncing" }
	| { type: "synced"; message: string }
	| { type: "failed"; message: string };

export default class ExtaggeratedPlugin extends Plugin {
	settings: ExtaggeratedSettings = DEFAULT_SETTINGS;
	private headerIndicatorEl: HTMLElement | null = null;
	private headerRefreshId = 0;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(
			XT_VIEW_TYPE,
			(leaf) => new ExtaggeratedPanelView(leaf, this),
		);

		this.addRibbonIcon("tags", "Open Extaggerated", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-extaggerated",
			name: "Open Extaggerated",
			callback: () => {
				void this.activateView();
			},
		});

		this.addCommand({
			id: "sync-tags-active-note",
			name: "Sync tags for active note",
			callback: () => {
				void syncActiveNoteTags(this);
			},
		});

		this.addCommand({
			id: "ignore-active-note",
			name: "Ignore active note",
			callback: () => {
				void this.ignoreActiveNote();
			},
		});

		this.addSettingTab(new ExtaggeratedSettingTab(this.app, this));

		this.registerHeaderSyncIndicator();
	}

	onunload(): void {
		this.headerIndicatorEl?.remove();
		this.headerIndicatorEl = null;
	}

	async loadSettings(): Promise<void> {
		this.settings = {
			...DEFAULT_SETTINGS,
			...((await this.loadData()) as Partial<ExtaggeratedSettings> | null),
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async activateView(): Promise<void> {
		for (const leaf of this.app.workspace.getLeavesOfType(XT_VIEW_TYPE)) {
			leaf.detach();
		}

		const leaf = this.app.workspace.getLeftLeaf(false);

		if (!leaf) {
			new Notice("Could not open Extaggerated.");
			return;
		}

		await leaf.setViewState({
			active: true,
			type: XT_VIEW_TYPE,
		});

		this.app.workspace.revealLeaf(leaf);
	}

	async initializeTagging(): Promise<void> {
		if (this.settings.openRouterApiKey.length === 0) {
			new Notice("Add an OpenRouter API key before initializing XT tagging.");
			return;
		}

		const confirmed = await new OverwriteWarningModal(this.app).openAndWait();

		if (!confirmed) {
			return;
		}

		new Notice(
			"XT tagging initialization confirmed. Changed-note queue comes next.",
		);
	}

	private async ignoreActiveNote(): Promise<void> {
		const file = this.app.workspace.getActiveFile();

		if (!file || file.extension !== "md") {
			new Notice("Open a markdown note before ignoring it.");
			return;
		}

		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			frontmatter.xt_ignore = true;
		});
		await this.refreshHeaderSyncIndicator();

		new Notice(`XT will ignore ${file.basename}.`);
	}

	private registerHeaderSyncIndicator(): void {
		const refresh = () => {
			void this.refreshHeaderSyncIndicator();
		};

		this.app.workspace.onLayoutReady(refresh);
		this.registerEvent(this.app.workspace.on("active-leaf-change", refresh));
		this.registerEvent(this.app.workspace.on("file-open", refresh));
		this.registerEvent(this.app.workspace.on("layout-change", refresh));
		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file === this.app.workspace.getActiveFile()) {
					refresh();
				}
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (file === this.app.workspace.getActiveFile()) {
					refresh();
				}
			}),
		);
	}

	private async refreshHeaderSyncIndicator(): Promise<void> {
		const refreshId = ++this.headerRefreshId;
		const freshnessStatus = await getActiveNoteFreshness(this);

		if (refreshId !== this.headerRefreshId) {
			return;
		}

		this.renderHeaderSyncIndicator(freshnessStatus);
	}

	private renderHeaderSyncIndicator(status: FreshnessStatus): void {
		this.headerIndicatorEl?.remove();
		this.headerIndicatorEl = null;

		if (status.type === "no-note") {
			return;
		}

		const actionsEl =
			this.app.workspace.activeLeaf?.view.containerEl.querySelector(
				".view-header .view-actions",
			);

		if (!actionsEl) {
			return;
		}

		const display = headerSyncIndicatorDisplay(status);
		const indicatorEl = document.createElement("span");
		indicatorEl.className = `xt-sync-indicator xt-sync-indicator--${status.type}`;
		indicatorEl.textContent = "XT";
		indicatorEl.setAttribute("aria-label", display.label);
		indicatorEl.setAttribute("title", display.title);

		actionsEl.prepend(indicatorEl);
		this.headerIndicatorEl = indicatorEl;
	}
}

function headerSyncIndicatorDisplay(
	status: Exclude<FreshnessStatus, { type: "no-note" }>,
): {
	label: string;
	title: string;
} {
	switch (status.type) {
		case "fresh":
			return {
				label: "XT synced",
				title: "XT tags match the current note body.",
			};
		case "ignored":
			return {
				label: "XT ignored",
				title: "XT ignores this note because xt_ignore is enabled.",
			};
		case "stale":
			return {
				label: "XT modified since sync",
				title: "The note body changed after the last XT tag sync.",
			};
		case "untagged":
			return {
				label: "XT never synced",
				title: "No XT content hash is stored on this note.",
			};
		case "unavailable":
			return {
				label: "XT unavailable",
				title: status.message,
			};
	}
}

class OverwriteWarningModal extends Modal {
	private resolve: ((confirmed: boolean) => void) | null = null;
	private settled = false;

	openAndWait(): Promise<boolean> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Initialize XT tagging" });
		contentEl.createEl("p", {
			text: "XT will overwrite the native tags property on every processed note.",
		});
		contentEl.createEl("p", {
			text: "This is irreversible unless your vault is backed up or versioned.",
		});

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => {
					this.finish(false);
				});
			})
			.addButton((button) => {
				button
					.setButtonText("Continue")
					.setCta()
					.onClick(() => {
						this.finish(true);
					});
			});
	}

	onClose(): void {
		this.finish(false);
	}

	private finish(confirmed: boolean): void {
		if (this.settled) {
			return;
		}

		this.settled = true;
		this.resolve?.(confirmed);
		this.close();
	}
}

class ExtaggeratedPanelView extends ItemView {
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
