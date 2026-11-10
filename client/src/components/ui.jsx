import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} aria-hidden />;
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, action, children, className = '', bodyClass = 'p-5' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    blue: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon && <span className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-4 w-4" aria-hidden /></span>}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = 'slate', className = '' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  };
  return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]} ${className}`}>{children}</span>;
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="rounded-full bg-slate-100 p-3"><Icon className="h-6 w-6 text-slate-400" aria-hidden /></span>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="card flex flex-col items-start gap-3 border-red-200 bg-red-50/50 p-5 sm:flex-row" role="alert">
      <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" aria-hidden />
      <div className="flex-1">
        <p className="text-sm font-semibold text-red-800">{error.message}</p>
        {error.hint && <p className="mt-1 text-sm text-red-700">{error.hint}</p>}
      </div>
      {onRetry && <button className="btn-secondary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}

export function LoadingCards({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-3 p-5"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-32" /></div>
      ))}
    </div>
  );
}

/** Horizontal bar list — clearer than a chart for a handful of categories. */
export function BarList({ items, total, onSelect, emptyText = 'No values recorded in the sheet yet.' }) {
  const visible = (items || []).filter((i) => i.value !== '__blank__');
  const blank = (items || []).find((i) => i.value === '__blank__');
  if (!visible.length) return <p className="py-6 text-center text-sm text-slate-500">{emptyText}</p>;
  const max = Math.max(...visible.map((i) => i.count));
  return (
    <div>
      <ul className="space-y-2.5">
        {visible.map((i) => (
          <li key={i.value}>
            <button
              type="button"
              disabled={!onSelect}
              onClick={() => onSelect?.(i)}
              className="group block w-full text-left disabled:cursor-default"
              title={i.variants?.length > 1 ? `Spellings in sheet: ${i.variants.join(', ')}` : undefined}
            >
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium text-slate-700 group-enabled:group-hover:text-brand-700">{i.label}</span>
                <span className="shrink-0 tabular-nums text-slate-500">{i.count}{total ? <span className="text-slate-400"> · {Math.round((i.count / total) * 100)}%</span> : null}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-brand-500 transition-all group-enabled:group-hover:bg-brand-600" style={{ width: `${Math.max(4, (i.count / max) * 100)}%` }} />
              </div>
            </button>
          </li>
        ))}
      </ul>
      {blank && <p className="mt-3 text-xs text-slate-400">{blank.count} listing{blank.count > 1 ? 's' : ''} with this field blank</p>}
    </div>
  );
}
