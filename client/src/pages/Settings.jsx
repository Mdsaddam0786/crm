import { useRef, useState } from 'react';
import { CheckCircle2, Database, Download, FileUp, KeyRound, ShieldCheck, XCircle } from 'lucide-react';
import { api, errorInfo } from '../lib/api.js';
import { useApi, useApp } from '../lib/AppContext.jsx';
import { Badge, Card, ErrorState, PageHeader, Skeleton, Spinner } from '../components/ui.jsx';

const STORAGE_LABELS = {
  mongodb: 'MongoDB database',
  file: 'Local data file (single server)',
  static: 'Built-in data (JV_DATA, read-only)',
  none: 'Not configured',
};

function Row({ k, children }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-slate-500">{k}</dt>
      <dd className="text-sm font-medium text-slate-800 sm:text-right">{children}</dd>
    </div>
  );
}

function ImportCard() {
  const { reload, notify } = useApp();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('skip');
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun) {
    if (!file) return;
    if (file.size > 3.5 * 1024 * 1024) { setError({ message: 'File is too large (max 3.5 MB).' }); return; }
    setBusy(true);
    setError(null);
    try {
      const csv = await file.text();
      const { data } = await api.post('/jv/import', { csv, mode, dryRun });
      setPreview(data);
      if (!dryRun) {
        notify(`Import complete: ${data.created} created, ${data.updated} updated.`);
        reload();
        setFile(null);
        if (fileRef.current) fileRef.current.value = '';
      }
    } catch (e) {
      setError(errorInfo(e));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Import listings from CSV" subtitle="e.g. File → Download → CSV from a spreadsheet. Columns are matched by name; JV IDs already in the CRM are never duplicated.">
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="csv-file">CSV file</label>
          <input
            id="csv-file"
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setError(null); }}
          />
        </div>
        <fieldset>
          <legend className="label">When a JV ID already exists</legend>
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-6">
            <label className="flex items-center gap-2"><input type="radio" className="accent-brand-600" name="mode" checked={mode === 'skip'} onChange={() => { setMode('skip'); setPreview(null); }} />Keep the CRM version (skip)</label>
            <label className="flex items-center gap-2"><input type="radio" className="accent-brand-600" name="mode" checked={mode === 'update'} onChange={() => { setMode('update'); setPreview(null); }} />Overwrite with the file's values</label>
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={!file || busy} onClick={() => run(true)}>{busy && !preview ? <Spinner className="h-4 w-4" /> : null}Preview</button>
          <button className="btn-primary" disabled={!file || busy || !preview || !preview.dryRun} onClick={() => run(false)}>
            {busy && preview ? <Spinner className="h-4 w-4 text-white" /> : <FileUp className="h-4 w-4" aria-hidden />}Import
          </button>
        </div>
        {error && <ErrorState error={error} />}
        {preview && (
          <div className={`rounded-lg border p-4 text-sm ${preview.dryRun ? 'border-sky-200 bg-sky-50/60' : 'border-brand-200 bg-brand-50/60'}`}>
            <p className="font-semibold text-slate-900">{preview.dryRun ? 'Preview — nothing saved yet' : 'Imported'}</p>
            <p className="mt-1 text-slate-700">
              {preview.created} new · {preview.updated} {preview.dryRun ? 'to update' : 'updated'} · {preview.skipped} already exist (skipped){preview.blankRows ? ` · ${preview.blankRows} blank rows ignored` : ''}
            </p>
            <p className="mt-2 text-xs text-slate-600"><span className="font-medium">Column mapping:</span> {preview.mapping.map((m) => (m.column.toLowerCase() === m.field.toLowerCase() ? m.field : `${m.column} → ${m.field}`)).join(' · ')}</p>
            {preview.ignoredColumns.length > 0 && <p className="mt-1 text-xs text-amber-800">Ignored columns (no matching field): {preview.ignoredColumns.join(', ')}</p>}
            {preview.emptyHeaderData && <p className="mt-1 text-xs text-amber-800">A column without a header contains data and will be ignored.</p>}
            {preview.errors.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-red-700">{preview.errors.slice(0, 20).map((e) => <li key={e.line}>Line {e.line}: {e.message}</li>)}</ul>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Settings() {
  const { user, isAdmin, readOnly, logout } = useApp();
  const { data: s } = useApi('/system/status');

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" subtitle="Data storage, import/export and your account." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Data storage" subtitle="All listings are stored in the CRM's own database." action={<a className="btn-secondary py-1.5" href="/api/jv/export" download><Download className="h-4 w-4" aria-hidden />Export all (CSV)</a>}>
            {!s ? <Skeleton className="h-28" /> : (
              <>
                <div className={`mb-4 flex items-start gap-3 rounded-lg p-4 ${s.error ? 'bg-red-50' : 'bg-brand-50'}`}>
                  {s.error ? <XCircle className="mt-0.5 h-5 w-5 text-red-600" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 text-brand-600" />}
                  <div className="text-sm">
                    <p className={`font-semibold ${s.error ? 'text-red-800' : 'text-brand-800'}`}>{s.error ? 'Data unavailable' : s.storage === 'static' ? 'Built-in data loaded' : 'Database connected'}</p>
                    <p className={s.error ? 'text-red-700' : 'text-brand-700'}>{s.error ? `${s.error.message} ${s.error.hint || ''}` : `${s.records} listings stored.`}</p>
                  </div>
                </div>
                <dl className="divide-y divide-slate-100">
                  <Row k="Storage"><span className="inline-flex items-center gap-1.5"><Database className="h-4 w-4 text-slate-400" aria-hidden />{STORAGE_LABELS[s.storage] || s.storage}</span></Row>
                  {s.database && <Row k="Database name"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{s.database}</code></Row>}
                </dl>
                {s.storage === 'static' && s.records === 0 && (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">No listings loaded. Paste your listings CSV into the <code>JV_DATA</code> environment variable on Vercel and redeploy.</p>
                )}
                {s.storage === 'static' && s.records > 0 && (
                  <p className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">This deployment is read-only. To change listings, update the <code>JV_DATA</code> environment variable and redeploy — or set <code>MONGODB_URI</code> to enable adding and editing.</p>
                )}
                {s.storage === 'file' && isAdmin && (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Data is saved in a file on this computer (<code>data/listings.json</code>). Back it up regularly, or set <code>MONGODB_URI</code> to use a hosted database — required for Vercel.</p>
                )}
              </>
            )}
          </Card>
          {isAdmin && !readOnly && <ImportCard />}
        </div>

        <div className="space-y-6">
          <Card title="Your account">
            <dl className="divide-y divide-slate-100">
              <Row k="Username">{user.username}</Row>
              <Row k="Role"><Badge tone={isAdmin ? 'brand' : 'slate'} className="capitalize">{user.role}</Badge></Row>
            </dl>
            <ul className="mt-3 space-y-1 text-xs text-slate-500">
              <li><strong className="font-medium text-slate-700">Admin</strong> — add, edit, delete, import</li>
              <li><strong className="font-medium text-slate-700">Editor</strong> — add and edit listings</li>
              <li><strong className="font-medium text-slate-700">Viewer</strong> — search, view and export</li>
            </ul>
            <button className="btn-secondary mt-4 w-full" onClick={logout}>Sign out</button>
          </Card>
          <Card title="Security">
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />Every page and API call requires a signed-in employee account.</li>
              <li className="flex gap-2"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />Database credentials stay on the server and are never sent to the browser.</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />Each listing records who created and last changed it.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
