import { Modal, Setting } from "obsidian";

export class TagConfirmationModal extends Modal {
	private resolve: ((confirmed: boolean) => void) | null = null;
	private settled = false;

	constructor(
		app: Modal["app"],
		private readonly fileCount: number,
	) {
		super(app);
	}

	openAndWait(): Promise<boolean> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		this.modalEl.addClass("w-[min(42rem,calc(100vw-2rem))]");
		this.contentEl.empty();
		this.contentEl.addClass("py-6");

		this.contentEl.createEl("h2", { text: "Tag files?" });
		this.contentEl.createEl("p", {
			cls: "mt-6 text-6xl font-semibold text-(--interactive-accent)",
			text: String(this.fileCount),
		});
		this.contentEl.createEl("p", {
			cls: "mt-2 text-lg",
			text: `XT will tag ${this.fileCount} ${this.fileCount === 1 ? "file" : "files"}.`,
		});
		this.contentEl.createEl("p", {
			cls: "mt-6 text-(--text-muted)",
			text: "This overwrites each file's native tags property. Continue only if you want XT to replace those tags.",
		});

		new Setting(this.contentEl)
			.setClass("mt-8")
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => {
					this.finish(false);
				});
			})
			.addButton((button) => {
				button
					.setButtonText(
						`Tag ${this.fileCount} ${this.fileCount === 1 ? "file" : "files"}`,
					)
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
