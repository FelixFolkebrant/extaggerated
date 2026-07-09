import type { FreshnessStatus } from "../freshness";

interface ExtaggeratedViewProps {
	freshnessStatus: FreshnessStatus;
	hasApiKey: boolean;
	model: string;
	onInitializeTagging: () => void;
}

export function ExtaggeratedView({
	freshnessStatus,
	hasApiKey,
	model,
	onInitializeTagging,
}: ExtaggeratedViewProps) {
	const freshness = freshnessDisplay(freshnessStatus);

	return (
		<section className="xt-view flex h-full flex-col gap-4 p-4 text-sm text-(--text-normal)">
			<header className="flex items-center justify-between border-b border-[var(--background-modifier-border)] pb-3">
				<div className="min-w-0">
					<h1 className="truncate text-base font-semibold">Extaggerated</h1>
					<p className="text-xs text-[var(--text-muted)]">XT</p>
				</div>
				<span
					className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${
						hasApiKey
							? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
							: "bg-amber-500/15 text-amber-700 dark:text-amber-300"
					}`}
				>
					{hasApiKey ? "Configured" : "No key"}
				</span>
			</header>

			<dl className="grid gap-3">
				<div className="grid gap-2">
					<dt className="text-xs uppercase text-[var(--text-muted)]">
						Tagging
					</dt>
					<dd className="grid gap-2">
						<button
							className="rounded bg-[var(--interactive-accent)] px-3 py-2 text-left text-sm font-medium text-[var(--text-on-accent)] disabled:cursor-not-allowed disabled:opacity-50"
							disabled={!hasApiKey}
							onClick={onInitializeTagging}
							type="button"
						>
							Initialize tagging
						</button>
						{!hasApiKey ? (
							<p className="text-xs text-[var(--text-muted)]">
								Add an OpenRouter API key in settings first.
							</p>
						) : null}
					</dd>
				</div>
				<div className="grid gap-1">
					<dt className="text-xs uppercase text-[var(--text-muted)]">
						Active note
					</dt>
					<dd className="flex items-center justify-between gap-3">
						<span className="min-w-0 truncate" title={freshness.note}>
							{freshness.note}
						</span>
						<span
							className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${freshness.className}`}
							title={freshness.title}
						>
							{freshness.label}
						</span>
					</dd>
				</div>
				<div className="grid gap-1">
					<dt className="text-xs uppercase text-[var(--text-muted)]">
						Provider
					</dt>
					<dd>OpenRouter</dd>
				</div>
				<div className="grid gap-1">
					<dt className="text-xs uppercase text-[var(--text-muted)]">Model</dt>
					<dd className="truncate" title={model}>
						{model}
					</dd>
				</div>
			</dl>
		</section>
	);
}

function freshnessDisplay(status: FreshnessStatus): {
	className: string;
	label: string;
	note: string;
	title: string;
} {
	switch (status.type) {
		case "fresh":
			return {
				className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
				label: "Fresh",
				note: status.fileName,
				title: "Tags match the current note body.",
			};
		case "stale":
			return {
				className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
				label: "Stale",
				note: status.fileName,
				title: "The note body changed after the last XT tag sync.",
			};
		case "untagged":
			return {
				className: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
				label: "Untagged",
				note: status.fileName,
				title: "No XT content hash is stored on this note.",
			};
		case "unavailable":
			return {
				className: "bg-red-500/15 text-red-700 dark:text-red-300",
				label: "Unavailable",
				note: status.fileName,
				title: status.message,
			};
		case "no-note":
			return {
				className:
					"bg-[var(--background-modifier-border)] text-[var(--text-muted)]",
				label: "No note",
				note: "No markdown note selected",
				title: "Open a markdown note to see XT freshness.",
			};
	}
}
