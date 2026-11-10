import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

export default function MultiSelect({ id, options, value = [], onChange, placeholder = 'Any' }) {
  const { open, setOpen, ref } = usePopover();
  const [search, setSearch] = useState('');
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const shown = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));
  const summary = value.length === 0 ? placeholder : value.length === 1 ? options.find((o) => o.value === value[0])?.label || '1 selected' : `${value.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button id={id} type="button" className={`input flex items-center justify-between text-left ${value.length ? 'border-brand-300 bg-brand-50/40' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        <span className={`truncate ${value.length ? 'text-slate-800' : 'text-slate-400'}`}>{summary}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[14rem] animate-fade-in rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {options.length > 8 && <input className="input mb-1" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />}
          <ul className="max-h-64 overflow-auto scrollbar-thin" role="listbox" aria-multiselectable="true">
            {shown.map((o) => {
              const on = value.includes(o.value);
              return (
                <li key={o.value}>
                  <button type="button" role="option" aria-selected={on} onClick={() => toggle(o.value)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`}>{on && <Check className="h-3 w-3" />}</span>
                    <span className={`flex-1 truncate ${o.value === '__blank__' ? 'italic text-slate-500' : ''}`} title={o.variants?.length > 1 ? `Spellings: ${o.variants.join(', ')}` : o.label}>{o.label}</span>
                    <span className="text-xs tabular-nums text-slate-400">{o.count}</span>
                  </button>
                </li>
              );
            })}
            {!shown.length && <li className="px-2 py-3 text-center text-sm text-slate-400">No matches</li>}
          </ul>
          {value.length > 0 && <button type="button" className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-slate-500 hover:bg-slate-50" onClick={() => onChange([])}>Clear selection</button>}
        </div>
      )}
    </div>
  );
}
