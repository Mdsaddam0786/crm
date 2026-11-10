import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { api, errorInfo } from '../lib/api.js';
import { useApi, useApp } from '../lib/AppContext.jsx';
import { Card, ErrorState, PageHeader, Skeleton, Spinner } from '../components/ui.jsx';

function FieldInput({ col, value, onChange, suggestions }) {
  const id = `field-${col.key}`;
  const common = {
    id,
    name: col.key,
    value,
    onChange: (e) => onChange(col.key, e.target.value),
    className: 'input',
    placeholder: col.placeholder || '',
    required: col.required,
    maxLength: col.key === 'notes' ? 5000 : 1000,
  };
  return (
    <div className={col.multiline ? 'sm:col-span-2' : ''}>
      <label className="label" htmlFor={id}>{col.label}{col.required && <span className="text-red-500"> *</span>}</label>
      {col.multiline ? (
        <textarea {...common} rows={col.key === 'notes' ? 4 : 2} />
      ) : (
        <>
          <input
            {...common}
            type={col.type === 'url' ? 'url' : col.type === 'phone' ? 'tel' : 'text'}
            inputMode={col.type === 'phone' ? 'tel' : undefined}
            placeholder={col.type === 'url' ? 'https://maps.app.goo.gl/…' : common.placeholder}
            list={suggestions?.length ? `${id}-list` : undefined}
            autoComplete="off"
          />
          {suggestions?.length > 0 && (
            <datalist id={`${id}-list`}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
          )}
        </>
      )}
    </div>
  );
}

export default function ListingForm() {
  const { id } = useParams();
  const isNew = !id;
  const { meta, reload, notify } = useApp();
  const navigate = useNavigate();
  const existing = useApi(`/jv/${encodeURIComponent(id || '')}`, null, { enabled: !isNew });
  const [values, setValues] = useState(null);
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Initialise the form once metadata (and the record, when editing) is available.
  useEffect(() => {
    if (!meta || values) return;
    if (isNew) {
      const v = Object.fromEntries(meta.columns.map((c) => [c.key, '']));
      v[meta.roles.jvId] = meta.nextJvId || '';
      setValues(v);
      setInitial(v);
    } else if (existing.data) {
      const v = Object.fromEntries(meta.columns.map((c) => [c.key, existing.data.record.values[c.key] || '']));
      setValues(v);
      setInitial(v);
    }
  }, [meta, existing.data, isNew, values]);

  const dirty = useMemo(() => values && initial && meta?.columns.some((c) => values[c.key] !== initial[c.key]), [values, initial, meta]);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!isNew && existing.error) return <ErrorState error={existing.error} />;
  if (!meta || !values) return <div className="space-y-4"><Skeleton className="h-8 w-56" /><Skeleton className="h-96 w-full" /></div>;

  const set = (key, v) => setValues((s) => ({ ...s, [key]: v }));
  const used = new Set();
  const sections = meta.sections.map((s) => {
    const cols = s.roles.map((r) => meta.columns.find((c) => c.role === r)).filter(Boolean);
    cols.forEach((c) => used.add(c.key));
    return { ...s, cols };
  }).filter((s) => s.cols.length);
  const rest = meta.columns.filter((c) => !used.has(c.key));
  if (rest.length) sections.push({ id: 'other', title: 'Other details', cols: rest });
  const suggestionsFor = (key) => (meta.facets[key] || []).filter((f) => f.value !== '__blank__').map((f) => f.label).slice(0, 50);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const { data } = await api.post('/jv', { values });
        notify(`Listing ${values[meta.roles.jvId]} created.`);
        reload();
        navigate(`/listings/${encodeURIComponent(data.id)}`, { replace: true });
      } else {
        await api.put(`/jv/${encodeURIComponent(id)}`, { values, expectedUpdatedAt: existing.data.record.updatedAt });
        notify('Changes saved.');
        reload();
        navigate(`/listings/${encodeURIComponent(id)}`, { replace: true });
      }
    } catch (err) {
      setError(errorInfo(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  }

  const back = isNew ? '/listings' : `/listings/${encodeURIComponent(id)}`;
  return (
    <form onSubmit={submit} className="animate-fade-in pb-24">
      <Link to={back} className="link mb-4 text-sm"><ArrowLeft className="h-4 w-4" aria-hidden />{isNew ? 'Back to listings' : 'Back to listing'}</Link>
      <PageHeader
        title={isNew ? 'New JV listing' : `Edit ${initial[meta.roles.jvId] || 'listing'}`}
        subtitle={isNew ? 'The JV ID is suggested automatically (next number in sequence); you can change it.' : 'Changes are saved for everyone immediately.'}
      />
      {error && <div className="mb-6"><ErrorState error={error} /></div>}
      <div className="space-y-6">
        {sections.map((s) => (
          <Card key={s.id} title={s.title}>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              {s.cols.map((c) => <FieldInput key={c.key} col={c} value={values[c.key]} onChange={set} suggestions={c.type === 'text' ? suggestionsFor(c.key) : null} />)}
            </div>
          </Card>
        ))}
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-[1600px] items-center justify-end gap-3 sm:px-2">
          {dirty && <span className="mr-auto text-xs text-slate-500">Unsaved changes</span>}
          <Link to={back} className="btn-secondary">Cancel</Link>
          <button className="btn-primary" disabled={saving || (!isNew && !dirty)}>
            {saving ? <Spinner className="h-4 w-4 text-white" /> : <Save className="h-4 w-4" aria-hidden />}
            {isNew ? 'Create listing' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  );
}
