import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, BarChart3, CheckCircle2, LayoutDashboard, LogOut, Menu, RefreshCw, Search, Settings, Sheet, Table2, Users, X, XCircle } from 'lucide-react';
import { useApp } from '../lib/AppContext.jsx';
import { timeAgo } from '../lib/format.js';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/listings', label: 'JV Listings', icon: Table2 },
  { to: '/contacts', label: 'Contacts', icon: Users, needsRole: 'phone' },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 py-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 shadow-inner">
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden><path d="M5 23l6-12 5 8 3-4 5 8" stroke="white" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">JV CRM</p>
        <p className="text-[11px] text-slate-400">Joint Venture Listings</p>
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }) {
  const { meta, sync } = useApp();
  const items = NAV.filter((n) => !n.needsRole || meta?.roles?.[n.needsRole]);
  return (
    <div className="flex h-full flex-col bg-ink-950">
      <Brand />
      <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Main">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
          >
            <Icon className="h-[18px] w-[18px]" aria-hidden />
            {label}
            {to === '/listings' && meta && <span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] tabular-nums text-slate-300">{meta.totalRecords}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Sheet className="h-3.5 w-3.5 text-brand-400" aria-hidden />
          <span className="truncate font-medium">{meta?.spreadsheetTitle || 'Google Sheet'}</span>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-slate-400">
          {sync?.lastError ? <XCircle className="h-3 w-3 text-red-400" aria-hidden /> : <CheckCircle2 className="h-3 w-3 text-brand-400" aria-hidden />}
          {sync?.lastError ? 'Sync problem' : `Synced ${timeAgo(sync?.syncedAt)}`}
        </p>
        <p className="mt-1 text-slate-500">Read-only · Sheet is source of truth</p>
      </div>
    </div>
  );
}

function TopSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  useEffect(() => { if (location.pathname !== '/listings') setQ(''); }, [location.pathname]);
  if (location.pathname === '/listings') return <div className="flex-1" />;
  return (
    <form
      className="relative max-w-md flex-1"
      role="search"
      onSubmit={(e) => { e.preventDefault(); navigate(`/listings${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9" placeholder="Search JV ID, location, name, phone…" aria-label="Search all JV listings" />
    </form>
  );
}

export default function Layout() {
  const { user, logout, meta, sheet, setSheet, sync, refresh, refreshing, isAdmin, toast, metaError } = useApp();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block"><Sidebar /></aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 animate-fade-in">
            <button className="absolute right-3 top-5 rounded-md p-1 text-slate-400 hover:text-white" onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="btn-ghost -ml-2 p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <TopSearch />
          {meta?.tabs?.length > 1 && (
            <select className="input w-auto max-w-[11rem]" value={sheet || meta.tab.name} onChange={(e) => setSheet(e.target.value)} aria-label="Worksheet tab">
              {meta.tabs.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {isAdmin && (
            <button className="btn-secondary" onClick={refresh} disabled={refreshing} title="Re-read the Google Sheet now">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
              <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh data'}</span>
            </button>
          )}
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold uppercase text-brand-800" aria-hidden>{user.username.slice(0, 2)}</span>
            <div className="hidden text-xs leading-tight md:block">
              <p className="font-medium text-slate-800">{user.username}</p>
              <p className="capitalize text-slate-500">{user.role}</p>
            </div>
            <button className="btn-ghost p-2" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>

        {(sync?.lastError || metaError) && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:px-6" role="alert">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                <strong className="font-semibold">{sync?.lastError ? 'Could not refresh from Google Sheets.' : 'Could not load data.'}</strong>{' '}
                {(sync?.lastError || metaError).message}{' '}
                {sync?.lastError && sync?.syncedAt && <>Showing data last synced {timeAgo(sync.syncedAt)}. </>}
                {(sync?.lastError || metaError).hint}
              </p>
            </div>
          </div>
        )}

        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
      </div>

      {toast && (
        <div key={toast.id} className={`fixed bottom-5 right-5 z-50 flex max-w-sm animate-fade-in items-start gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${toast.tone === 'error' ? 'bg-red-600' : 'bg-ink-900'}`} role="status">
          {toast.tone === 'error' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
