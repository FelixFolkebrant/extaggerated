import { Notice, Plugin } from "obsidian";
import {
	DEFAULT_SETTINGS,
	ExtaggeratedSettingTab,
	type ExtaggeratedSettings,
} from "./settings";
import { syncActiveNoteTags } from "./noteSync";
import {
	ExtaggeratedPanelView,
	XT_VIEW_TYPE,
} from "./ui/ExtaggeratedPanelView";
import { registerHeaderSyncIndicator } from "./ui/headerSyncIndicator";
import { OverwriteWarningModal } from "./ui/OverwriteWarningModal";

export default class ExtaggeratedPlugin extends Plugin {
	settings: ExtaggeratedSettings = DEFAULT_SETTINGS;
	private refreshHeaderSyncIndicator: (() => Promise<void>) | null = null;

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

		this.refreshHeaderSyncIndicator = registerHeaderSyncIndicator(this);
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
		await this.refreshHeaderSyncIndicator?.();

		new Notice(`XT will ignore ${file.basename}.`);
	}
}
