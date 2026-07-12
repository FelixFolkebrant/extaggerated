import { Modal, Setting } from "obsidian";

export class OverwriteWarningModal extends Modal {
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
