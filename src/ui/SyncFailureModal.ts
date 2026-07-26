import { Modal, Notice } from "obsidian";

export class SyncFailureModal extends Modal {
	constructor(
		app: Modal["app"],
		private readonly filePath: string,
		private readonly error: Error,
	) {
		super(app);
	}

	onOpen(): void {
		const report = this.report();
		this.contentEl.empty();
		this.contentEl.createEl("h2", { text: "Tag sync failure" });
		const details = this.contentEl.createEl("textarea", {
			attr: { readonly: "true", rows: "12" },
			cls: "w-full rounded border border-(--background-modifier-border) bg-black p-3 font-(family-name:--font-monospace) text-sm text-white/80",
		});
		details.value = report;

		const copyButton = this.contentEl.createEl("button", {
			cls: "mod-cta mt-3",
			text: "Copy",
		});
		copyButton.addEventListener("click", async () => {
			try {
				await navigator.clipboard.writeText(report);
				new Notice("Copied tag failure report.");
			} catch (cause) {
				const message = cause instanceof Error ? cause.message : String(cause);
				new Notice(`XT could not copy the failure report: ${message}`);
			}
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private report(): string {
		return [
			"XT tag sync failure",
			`File: ${this.filePath}`,
			`Error: ${this.error.name}: ${this.error.message}`,
			"Stack:",
			this.error.stack ?? "No stack trace available.",
		].join("\n\n");
	}
}
