const PLACEHOLDERS = new Set(['-', '--', '—', 'tbd', 'na', 'n/a', 'not provided', 'null', '?']);

export const isPlaceholder = (v) => PLACEHOLDERS.has(String(v ?? '').trim().toLowerCase());
export const digits = (v) => String(v ?? '').replace(/\D/g, '');

/** Display text for a value. Reverses the spreadsheet time-format quirk on imported sharing ratios. */
export function displayValue(meta, col, rec) {
  const raw = rec.values[col.key] ?? '';
  if (col.key === meta.roles.sharing && rec.derived.sharingDisplay) return rec.derived.sharingDisplay;
  return raw;
}

export function whatsappLink(phone, cc = '91') {
  let d = digits(phone);
  if (d.length === 10) d = cc + d;
  return d.length >= 11 ? `https://wa.me/${d}` : null;
}

export function telLink(phone) {
  const d = String(phone ?? '').replace(/[^\d+]/g, '');
  return d.length >= 6 ? `tel:${d}` : null;
}

export function formatPhone(phone) {
  const d = digits(phone);
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : phone;
}

export function linkLabel(url) {
  try {
    const u = new URL(url);
    if (/maps\.app\.goo\.gl|google\.[a-z.]+\/maps|goo\.gl\/maps/.test(u.host + u.pathname)) return 'Open in Google Maps';
    if (/docs\.google\.com|drive\.google\.com/.test(u.host)) return 'Open document';
    return u.host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function timeAgo(iso) {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleString();
}

export const fmtNum = (n, d = 2) => (n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d }));
