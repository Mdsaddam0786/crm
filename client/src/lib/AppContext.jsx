import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, errorInfo, setUnauthorizedHandler } from './api.js';

const Ctx = createContext(null);
const SHEET_KEY = 'jvcrm.sheet';

function readSheet() {
  try { return localStorage.getItem(SHEET_KEY) || ''; } catch { return ''; }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  const [sheet, setSheetState] = useState(readSheet);
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [version, setVersion] = useState(0); // bump to make pages refetch
  const [sync, setSync] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => setUser(null));
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const { data } = await api.get('/jv/metadata', { params: { sheet: sheet || undefined } });
      setMeta(data);
      setSync(data.sync);
      setMetaError(null);
    } catch (e) {
      // A saved tab that no longer exists: fall back to the default tab.
      if (e.response?.status === 404 && sheet) { setSheet(''); return; }
      setMetaError(errorInfo(e));
    }
  }, [sheet]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (user) loadMeta(); }, [user, loadMeta, version]);

  const setSheet = useCallback((name) => {
    try { name ? localStorage.setItem(SHEET_KEY, name) : localStorage.removeItem(SHEET_KEY); } catch { /* storage unavailable */ }
    setSheetState(name);
  }, []);

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data } = await api.post('/jv/refresh');
      setSync(data);
      setVersion((v) => v + 1);
      notify('Data refreshed from Google Sheets.');
    } catch (e) {
      const info = errorInfo(e);
      if (e.response?.data?.tabs) setSync(e.response.data);
      notify(`Refresh failed: ${e.response?.data?.lastError?.message || info.message}`, 'error');
    } finally {
      setRefreshing(false);
    }
  }, [notify]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { setUser(null); setMeta(null); }
  }, []);

  const value = useMemo(() => ({
    user, setUser, logout, sheet, setSheet, meta, metaError, reloadMeta: loadMeta, version, sync, setSync, refresh, refreshing, toast, notify,
    isAdmin: user?.role === 'admin',
  }), [user, logout, sheet, setSheet, meta, metaError, loadMeta, version, sync, refresh, refreshing, toast, notify]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);

/** Fetch helper bound to the current sheet + data version. */
export function useApi(path, params, { enabled = true } = {}) {
  const { sheet, version } = useApp();
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const key = JSON.stringify(params || {});
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    api.get(path, { params: { ...(params || {}), sheet: sheet || undefined } })
      .then((r) => alive && setState({ data: r.data, error: null, loading: false }))
      .catch((e) => alive && setState({ data: null, error: errorInfo(e), loading: false }));
    return () => { alive = false; };
  }, [path, key, sheet, version, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
