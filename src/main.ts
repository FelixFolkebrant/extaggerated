import { ItemView, Notice, Plugin } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { Root } from "react-dom/client";
import {
	DEFAULT_SETTINGS,
	ExtaggeratedSettingTab,
	type ExtaggeratedSettings,
} from "./settings";
import { mountExtaggeratedView } from "./ui/mount";

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
}

class ExtaggeratedPanelView extends ItemView {
	private root: Root | null = null;

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
			hasApiKey: this.plugin.settings.openRouterApiKey.length > 0,
			model: this.plugin.settings.model,
		});
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}
}
