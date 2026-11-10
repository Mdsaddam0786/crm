import { CheckCircle2, ExternalLink, KeyRound, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useApi, useApp } from '../lib/AppContext.jsx';
import { Badge, Card, PageHeader, Skeleton } from '../components/ui.jsx';
import { MODE_LABELS, timeAgo } from '../lib/format.js';

function Row({ k, children }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-slate-500">{k}</dt>
      <dd className="text-sm font-medium text-slate-800 sm:text-right">{children}</dd>
    </div>
  );
}

export default function Settings() {
  const { user, isAdmin, refresh, refreshing, logout } = useApp();
  const { data: s } = useApi('/source/status');

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" subtitle="Data source, connection health and your account." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card
            title="Google Sheets connection"
            subtitle="The JV Listing sheet is the single source of truth. The CRM only reads it."
            action={isAdmin && <button className="btn-secondary py-1.5" onClick={refresh} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh now</button>}
          >
            {!s ? <Skeleton className="h-48" /> : (
              <>
                <div className={`mb-4 flex items-start gap-3 rounded-lg p-4 ${s.lastError ? 'bg-red-50' : 'bg-brand-50'}`}>
                  {s.lastError ? <XCircle className="mt-0.5 h-5 w-5 text-red-600" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 text-brand-600" />}
                  <div className="text-sm">
                    <p className={`font-semibold ${s.lastError ? 'text-red-800' : 'text-brand-800'}`}>{s.lastError ? 'Last sync failed' : 'Connected and reading live data'}</p>
                    <p className={s.lastError ? 'text-red-700' : 'text-brand-700'}>{s.lastError ? `${s.lastError.message} ${s.lastError.hint || ''}` : `Last synced ${timeAgo(s.syncedAt)} in ${s.fetchMs} ms.`}</p>
                  </div>
                </div>
                <dl className="divide-y divide-slate-100">
                  <Row k="Spreadsheet">{s.title || '—'} <a className="link ml-2" href={s.spreadsheetUrl} target="_blank" rel="noopener noreferrer">Open<ExternalLink className="h-3 w-3" /></a></Row>
                  <Row k="Spreadsheet ID"><code className="break-all rounded bg-slate-100 px-1.5 py-0.5 text-xs">{s.spreadsheetId}</code></Row>
                  <Row k="Access method">{MODE_LABELS[s.mode] || s.mode || '—'}</Row>
                  <Row k="Worksheet tabs">{s.tabs.map((t) => <Badge key={t.gid} className="ml-1">{t.name}: {t.records} records · {t.columns} cols</Badge>)}</Row>
                  <Row k="Last synced">{s.syncedAt ? new Date(s.syncedAt).toLocaleString() : 'never'}</Row>
                  <Row k="Auto-refresh">Every {Math.round(s.cacheTtlSeconds / 60)} min (on next request)</Row>
                  {isAdmin && s.serviceAccountEmail && <Row k="Service account"><code className="break-all text-xs">{s.serviceAccountEmail}</code></Row>}
                </dl>
                {s.mode === 'public_csv' && isAdmin && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <p className="font-semibold">Recommended: switch to a service account</p>
                    <p className="mt-1">The sheet is currently readable by anyone who has its link, which is how the CRM reads it today. For private company data, restrict the sheet’s sharing and connect a read-only service account instead. The steps are in the README, under “Google access”.</p>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Your account">
            <dl className="divide-y divide-slate-100">
              <Row k="Username">{user.username}</Row>
              <Row k="Role"><Badge tone={isAdmin ? 'brand' : 'slate'} className="capitalize">{user.role}</Badge></Row>
            </dl>
            <p className="mt-3 text-xs text-slate-500">{isAdmin ? 'Admins can force a data refresh.' : 'Viewers can search and open all listings.'} Accounts are managed by the server administrator.</p>
            <button className="btn-secondary mt-4 w-full" onClick={logout}>Sign out</button>
          </Card>
          <Card title="Data & security">
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />Read-only: the CRM never edits, deletes or overwrites anything in the sheet.</li>
              <li className="flex gap-2"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />Google credentials stay on the server and are never sent to the browser.</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />Every page and API call requires a signed-in employee account.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
