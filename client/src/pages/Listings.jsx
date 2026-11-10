import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Download, Plus, Search, SlidersHorizontal, SearchX, X } from 'lucide-react';
import { useApi, useApp } from '../lib/AppContext.jsx';
import { Card, ErrorState, PageHeader, Skeleton, EmptyState } from '../components/ui.jsx';
import CellValue from '../components/CellValue.jsx';
import FilterPanel, { ActiveFilterChips, DebouncedInput, isActive } from '../components/FilterPanel.jsx';
import { usePopover } from '../components/MultiSelect.jsx';

const PAGE_SIZES = [10, 25, 50, 100];
const WIDE_ROLES = new Set(['location', 'area', 'road', 'goodwill', 'updatedBy']);

function parseJson(s) {
  try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

function useHiddenColumns(meta) {
  const storageKey = 'jvcrm.hidden.v2';
  const [hidden, setHidden] = useState(null);
  useEffect(() => {
    if (!meta) return;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch { /* ignore */ }
    // Default: hide only header-less columns that hold no data.
    setHidden(Array.isArray(saved) ? saved : meta.columns.filter((c) => c.role === 'notes').map((c) => c.key));
  }, [meta, storageKey]);
  const update = (next) => {
    setHidden(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
  };
  return [hidden || [], update];
}

function ColumnsMenu({ columns, hidden, onChange }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div className="relative" ref={ref}>
      <button className="btn-secondary" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Columns3 className="h-4 w-4" aria-hidden />Columns{hidden.length ? <span className="text-xs text-slate-400">({hidden.length} hidden)</span> : null}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 animate-fade-in rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-1 flex justify-between px-2 py-1 text-xs">
            <span className="font-medium text-slate-500">Show columns</span>
            <button className="font-medium text-brand-700" onClick={() => onChange([])}>Show all</button>
          </div>
          <ul className="max-h-80 overflow-auto scrollbar-thin">
            {columns.map((c) => (
              <li key={c.key}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" className="accent-brand-600" checked={!hidden.includes(c.key)} disabled={c.role === 'jvId'} onChange={(e) => onChange(e.target.checked ? hidden.filter((k) => k !== c.key) : [...hidden, c.key])} />
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.filled === 0 && <span className="text-[10px] uppercase text-slate-400">empty</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, pageSize, matched, onPage, onSize }) {
  const from = matched ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(page * pageSize, matched);
  const pages = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) pages.push(p);
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm sm:flex-row">
      <div className="flex items-center gap-2 text-slate-500">
        <span>Rows per page</span>
        <select className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm" value={pageSize} onChange={(e) => onSize(Number(e.target.value))} aria-label="Rows per page">
          {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="tabular-nums">{from}–{to} of {matched}</span>
      </div>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button className="btn-ghost px-2 py-1" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        {pages.map((p) => (
          <button key={p} onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined} className={`min-w-[2rem] rounded-md px-2 py-1 text-sm tabular-nums ${p === page ? 'bg-brand-600 font-medium text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{p}</button>
        ))}
        <button className="btn-ghost px-2 py-1" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
      </nav>
    </div>
  );
}

export default function Listings() {
  const { meta, canEdit } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const page = Number(params.get('page')) || 1;
  const size = PAGE_SIZES.includes(Number(params.get('size'))) ? Number(params.get('size')) : 25;
  const sort = params.get('sort') || '';
  const dir = params.get('dir') === 'desc' ? 'desc' : 'asc';
  const filters = useMemo(() => parseJson(params.get('f') || '{}'), [params]);
  const activeCount = Object.values(filters).filter(isActive).length;
  const [showFilters, setShowFilters] = useState(activeCount > 0);
  const [hidden, setHidden] = useHiddenColumns(meta);
  const isEmpty = meta?.totalRecords === 0;

  const update = (changes, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v === '' || v == null ? next.delete(k) : next.set(k, String(v)));
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  };
  const setFilters = (f) => update({ f: Object.keys(f).length ? JSON.stringify(f) : '' });

  const query = { q, page, pageSize: size, sort, dir, filters: activeCount ? JSON.stringify(filters) : undefined };
  const { data, error, loading } = useApi('/jv', query, { enabled: !!meta });

  const columns = useMemo(() => {
    if (!meta) return [];
    const idKey = meta.roles.jvId;
    return [...meta.columns].sort((a, b) => (b.key === idKey) - (a.key === idKey) || a.index - b.index);
  }, [meta]);
  const visible = columns.filter((c) => !hidden.includes(c.key));

  const toggleSort = (key) => {
    if (sort !== key) update({ sort: key, dir: 'asc' }, false);
    else if (dir === 'asc') update({ sort: key, dir: 'desc' }, false);
    else update({ sort: '', dir: '' }, false);
  };

  const exportHref = `/api/jv/export?${new URLSearchParams(Object.entries({ q, sort, dir, filters: query.filters }).filter(([, v]) => v))}`;

  if (!meta) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="JV Listings"
        subtitle={data ? (data.matched === data.total ? `${data.total} listings` : `${data.matched} of ${data.total} listings match`) : `${meta.totalRecords} listings`}
        actions={(
          <>
            <button className={showFilters || activeCount ? 'btn-primary' : 'btn-secondary'} onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden />Filters{activeCount ? <span className="rounded bg-white/20 px-1.5 text-xs">{activeCount}</span> : null}
            </button>
            <ColumnsMenu columns={columns} hidden={hidden} onChange={setHidden} />
            <a className="btn-secondary" href={exportHref} download><Download className="h-4 w-4" aria-hidden />Export CSV</a>
            {canEdit && <Link to="/listings/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden />New listing</Link>}
          </>
        )}
      />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <DebouncedInput
          className="input py-2.5 pl-10 pr-10 text-[15px]"
          placeholder="Search every field — JV ID, location, area, names, phone number, goodwill…"
          aria-label="Search listings"
          value={q}
          delay={250}
          onChange={(v) => update({ q: v.trim() })}
          autoFocus
        />
        {q && <button className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" onClick={() => update({ q: '' })} aria-label="Clear search"><X className="h-4 w-4" /></button>}
      </div>

      {showFilters && <FilterPanel meta={meta} filters={filters} onChange={setFilters} onClear={() => setFilters({})} />}
      <ActiveFilterChips meta={meta} filters={filters} onRemove={(k) => { const n = { ...filters }; delete n[k]; setFilters(n); }} onClear={() => setFilters({})} />

      {error && <div className="mb-4"><ErrorState error={error} /></div>}

      <Card bodyClass="p-0">
        <div className="relative max-h-[calc(100vh-17rem)] min-h-[16rem] overflow-auto scrollbar-thin">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {visible.map((c, i) => {
                  const active = sort === c.key;
                  const Icon = active ? (dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <th key={c.key} scope="col" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${i === 0 ? 'left-0 z-20 border-r' : ''}`}>
                      <button className={`inline-flex items-center gap-1.5 hover:text-slate-900 ${active ? 'text-slate-900' : ''}`} onClick={() => toggleSort(c.key)} title={`Sort by ${c.label}`}>
                        {c.label}<Icon className={`h-3.5 w-3.5 ${active ? 'text-brand-600' : 'text-slate-300'}`} aria-hidden />
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading && !data && Array.from({ length: 6 }, (_, r) => (
                <tr key={r}>{visible.map((c) => <td key={c.key} className="border-b border-slate-100 px-4 py-3.5"><Skeleton className="h-4 w-24" /></td>)}</tr>
              ))}
              {data?.items.map((rec) => {
                const href = `/listings/${encodeURIComponent(rec.id)}`;
                return (
                  <tr key={rec.id} className="group cursor-pointer" onClick={() => navigate(href, { state: { back: `/listings?${params}` } })}>
                    {visible.map((c, i) => (
                      <td key={c.key} className={`max-w-[22rem] ${WIDE_ROLES.has(c.role) ? 'min-w-[14rem]' : 'min-w-[7.5rem]'} border-b border-slate-100 px-4 py-3 align-top group-hover:bg-brand-50/40 ${i === 0 ? 'sticky left-0 z-[5] border-r bg-white font-medium text-slate-900' : 'text-slate-600'}`}>
                        {i === 0 ? (
                          <Link to={href} state={{ back: `/listings?${params}` }} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-brand-700">
                            {rec.values[c.key] || <span className="text-slate-400">Untitled</span>}
                            {rec.flags.length > 0 && <AlertCircle className="h-3.5 w-3.5 text-amber-500" aria-label="Has data notes" />}
                          </Link>
                        ) : <div className="line-clamp-2"><CellValue meta={meta} col={c} rec={rec} compact /></div>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data && data.items.length === 0 && (
            <EmptyState icon={SearchX} title={isEmpty ? 'No listings yet' : 'No listings match'} message={isEmpty ? 'Add a listing, or import a CSV file from Settings.' : 'Try a different search term or remove some filters.'} action={isEmpty ? (canEdit && <Link to="/listings/new" className="btn-primary">Add a listing</Link>) : <button className="btn-secondary" onClick={() => setParams({}, { replace: true })}>Clear search & filters</button>} />
          )}
          {loading && data && <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 animate-pulse bg-brand-500" />}
        </div>
        {data && data.matched > 0 && (
          <Pagination page={data.page} totalPages={data.totalPages} pageSize={data.pageSize} matched={data.matched} onPage={(p) => update({ page: p }, false)} onSize={(s) => update({ size: s })} />
        )}
      </Card>
    </div>
  );
}
