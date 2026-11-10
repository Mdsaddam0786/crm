import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, errorInfo, setUnauthorizedHandler } from './api.js';

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [version, setVersion] = useState(0); // bump to make every page refetch
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.get('/auth/me').then((r) => setUser(r.data.user)).catch(() => setUser(null));
  }, []);

  const loadMeta = useCallback(async () => {
    try {
      const { data } = await api.get('/jv/metadata');
      setMeta(data);
      setMetaError(null);
    } catch (e) {
      setMetaError(errorInfo(e));
    }
  }, []);

  useEffect(() => { if (user) loadMeta(); }, [user, loadMeta, version]);

  const notify = useCallback((message, tone = 'success') => setToast({ message, tone, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  /** Call after any create/update/delete/import so lists, stats and filters refresh. */
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { setUser(null); setMeta(null); }
  }, []);

  const value = useMemo(() => ({
    user, setUser, logout, meta, metaError, version, reload, toast, notify,
    isAdmin: user?.role === 'admin',
    canEdit: user?.role === 'admin' || user?.role === 'editor',
  }), [user, logout, meta, metaError, version, reload, toast, notify]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);

/** Fetch helper that refetches whenever data changes (version bump). */
export function useApi(path, params, { enabled = true } = {}) {
  const { version } = useApp();
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const key = JSON.stringify(params || {});
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    api.get(path, { params })
      .then((r) => alive && setState({ data: r.data, error: null, loading: false }))
      .catch((e) => alive && setState({ data: null, error: errorInfo(e), loading: false }));
    return () => { alive = false; };
  }, [path, key, version, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
