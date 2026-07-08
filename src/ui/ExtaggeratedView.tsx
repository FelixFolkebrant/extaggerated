interface ExtaggeratedViewProps {
  hasApiKey: boolean;
  model: string;
}

export function ExtaggeratedView({ hasApiKey, model }: ExtaggeratedViewProps) {
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
        <div className="grid gap-1">
          <dt className="text-xs uppercase text-[var(--text-muted)]">Provider</dt>
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
