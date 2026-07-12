import type ExtaggeratedPlugin from "../main";
import { getActiveNoteFreshness, type FreshnessStatus } from "../freshness";

export function registerHeaderSyncIndicator(
	plugin: ExtaggeratedPlugin,
): () => Promise<void> {
	let indicatorEl: HTMLElement | null = null;
	let refreshId = 0;

	const render = (status: FreshnessStatus) => {
		indicatorEl?.remove();
		indicatorEl = null;

		if (status.type === "no-note") {
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
		indicatorEl = document.createElement("span");
		indicatorEl.className = `xt-sync-indicator xt-sync-indicator--${status.type}`;
		indicatorEl.textContent = "XT";
		indicatorEl.setAttribute("aria-label", display.label);
		indicatorEl.setAttribute("title", display.title);

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
	status: Exclude<FreshnessStatus, { type: "no-note" }>,
): {
	label: string;
	title: string;
} {
	switch (status.type) {
		case "fresh":
			return {
				label: "XT synced",
				title: "XT tags match the current note body.",
			};
		case "ignored":
			return {
				label: "XT ignored",
				title: "XT ignores this note because xt_ignore is enabled.",
			};
		case "stale":
			return {
				label: "XT modified since sync",
				title: "The note body changed after the last XT tag sync.",
			};
		case "untagged":
			return {
				label: "XT never synced",
				title: "No XT content hash is stored on this note.",
			};
		case "unavailable":
			return {
				label: "XT unavailable",
				title: status.message,
			};
	}
}
