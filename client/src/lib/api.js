import axios from 'axios';

export const api = axios.create({ baseURL: '/api', withCredentials: true, timeout: 45000 });

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.startsWith('/auth/')) onUnauthorized();
    return Promise.reject(err);
  },
);

export function errorInfo(err) {
  if (!err) return null;
  const d = err.response?.data;
  if (!err.response) return { message: 'Cannot reach the CRM server. Check that it is running and your connection is online.' };
  return { message: d?.error || err.message, hint: d?.hint, code: d?.code, status: err.response.status };
}
