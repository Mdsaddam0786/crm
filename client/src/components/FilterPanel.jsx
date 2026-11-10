import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import MultiSelect from './MultiSelect.jsx';

/** Debounced text input so typing doesn't fire a request per keystroke. */
export function DebouncedInput({ value, onChange, delay = 300, ...props }) {
  const [v, setV] = useState(value || '');
  useEffect(() => { setV(value || ''); }, [value]);
  useEffect(() => {
    if (v === (value || '')) return undefined;
    const t = setTimeout(() => onChange(v), delay);
    return () => clearTimeout(t);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input {...props} value={v} onChange={(e) => setV(e.target.value)} />;
}

const ROLE_ORDER = ['feasibility', 'updatedBy', 'rating', 'sharing', 'status', 'loi', 'mou', 'jda', 'city', 'location', 'area', 'road', 'goodwill', 'jvId', 'phone'];

export function filterableColumns(meta) {
  const rank = (c) => (c.role ? ROLE_ORDER.indexOf(c.role) : 99);
  return meta.columns.filter((c) => c.type !== 'url' && c.role !== 'notes').sort((a, b) => rank(a) - rank(b) || a.index - b.index);
}

export function describeFilter(meta, key, spec) {
  const col = meta.columns.find((c) => c.key === key);
  const name = key === '_month' ? 'Month' : key === '_areaAcres' ? 'Area (acres)' : col?.label || key;
  const opts = key === '_month' ? meta.derivedFilters.month : meta.facets[key];
  switch (spec.op) {
    case 'in': return `${name}: ${spec.values.map((v) => opts?.find((o) => o.value === v)?.label || v).join(', ')}`;
    case 'contains': return `${name} contains “${spec.value}”`;
    case 'filled': return `${name}: has value`;
    case 'blank': return `${name}: blank`;
    case 'range': return `${name}: ${spec.min ?? '…'} – ${spec.max ?? '…'}`;
    default: return name;
  }
}

export function isActive(spec) {
  if (!spec) return false;
  if (spec.op === 'in') return spec.values?.length > 0;
  if (spec.op === 'contains') return !!spec.value?.trim();
  if (spec.op === 'range') return spec.min != null || spec.max != null;
  return spec.op === 'filled' || spec.op === 'blank';
}

export default function FilterPanel({ meta, filters, onChange, onClear }) {
  const set = (key, spec) => {
    const next = { ...filters };
    if (spec && isActive(spec)) next[key] = spec; else delete next[key];
    onChange(next);
  };
  const cols = filterableColumns(meta);
  const area = meta.derivedFilters.areaAcres;
  const num = (v) => (v === '' ? undefined : Number(v));

  return (
    <div className="card mb-4 animate-fade-in p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Advanced search</h2>
          <p className="text-xs text-slate-500">All filters combine (AND). Options and counts come from the current listings.</p>
        </div>
        <button className="btn-ghost text-xs" onClick={onClear}>Reset all</button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {meta.derivedFilters.month && (
          <div>
            <label className="label" htmlFor="f-month">Month (from JV ID)</label>
            <MultiSelect id="f-month" options={meta.derivedFilters.month} value={filters._month?.values || []} onChange={(values) => set('_month', { op: 'in', values })} />
          </div>
        )}
        {cols.map((c) => {
          const id = `f-${c.key}`;
          const spec = filters[c.key];
          return (
            <div key={c.key}>
              <label className="label" htmlFor={id}>{c.label}</label>
              {c.filter === 'select' && <MultiSelect id={id} options={meta.facets[c.key] || []} value={spec?.op === 'in' ? spec.values : []} onChange={(values) => set(c.key, { op: 'in', values })} />}
              {c.filter === 'text' && <DebouncedInput id={id} className="input" placeholder="Contains…" value={spec?.op === 'contains' ? spec.value : ''} onChange={(value) => set(c.key, { op: 'contains', value })} />}
              {c.filter === 'presence' && (
                <select id={id} className="input" value={spec?.op || ''} onChange={(e) => set(c.key, e.target.value ? { op: e.target.value } : null)}>
                  <option value="">Any</option><option value="filled">Has a value</option><option value="blank">Blank</option>
                </select>
              )}
            </div>
          );
        })}
        {area && (
          <div>
            <label className="label" htmlFor="f-area-min">Area in acres (interpreted)</label>
            <div className="flex items-center gap-2">
              <DebouncedInput id="f-area-min" type="number" min="0" step="0.1" className="input" placeholder={`Min ${area.min}`} value={filters._areaAcres?.min ?? ''} onChange={(v) => set('_areaAcres', { op: 'range', min: num(v), max: filters._areaAcres?.max })} />
              <span className="text-slate-400">–</span>
              <DebouncedInput aria-label="Maximum acres" type="number" min="0" step="0.1" className="input" placeholder={`Max ${area.max}`} value={filters._areaAcres?.max ?? ''} onChange={(v) => set('_areaAcres', { op: 'range', min: filters._areaAcres?.min, max: num(v) })} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ActiveFilterChips({ meta, filters, onRemove, onClear }) {
  const entries = Object.entries(filters).filter(([, s]) => isActive(s));
  if (!entries.length) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {entries.map(([k, s]) => (
        <span key={k} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-200">
          {describeFilter(meta, k, s)}
          <button className="rounded-full p-0.5 hover:bg-brand-100" onClick={() => onRemove(k)} aria-label={`Remove filter ${describeFilter(meta, k, s)}`}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <button className="text-xs font-medium text-slate-500 hover:text-slate-800" onClick={onClear}>Clear all</button>
    </div>
  );
}
