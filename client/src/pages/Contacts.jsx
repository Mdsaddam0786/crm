import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Phone, Search, Users } from 'lucide-react';
import { useApi, useApp } from '../lib/AppContext.jsx';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui.jsx';
import { digits, formatPhone, telLink, whatsappLink } from '../lib/format.js';

export default function Contacts() {
  const { meta } = useApp();
  const { data, error, loading } = useApi('/jv/contacts');
  const [q, setQ] = useState('');
  const label = (role) => meta?.columns.find((c) => c.key === meta.roles[role])?.label;

  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!data || !t) return data?.items || [];
    return data.items.filter((c) => c.names.some((n) => n.toLowerCase().includes(t)) || (digits(t) && c.phoneDigits?.includes(digits(t))) || c.listings.some((l) => `${l.jvId} ${l.location}`.toLowerCase().includes(t)));
  }, [data, q]);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Contacts"
        subtitle={meta ? `People and numbers recorded against listings, grouped by ${label('phone') || 'phone'}${label('updatedBy') ? ` with names from ${label('updatedBy')}` : ''}.` : ''}
      />
      {error && <ErrorState error={error} />}
      {loading && !data && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}</div>}
      {data && (
        <>
          <div className="relative mb-4 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input className="input pl-9" placeholder="Search name, number or JV ID…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search contacts" />
          </div>
          {items.length === 0 ? <Card><EmptyState icon={Users} title="No contacts found" /></Card> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((c) => {
                const tel = telLink(c.phone);
                const wa = whatsappLink(c.phone, meta?.phoneCountryCode);
                const names = c.names.filter((n) => n !== '-');
                return (
                  <div key={c.key} className="card flex flex-col p-5">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-sm font-semibold uppercase text-violet-700">{(names[0] || '#').slice(0, 2)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">{names.length ? names.join(' / ') : <span className="font-normal italic text-slate-400">No name recorded</span>}</p>
                        <p className="text-sm tabular-nums text-slate-500">{c.phone ? formatPhone(c.phone) : 'No number recorded'}</p>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">{c.listings.length} listing{c.listings.length > 1 ? 's' : ''}</span>
                    </div>
                    <ul className="mt-4 flex-1 space-y-1.5">
                      {c.listings.map((l) => (
                        <li key={l.id}>
                          <Link to={`/listings/${encodeURIComponent(l.id)}`} className="block rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                            <span className="font-medium text-brand-700">{l.jvId || 'Untitled'}</span>
                            {l.location && <span className="text-slate-500"> · {l.location}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {(tel || wa) && (
                      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                        {tel && <a href={tel} className="btn-secondary flex-1 py-1.5"><Phone className="h-4 w-4" aria-hidden />Call</a>}
                        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1 py-1.5"><MessageCircle className="h-4 w-4" aria-hidden />WhatsApp</a>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
