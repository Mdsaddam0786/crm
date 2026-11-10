import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, Contact, Ruler, Star, Table2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi, useApp } from '../lib/AppContext.jsx';
import { BarList, Card, ErrorState, LoadingCards, PageHeader, StatCard } from '../components/ui.jsx';
import CellValue from '../components/CellValue.jsx';
import { fmtNum, timeAgo } from '../lib/format.js';

export const filterLink = (key, value) => `/listings?f=${encodeURIComponent(JSON.stringify({ [key]: { op: 'in', values: [value] } }))}`;

function MonthCard({ byMonth, total }) {
  const navigate = useNavigate();
  if (byMonth.length === 0) return <p className="py-6 text-center text-sm text-slate-500">JV IDs don't contain a recognisable month.</p>;
  if (byMonth.length === 1) {
    const m = byMonth[0];
    return (
      <button className="flex w-full items-center gap-4 rounded-lg p-2 text-left hover:bg-slate-50" onClick={() => navigate(filterLink('_month', m.month))}>
        <span className="rounded-lg bg-sky-50 p-3 text-sky-700"><CalendarDays className="h-6 w-6" aria-hidden /></span>
        <div>
          <p className="text-2xl font-semibold text-slate-900 tabular-nums">{m.count} <span className="text-base font-normal text-slate-500">listing{m.count > 1 ? 's' : ''}</span></p>
          <p className="text-sm text-slate-500">All {total === m.count ? '' : `${m.count} of ${total} `}listings were logged in {m.label}. A trend chart appears once more months exist.</p>
        </div>
      </button>
    );
  }
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={byMonth} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid vertical={false} stroke="#eef2f6" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" />
          <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} formatter={(v) => [v, 'Listings']} />
          <Bar dataKey="count" fill="#279884" radius={[4, 4, 0, 0]} maxBarSize={48} onClick={(d) => navigate(filterLink('_month', d.month))} className="cursor-pointer" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Dashboard() {
  const { meta, sync } = useApp();
  const navigate = useNavigate();
  const { data, error } = useApi('/jv/stats');

  if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  const s = data;
  const go = (key) => (item) => navigate(filterLink(key, item.value));
  const cols = meta?.columns || [];
  const colFor = (role) => meta && cols.find((c) => c.key === meta.roles[role]);
  const recentCols = ['jvId', 'location', 'area', 'feasibility', 'rating', 'sharing'].map(colFor).filter(Boolean);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        subtitle={s ? `Overview of ${s.totalRecords} JV listings in “${s.tab.name}” · synced ${timeAgo(sync?.syncedAt)}` : 'Loading live data from Google Sheets…'}
        actions={<Link to="/listings" className="btn-primary">Browse listings <ArrowRight className="h-4 w-4" aria-hidden /></Link>}
      />

      {!s || !meta ? <LoadingCards /> : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Table2} label="Total JV listings" value={s.totalRecords} hint={`${s.totalColumns} fields per record`} />
            {s.area && <StatCard icon={Ruler} tone="blue" label="Total land offered" value={`${fmtNum(s.area.totalAcres)} ac`} hint={`Interpreted from ${s.area.parsed} of ${s.area.of} Area values · avg ${fmtNum(s.area.avgAcres)} ac`} />}
            {s.rating && <StatCard icon={Star} tone="amber" label="Average rating" value={fmtNum(s.rating.average, 1)} hint={`From ${s.rating.rated} of ${s.rating.of} rated listings`} />}
            {s.contacts != null && <StatCard icon={Contact} tone="violet" label="Unique contacts" value={s.contacts} hint="Distinct numbers in the REA NO column" />}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card title="Listings by month" subtitle="Derived from the month in each JV ID" className="xl:col-span-2"><MonthCard byMonth={s.byMonth} total={s.totalRecords} /></Card>
            {s.breakdowns.feasibility && (
              <Card title={`By ${s.breakdowns.feasibility.label}`} subtitle="Click a name to filter listings">
                <BarList items={s.breakdowns.feasibility.items} total={s.totalRecords} onSelect={go(s.breakdowns.feasibility.key)} />
              </Card>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {s.breakdowns.rating && <Card title="Rating distribution" subtitle={`Values in ${s.breakdowns.rating.label}`}><BarList items={s.breakdowns.rating.items} total={s.totalRecords} onSelect={go(s.breakdowns.rating.key)} /></Card>}
            {s.breakdowns.sharing && <Card title="Sharing ratio" subtitle="Landowner : developer split as entered"><BarList items={s.breakdowns.sharing.items} total={s.totalRecords} onSelect={go(s.breakdowns.sharing.key)} /></Card>}
            {s.pipeline.length > 0 && (
              <Card title="Deal progress" subtitle="How many listings have each stage recorded">
                <ul className="space-y-4">
                  {s.pipeline.map((p) => (
                    <li key={p.key}>
                      <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-slate-700">{p.label}</span><span className="tabular-nums text-slate-500">{p.filled} / {p.total}</span></div>
                      <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-sky-500" style={{ width: `${p.percent}%` }} /></div>
                      {p.values.length > 0 && <p className="mt-1 text-xs text-slate-500">{p.values.map((v) => `${v.label} (${v.count})`).join(' · ')}</p>}
                    </li>
                  ))}
                </ul>
                {s.pipeline.every((p) => p.filled === 0) && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">None of these columns have values in the sheet yet. They will update automatically once the team fills them in.</p>}
              </Card>
            )}
            {s.breakdowns.updatedBy && (
              <Card title={`By ${s.breakdowns.updatedBy.label}`} subtitle="Click a name to filter listings"><BarList items={s.breakdowns.updatedBy.items} total={s.totalRecords} onSelect={go(s.breakdowns.updatedBy.key)} /></Card>
            )}
            {s.breakdowns.status && s.breakdowns.status.items.some((i) => i.value !== '__blank__') && (
              <Card title="Status"><BarList items={s.breakdowns.status.items} total={s.totalRecords} onSelect={go(s.breakdowns.status.key)} /></Card>
            )}
          </div>

          <Card title="Latest listings" subtitle="Most recent JV IDs" className="mt-6" bodyClass="p-0" action={<Link to="/listings" className="link text-sm">View all</Link>}>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>{recentCols.map((c) => <th key={c.key} className="whitespace-nowrap px-5 py-3">{c.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {s.recent.map((r) => (
                    <tr key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/listings/${encodeURIComponent(r.id)}`)}>
                      {recentCols.map((c) => (
                        <td key={c.key} className={`max-w-[18rem] truncate px-5 py-3 ${c.role === 'jvId' ? 'font-medium text-slate-900' : 'text-slate-600'}`}>
                          {c.role === 'jvId' ? <Link to={`/listings/${encodeURIComponent(r.id)}`} className="hover:text-brand-700">{r.values[c.key] || `Row ${r.row}`}</Link> : <CellValue meta={meta} col={c} rec={r} compact />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
