import { App, PluginSettingTab, Setting } from "obsidian";
import type ExtaggeratedPlugin from "./main";

export interface ExtaggeratedSettings {
  openRouterApiKey: string;
  model: string;
}

export const DEFAULT_SETTINGS: ExtaggeratedSettings = {
  openRouterApiKey: "",
  model: "google/gemini-3.1-flash-lite"
};

export class ExtaggeratedSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: ExtaggeratedPlugin
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Extaggerated" });

    new Setting(containerEl)
      .setName("OpenRouter API key")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("sk-or-...")
          .setValue(this.plugin.settings.openRouterApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openRouterApiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Model")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.model)
          .setValue(this.plugin.settings.model)
          .onChange(async (value) => {
            this.plugin.settings.model = value.trim() || DEFAULT_SETTINGS.model;
            await this.plugin.saveSettings();
          });
      });
  }
}
