import { Modal } from "obsidian";

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

		const fields = this.contentEl.createDiv({ cls: "grid gap-4" });
		const nameField = fields.createEl("label", { cls: "grid gap-1" });
		nameField.createEl("span", { text: "Name" });
		const nameInput = nameField.createEl("input", { attr: { type: "text" } });
		nameInput.className = "w-full";
		nameInput.required = true;

		const descriptionField = fields.createEl("label", { cls: "grid gap-1" });
		descriptionField.createEl("span", { text: "Description" });
		const descriptionInput = descriptionField.createEl("textarea", {
			attr: { rows: "4" },
		});
		descriptionInput.className = "w-full";
		descriptionInput.required = true;

		const actions = this.contentEl.createDiv({
			cls: "mt-6 flex justify-end gap-3",
		});
		const cancelButton = actions.createEl("button", { text: "Cancel" });
		const createButton = actions.createEl("button", { text: "Create" });
		createButton.addClass("mod-cta");

		const updateCreateButton = () => {
			createButton.disabled = !this.canCreate();
		};

		nameInput.addEventListener("input", () => {
			this.name = nameInput.value;
			updateCreateButton();
		});
		descriptionInput.addEventListener("input", () => {
			this.description = descriptionInput.value;
			updateCreateButton();
		});
		cancelButton.addEventListener("click", () => {
			this.close();
		});
		createButton.addEventListener("click", () => {
			if (!this.canCreate()) {
				return;
			}

			this.onCreate({
				description: this.description.trim(),
				name: this.name.trim(),
			});
			this.close();
		});

		updateCreateButton();
		nameInput.focus();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private canCreate(): boolean {
		return this.name.trim().length > 0 && this.description.trim().length > 0;
	}
}
