import { Menu } from "obsidian";
import { type FreshnessStatus, getActiveNoteFreshness } from "../freshness";
import type ExtaggeratedPlugin from "../main";
import { ignoreActiveNote, syncActiveNoteTags } from "../noteSync";
import { renderXtMark } from "./XtMark";

const indicatorClassName =
	"me-(--size-2-1) inline-flex h-(--clickable-icon-size) min-w-(--clickable-icon-size) cursor-pointer items-center justify-center rounded hover:bg-(--background-modifier-hover) [&>svg]:w-6";

export function registerHeaderSyncIndicator(
	plugin: ExtaggeratedPlugin,
): () => Promise<void> {
	let indicatorEl: HTMLElement | null = null;
	let refreshId = 0;

	const render = (status: FreshnessStatus) => {
		indicatorEl?.remove();
		indicatorEl = null;

		if (status.type === "no-note" || status.type === "ignored") {
			return;
		}

		const actionsEl =
			plugin.app.workspace.activeLeaf?.view.containerEl.querySelector(
				".view-header .view-actions",
			);

		if (!actionsEl) {
			return;
		}

		const display = headerSyncIndicatorDisplay(status);
		indicatorEl = document.createElement("button");
		indicatorEl.className = `${indicatorClassName} ${display.className}`;
		renderXtMark(indicatorEl);
		indicatorEl.setAttribute("aria-label", display.label);
		indicatorEl.setAttribute("aria-haspopup", "menu");
		indicatorEl.setAttribute("title", display.title);
		indicatorEl.setAttribute("type", "button");
		indicatorEl.addEventListener("click", (event) => {
			const menu = new Menu();
			menu.addItem((item) => {
				item.setTitle(`Status: ${display.title}`).setDisabled(true);
			});

			if (status.type === "stale" || status.type === "untagged") {
				menu.addItem((item) => {
					item
						.setIcon("refresh-cw")
						.setTitle("Retag")
						.onClick(() => {
							void syncActiveNoteTags(plugin).then(requestRefresh);
						});
				});
			}

			menu.addItem((item) => {
				item
					.setIcon("circle-off")
					.setTitle("Ignore with XT")
					.onClick(() => {
						void ignoreActiveNote(plugin).then(requestRefresh);
					});
			});
			menu.showAtMouseEvent(event);
		});

		actionsEl.prepend(indicatorEl);
	};

	const refresh = async () => {
		const currentRefreshId = ++refreshId;
		const freshnessStatus = await getActiveNoteFreshness(plugin);

		if (currentRefreshId === refreshId) {
			render(freshnessStatus);
		}
	};

	const requestRefresh = () => {
		void refresh();
	};

	plugin.app.workspace.onLayoutReady(requestRefresh);
	plugin.registerEvent(
		plugin.app.workspace.on("active-leaf-change", requestRefresh),
	);
	plugin.registerEvent(plugin.app.workspace.on("file-open", requestRefresh));
	plugin.registerEvent(
		plugin.app.workspace.on("layout-change", requestRefresh),
	);
	plugin.registerEvent(
		plugin.app.vault.on("modify", (file) => {
			if (file === plugin.app.workspace.getActiveFile()) {
				requestRefresh();
			}
		}),
	);
	plugin.registerEvent(
		plugin.app.metadataCache.on("changed", (file) => {
			if (file === plugin.app.workspace.getActiveFile()) {
				requestRefresh();
			}
		}),
	);
	plugin.register(() => indicatorEl?.remove());

	return refresh;
}

function headerSyncIndicatorDisplay(
	status: Exclude<FreshnessStatus, { type: "no-note" } | { type: "ignored" }>,
): {
	className: string;
	label: string;
	title: string;
} {
	switch (status.type) {
		case "fresh":
			return {
				className: "text-(--interactive-accent)",
				label: "XT tagged",
				title: "Tagged",
			};
		case "stale":
			return {
				className: "text-(--interactive-accent) opacity-40",
				label: "XT modified since sync",
				title: "Needs retagging",
			};
		case "untagged":
			return {
				className: "text-(--text-muted)",
				label: "XT never synced",
				title: "Untagged",
			};
		case "unavailable":
			return {
				className: "bg-(--color-red)/18 text-(--color-red)",
				label: "XT unavailable",
				title: status.message,
			};
	}
}
