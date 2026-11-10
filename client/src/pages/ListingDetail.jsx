import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Copy, ExternalLink, FileSpreadsheet, MapPin, MessageCircle, Phone, Star, UserRound } from 'lucide-react';
import { useApi, useApp } from '../lib/AppContext.jsx';
import { Badge, Card, ErrorState, Skeleton } from '../components/ui.jsx';
import CellValue from '../components/CellValue.jsx';
import { fmtNum, formatPhone, telLink, whatsappLink } from '../lib/format.js';

function Field({ meta, col, rec, onCopy }) {
  const raw = rec.values[col.key];
  const notes = rec.flags.filter((f) => f.field === col.key);
  let derived = null;
  if (col.key === meta.roles.area && rec.derived.areaAcres != null) derived = `≈ ${fmtNum(rec.derived.areaAcres, 3)} acres (interpreted; 1 acre = 40 guntas)`;
  return (
    <div className="group py-3 sm:grid sm:grid-cols-5 sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 sm:col-span-2 sm:pt-0.5">
        {col.label}
        <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-300">col {col.letter}</span>
      </dt>
      <dd className="mt-1 text-sm text-slate-900 sm:col-span-3 sm:mt-0">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1"><CellValue meta={meta} col={col} rec={rec} /></div>
          {raw && <button className="rounded p-1 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 focus:opacity-100 group-hover:opacity-100" onClick={() => onCopy(raw, col.label)} aria-label={`Copy ${col.label}`}><Copy className="h-3.5 w-3.5" /></button>}
        </div>
        {derived && <p className="mt-0.5 text-xs text-slate-500">{derived}</p>}
        {notes.map((n) => <p key={n.msg} className="mt-1 flex items-center gap-1 text-xs text-amber-700"><AlertCircle className="h-3 w-3" aria-hidden />{n.msg}</p>)}
      </dd>
    </div>
  );
}

export default function ListingDetail() {
  const { id } = useParams();
  const { meta, notify } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, error, loading } = useApi(`/jv/${encodeURIComponent(id)}`);
  const back = location.state?.back || '/listings';

  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); notify(`${label} copied`); } catch { notify('Copy is not available in this browser', 'error'); }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Link to={back} className="link text-sm"><ArrowLeft className="h-4 w-4" />Back to listings</Link>
        <ErrorState error={error} />
      </div>
    );
  }
  if (loading || !data || !meta) return <div className="space-y-4"><Skeleton className="h-6 w-32" /><Skeleton className="h-28 w-full" /><Skeleton className="h-96 w-full" /></div>;

  const rec = data.record;
  const r = meta.roles;
  const col = (role) => meta.columns.find((c) => c.key === r[role]);
  const v = (role) => (r[role] ? rec.values[r[role]] : '');
  const phone = v('phone');
  const tel = telLink(phone);
  const wa = whatsappLink(phone, meta.phoneCountryCode);
  const map = v('mapLink');
  const used = new Set();
  const sections = meta.sections
    .map((s) => ({ ...s, cols: s.roles.map(col).filter(Boolean) }))
    .filter((s) => s.cols.length);
  sections.forEach((s) => s.cols.forEach((c) => used.add(c.key)));
  const other = meta.columns.filter((c) => !used.has(c.key));
  const go = (targetId) => navigate(`/listings/${encodeURIComponent(targetId)}`, { state: location.state, replace: true });

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to={back} className="link text-sm"><ArrowLeft className="h-4 w-4" aria-hidden />Back to listings</Link>
        <div className="flex gap-1">
          <button className="btn-secondary px-2.5 py-1.5" disabled={!data.prevId} onClick={() => go(data.prevId)} aria-label="Previous listing" title="Previous listing"><ChevronLeft className="h-4 w-4" /></button>
          <button className="btn-secondary px-2.5 py-1.5" disabled={!data.nextId} onClick={() => go(data.nextId)} aria-label="Next listing" title="Next listing"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="card mb-6 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-brand-500 to-sky-500" />
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">JV listing{rec.derived.monthLabel ? ` · ${rec.derived.monthLabel}` : ''}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{rec.jvId || `Row ${rec.row}`}</h1>
            {v('location') && <p className="mt-1.5 flex items-center gap-1.5 text-slate-600"><MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />{v('location')}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {v('rating') && <Badge tone="amber"><Star className="h-3 w-3" aria-hidden />Rating {v('rating')}</Badge>}
              {v('area') && <Badge tone="blue">{v('area')}</Badge>}
              {v('feasibility') && <Badge><UserRound className="h-3 w-3" aria-hidden />Feasibility: {v('feasibility')}</Badge>}
              {v('status') ? <Badge tone="brand">{v('status')}</Badge> : r.status && <Badge>Status not recorded</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {tel && <a href={tel} className="btn-primary"><Phone className="h-4 w-4" aria-hidden />Call {formatPhone(phone)}</a>}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-secondary"><MessageCircle className="h-4 w-4" aria-hidden />WhatsApp<ExternalLink className="h-3 w-3 opacity-60" aria-hidden /></a>}
            {/^https?:\/\//.test(map) && <a href={map} target="_blank" rel="noopener noreferrer" className="btn-secondary"><MapPin className="h-4 w-4" aria-hidden />Map<ExternalLink className="h-3 w-3 opacity-60" aria-hidden /></a>}
            <a href={data.rowUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary" title="Open this row in the original Google Sheet"><FileSpreadsheet className="h-4 w-4" aria-hidden />Open in Sheet<ExternalLink className="h-3 w-3 opacity-60" aria-hidden /></a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {sections.map((s) => (
            <Card key={s.id} title={s.title} bodyClass="px-5 py-1">
              <dl className="divide-y divide-slate-100">{s.cols.map((c) => <Field key={c.key} meta={meta} col={c} rec={rec} onCopy={copy} />)}</dl>
            </Card>
          ))}
          {other.length > 0 && (
            <Card title="Other details" subtitle="Columns without a recognised category" bodyClass="px-5 py-1">
              <dl className="divide-y divide-slate-100">{other.map((c) => <Field key={c.key} meta={meta} col={c} rec={rec} onCopy={copy} />)}</dl>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Record source">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Worksheet</dt><dd className="font-medium text-slate-800">{meta.tab.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Sheet row</dt><dd className="font-medium tabular-nums text-slate-800">{rec.row}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Fields filled</dt><dd className="font-medium tabular-nums text-slate-800">{meta.columns.filter((c) => rec.values[c.key]).length} / {meta.columns.length}</dd></div>
            </dl>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Values are shown exactly as stored in Google Sheets. To change this record, edit the sheet, then refresh the CRM.</p>
          </Card>
          {rec.flags.length > 0 && (
            <Card title="Data notes" subtitle="Detected automatically — the sheet is unchanged">
              <ul className="space-y-2 text-sm">
                {rec.flags.map((f) => <li key={f.msg} className="flex gap-2 text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />{f.msg}</li>)}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
