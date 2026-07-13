import type ExtaggeratedPlugin from "../main";
import { getActiveNoteFreshness, type FreshnessStatus } from "../freshness";

const indicatorClassName =
	"me-(--size-2-1) inline-flex h-(--clickable-icon-size) min-w-(--clickable-icon-size) items-center justify-center rounded-full text-(length:--font-ui-smaller) font-semibold";

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
		indicatorEl.className = `${indicatorClassName} ${display.className}`;
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
	className: string;
	label: string;
	title: string;
} {
	switch (status.type) {
		case "fresh":
			return {
				className: "bg-(--color-green)/18 text-(--color-green)",
				label: "XT synced",
				title: "XT tags match the current note body.",
			};
		case "ignored":
			return {
				className: "bg-(--background-modifier-border) text-(--text-muted)",
				label: "XT ignored",
				title: "XT ignores this note because xt_ignore is enabled.",
			};
		case "stale":
			return {
				className: "bg-(--color-yellow)/18 text-(--color-yellow)",
				label: "XT modified since sync",
				title: "The note body changed after the last XT tag sync.",
			};
		case "untagged":
			return {
				className: "bg-(--color-red)/18 text-(--color-red)",
				label: "XT never synced",
				title: "No XT content hash is stored on this note.",
			};
		case "unavailable":
			return {
				className: "bg-(--color-red)/18 text-(--color-red)",
				label: "XT unavailable",
				title: status.message,
			};
	}
}
