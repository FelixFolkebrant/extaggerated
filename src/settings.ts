import { type App, PluginSettingTab, Setting } from "obsidian";
import type ExtaggeratedPlugin from "./main";

export interface ExtaggeratedSettings {
	maxBatchTokens: number;
	openRouterApiKey: string;
	model: string;
}

export const DEFAULT_SETTINGS: ExtaggeratedSettings = {
	maxBatchTokens: 4000,
	openRouterApiKey: "",
	model: "google/gemini-3.1-flash-lite",
};

export function isValidBatchTokenBudget(value: unknown): value is number {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export class ExtaggeratedSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly plugin: ExtaggeratedPlugin,
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Extaggerated" });

		new Setting(containerEl).setName("OpenRouter API key").addText((text) => {
			text.inputEl.type = "password";
			text
				.setPlaceholder("sk-or-...")
				.setValue(this.plugin.settings.openRouterApiKey)
				.onChange(async (value) => {
					this.plugin.settings.openRouterApiKey = value.trim();
					await this.plugin.saveSettings();
				});
		});

		new Setting(containerEl).setName("Model").addText((text) => {
			text
				.setPlaceholder(DEFAULT_SETTINGS.model)
				.setValue(this.plugin.settings.model)
				.onChange(async (value) => {
					this.plugin.settings.model = value.trim() || DEFAULT_SETTINGS.model;
					await this.plugin.saveSettings();
				});
		});

		new Setting(containerEl)
			.setName("Maximum batch tokens")
			.setDesc("Estimated token budget for each tagging request.")
			.addText((text) => {
				text.inputEl.inputMode = "numeric";
				text.inputEl.min = "1";
				text.inputEl.step = "1";
				text
					.setValue(String(this.plugin.settings.maxBatchTokens))
					.onChange(async (value) => {
						const maxBatchTokens = Number(value);
						if (!isValidBatchTokenBudget(maxBatchTokens)) {
							return;
						}

						this.plugin.settings.maxBatchTokens = maxBatchTokens;
						await this.plugin.saveSettings();
					});
			});
	}
}
