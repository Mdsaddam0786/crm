import { ExternalLink, MapPin, Phone, Mail } from 'lucide-react';
import { displayValue, formatPhone, isPlaceholder, linkLabel, telLink } from '../lib/format.js';

/** Renders one field value with type-aware actions. `compact` is for table cells. */
export default function CellValue({ meta, col, rec, compact = false }) {
  const raw = rec.values[col.key] ?? '';
  const text = displayValue(meta, col, rec);
  const stop = (e) => e.stopPropagation();

  if (!raw) return <span className="text-slate-300">{compact ? '—' : <em className="not-italic text-slate-400">Not recorded</em>}</span>;
  if (isPlaceholder(raw)) return <span className="italic text-slate-400" title="Placeholder value">{raw}</span>;

  if (col.type === 'url' && /^https?:\/\//i.test(raw)) {
    const isMap = col.role === 'mapLink' || /maps/.test(raw);
    return (
      <a href={raw} target="_blank" rel="noopener noreferrer" onClick={stop} className="link" title={raw}>
        {isMap ? <MapPin className="h-3.5 w-3.5" aria-hidden /> : null}
        {compact ? (isMap ? 'Map' : 'Open') : linkLabel(raw)}
        <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
        <span className="sr-only">(opens in new tab)</span>
      </a>
    );
  }
  if (col.type === 'phone') {
    const tel = telLink(raw);
    return tel ? (
      <a href={tel} onClick={stop} className="link whitespace-nowrap tabular-nums" title={`Call ${raw}`}>
        <Phone className="h-3.5 w-3.5" aria-hidden />{formatPhone(raw)}
      </a>
    ) : <span>{raw}</span>;
  }
  if (col.type === 'email') {
    return <a href={`mailto:${raw}`} onClick={stop} className="link"><Mail className="h-3.5 w-3.5" aria-hidden />{raw}</a>;
  }
  if (text !== raw) return <span title={`Stored as "${raw}"`}>{text}</span>;
  return <span className={compact ? '' : 'whitespace-pre-wrap break-words'}>{raw}</span>;
}
