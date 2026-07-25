import { type ButtonComponent, Modal, Setting } from "obsidian";

export interface NodeDraft {
	description: string;
	name: string;
}

export class NodeCreationModal extends Modal {
	private description = "";
	private name = "";

	constructor(
		app: Modal["app"],
		private readonly onCreate: (draft: NodeDraft) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.empty();
		this.contentEl.createEl("h2", { text: "Create node" });

		let createButton: ButtonComponent | undefined;
		const updateCreateButton = () => {
			createButton?.setDisabled(!this.canCreate());
		};

		new Setting(this.contentEl).setName("Name").addText((text) => {
			text.inputEl.required = true;
			text.onChange((value) => {
				this.name = value;
				updateCreateButton();
			});
			text.inputEl.focus();
		});

		new Setting(this.contentEl).setName("Description").addTextArea((text) => {
			text.inputEl.required = true;
			text.onChange((value) => {
				this.description = value;
				updateCreateButton();
			});
		});

		new Setting(this.contentEl)
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => {
					this.close();
				});
			})
			.addButton((button) => {
				createButton = button.setButtonText("Create").setCta();
				updateCreateButton();
				button.onClick(() => {
					if (!this.canCreate()) {
						return;
					}

					this.onCreate({
						description: this.description.trim(),
						name: this.name.trim(),
					});
					this.close();
				});
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private canCreate(): boolean {
		return this.name.trim().length > 0 && this.description.trim().length > 0;
	}
}
