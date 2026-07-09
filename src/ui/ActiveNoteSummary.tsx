import type { FreshnessStatus } from "../freshness";

interface ActiveNoteSummaryProps {
	freshnessStatus: FreshnessStatus;
}

export function ActiveNoteSummary({ freshnessStatus }: ActiveNoteSummaryProps) {
	const freshness = freshnessDisplay(freshnessStatus);

	return (
		<div className="grid gap-1">
			<dt className="text-xs uppercase text-(--text-muted)">Active note</dt>
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
				className: "bg-(--background-modifier-border) text-(--text-muted)",
				label: "No note",
				note: "No markdown note selected",
				title: "Open a markdown note to see XT freshness.",
			};
	}
}
