import { ItemView, Modal, Notice, Plugin, Setting } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { Root } from "react-dom/client";
import {
	DEFAULT_SETTINGS,
	ExtaggeratedSettingTab,
	type ExtaggeratedSettings,
} from "./settings";
import { getActiveNoteFreshness, type FreshnessStatus } from "./freshness";
import { syncActiveNoteTags } from "./noteSync";
import {
	mountExtaggeratedView,
	renderExtaggeratedView,
	type ExtaggeratedViewState,
} from "./ui/mount";

const XT_VIEW_TYPE = "extaggerated-view";

export default class ExtaggeratedPlugin extends Plugin {
	settings: ExtaggeratedSettings = DEFAULT_SETTINGS;

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

		this.addSettingTab(new ExtaggeratedSettingTab(this.app, this));
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
		const existingLeaf = this.app.workspace.getLeavesOfType(XT_VIEW_TYPE)[0];
		const leaf = existingLeaf ?? this.app.workspace.getRightLeaf(false);

		if (!leaf) {
			new Notice("Could not open Extaggerated.");
			return;
		}

		if (!existingLeaf) {
			await leaf.setViewState({
				active: true,
				type: XT_VIEW_TYPE,
			});
		}

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
	private root: Root | null = null;
	private freshnessStatus: FreshnessStatus = { type: "no-note" };
	private refreshId = 0;

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
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	private async refreshFreshness(): Promise<void> {
		const refreshId = ++this.refreshId;
		const freshnessStatus = await getActiveNoteFreshness(this.plugin);

		if (refreshId !== this.refreshId) {
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
			freshnessStatus: this.freshnessStatus,
			hasApiKey: this.plugin.settings.openRouterApiKey.length > 0,
			model: this.plugin.settings.model,
			onInitializeTagging: () => {
				void this.plugin.initializeTagging();
			},
		};
	}
}
