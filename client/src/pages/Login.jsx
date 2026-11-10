import { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { api, errorInfo } from '../lib/api.js';
import { useApp } from '../lib/AppContext.jsx';
import { Spinner } from '../components/ui.jsx';

export default function Login() {
  const { setUser } = useApp();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      setUser(data.user);
    } catch (err) {
      setError(errorInfo(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink-950 lg:block">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500">
              <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden><path d="M5 23l6-12 5 8 3-4 5 8" stroke="white" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="text-lg font-semibold text-white">JV CRM</span>
          </div>
          <div>
            <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight text-white">Every joint-venture land listing, searchable in seconds.</h1>
            <p className="mt-4 max-w-md text-slate-400">Live from the company JV Listing sheet — search, filter and open any record without digging through the spreadsheet.</p>
          </div>
          <p className="flex items-center gap-2 text-sm text-slate-500"><ShieldCheck className="h-4 w-4" aria-hidden /> Private company data · Authorised employees only</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8">
            <span className="mb-4 inline-flex rounded-lg bg-brand-50 p-2.5 text-brand-700"><Lock className="h-5 w-5" aria-hidden /></span>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Use the account provided by your administrator.</p>
          </div>
          <label className="label" htmlFor="username">Username</label>
          <input id="username" className="input mb-4" autoComplete="username" autoFocus required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
          <button className="btn-primary mt-6 w-full py-2.5" disabled={busy}>{busy ? <Spinner className="h-4 w-4 text-white" /> : null}Sign in</button>
        </form>
      </div>
    </div>
  );
}
