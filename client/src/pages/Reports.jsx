import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { useApi, useApp } from '../lib/AppContext.jsx';
import { BarList, Card, ErrorState, PageHeader, Skeleton } from '../components/ui.jsx';
import { fmtNum } from '../lib/format.js';
import { filterLink } from './Dashboard.jsx';

function Breakdowns() {
  const { data: s, error } = useApi('/jv/stats');
  const navigate = useNavigate();
  if (error) return <ErrorState error={error} />;
  if (!s) return <Skeleton className="h-96" />;
  const go = (key) => (i) => navigate(filterLink(key, i.value));
  const blocks = Object.values(s.breakdowns).filter(Boolean);
  return (
    <div className="space-y-6">
      {s.area && (
        <Card title="Land area summary" subtitle="Interpreted from the Area column (acres + guntas; 40 guntas = 1 acre). Original text is unchanged.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[['Total', s.area.totalAcres], ['Average', s.area.avgAcres], ['Largest', s.area.maxAcres], ['Interpreted', `${s.area.parsed} / ${s.area.of}`]].map(([k, val]) => (
              <div key={k} className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{k}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{typeof val === 'number' ? `${fmtNum(val)} ac` : val}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {blocks.map((b) => (
          <Card key={b.key} title={b.label} subtitle="Click a value to see matching listings">
            <BarList items={b.items} total={s.totalRecords} onSelect={go(b.key)} />
          </Card>
        ))}
        {s.byMonth.length > 0 && (
          <Card title="Listings by month" subtitle="From the month in each JV ID">
            <BarList items={s.byMonth.map((m) => ({ value: m.month, label: m.label, count: m.count }))} total={s.totalRecords} onSelect={go('_month')} />
          </Card>
        )}
      </div>
    </div>
  );
}

function Quality() {
  const { data: d, error } = useApi('/jv/quality');
  if (error) return <ErrorState error={error} />;
  if (!d) return <Skeleton className="h-96" />;
  const issues = [
    d.blankRowsSkipped.length && `${d.blankRowsSkipped.length} completely blank row(s) skipped: sheet row ${d.blankRowsSkipped.join(', ')}`,
    d.duplicateRowGroups.length && `${d.duplicateRowGroups.length} group(s) of exact duplicate rows: ${d.duplicateRowGroups.map((g) => g.join(' & ')).join('; ')}`,
    d.emptyColumns.length && `${d.emptyColumns.length} column(s) have no values yet: ${d.emptyColumns.map((c) => c.label).join(', ')}`,
    d.headerlessColumns.length && `Column ${d.headerlessColumns.map((c) => c.letter).join(', ')} has no header`,
    ...d.casing.map((c) => `${c.column}: same value written differently — ${c.variants.map((v) => `“${v}”`).join(' vs ')}`),
    ...d.placeholderValues.map((p) => `${p.column}: placeholder “${p.value}” used ${p.count}×`),
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <Card title="Field completeness" subtitle={`Share of ${d.totalRecords} listings with a real value (placeholders such as “TBD” or “-” excluded)`} bodyClass="p-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Col</th><th className="px-5 py-3">Field</th><th className="px-5 py-3">Filled</th><th className="px-5 py-3">Placeholders</th><th className="w-1/3 px-5 py-3">Completeness</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.completeness.map((c) => (
                <tr key={c.key}>
                  <td className="px-5 py-2.5 text-slate-400">{c.letter}</td>
                  <td className="px-5 py-2.5 font-medium text-slate-800">{c.label}</td>
                  <td className="px-5 py-2.5 tabular-nums text-slate-600">{c.filled} / {d.totalRecords}</td>
                  <td className="px-5 py-2.5 tabular-nums text-slate-600">{c.placeholders || '—'}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${c.percent >= 90 ? 'bg-brand-500' : c.percent >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${c.percent}%` }} /></div>
                      <span className="w-12 text-right tabular-nums text-slate-500">{c.percent}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Sheet-level observations" subtitle="Nothing is changed in the sheet — these are for the team to tidy up">
          {issues.length ? (
            <ul className="space-y-2.5 text-sm">{issues.map((i) => <li key={i} className="flex gap-2 text-slate-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />{i}</li>)}</ul>
          ) : <p className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="h-4 w-4 text-brand-600" />No sheet-level issues found.</p>}
        </Card>
        <Card title="Listings with data notes" subtitle={`${d.flagged.length} of ${d.totalRecords} listings`}>
          {d.flagged.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {d.flagged.map((f) => (
                <li key={f.id} className="py-2.5">
                  <Link to={`/listings/${encodeURIComponent(f.id)}`} className="link">{f.jvId || `Row ${f.row}`}</Link>
                  <span className="text-xs text-slate-400"> · row {f.row}</span>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-600">{f.flags.map((x) => <li key={x.msg}>{x.column ? `${x.column}: ` : ''}{x.msg}</li>)}</ul>
                </li>
              ))}
            </ul>
          ) : <p className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="h-4 w-4 text-brand-600" />No record-level issues.</p>}
        </Card>
      </div>
    </div>
  );
}

export default function Reports() {
  const { sheet } = useApp();
  const [tab, setTab] = useState('breakdowns');
  const tabs = [['breakdowns', 'Breakdowns'], ['quality', 'Data quality']];
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Analysis calculated live from the JV Listing sheet."
        actions={<a className="btn-secondary" href={`/api/jv/export${sheet ? `?sheet=${encodeURIComponent(sheet)}` : ''}`} download><Download className="h-4 w-4" aria-hidden />Export all (CSV)</a>}
      />
      <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-white p-1" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === k ? 'bg-ink-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}>{l}</button>
        ))}
      </div>
      {tab === 'breakdowns' ? <Breakdowns /> : <Quality />}
    </div>
  );
}
