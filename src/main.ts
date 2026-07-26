import { Notice, Plugin } from "obsidian";
import {
	clearXtStateFromActiveNote,
	clearXtStateFromVault,
	ignoreActiveNote,
	syncActiveNoteTags,
} from "./noteSync";
import {
	DEFAULT_SETTINGS,
	type ExtaggeratedSettings,
	ExtaggeratedSettingTab,
	parseSettings,
} from "./settings";
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
				this.runCommand("Ignore active note failed", this.ignoreActiveNote());
			},
		});

		this.addCommand({
			id: "debug-clear-xt-state-active-note",
			name: "Debug: Clear XT metadata from active note",
			callback: () => {
				this.runCommand(
					"Clearing XT metadata from the active note failed",
					this.clearXtStateFromActiveNote(),
				);
			},
		});

		this.addCommand({
			id: "debug-clear-xt-state-vault",
			name: "Debug: Clear XT metadata from all notes",
			callback: () => {
				this.runCommand(
					"Clearing XT metadata from the vault failed",
					clearXtStateFromVault(this),
				);
			},
		});

		this.addSettingTab(new ExtaggeratedSettingTab(this.app, this));

		this.refreshHeaderSyncIndicator = registerHeaderSyncIndicator(this);
	}

	async loadSettings(): Promise<void> {
		this.settings = parseSettings(await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	openSettings(): void {
		const settings = (
			this.app as typeof this.app & {
				setting: { open: () => void; openTabById: (id: string) => void };
			}
		).setting;

		settings.open();
		settings.openTabById(this.manifest.id);
	}

	private runCommand(failureMessage: string, command: Promise<void>): void {
		void command.catch((error) => {
			new Notice(
				`${failureMessage}: ${error instanceof Error ? error.message : String(error)}`,
			);
		});
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
		if (await ignoreActiveNote(this)) {
			await this.refreshHeaderSyncIndicator?.();
		}
	}

	private async clearXtStateFromActiveNote(): Promise<void> {
		if (await clearXtStateFromActiveNote(this)) {
			await this.refreshHeaderSyncIndicator?.();
		}
	}
}
