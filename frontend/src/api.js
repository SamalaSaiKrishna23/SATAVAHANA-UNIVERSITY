export async function api(path, { method = 'GET', body } = {}) {
  const t = localStorage.getItem('token');
  const r = await fetch(
  `${import.meta.env.VITE_API_URL}/api${path}`, 
  {
    method,
    headers: { 'Content-Type': 'application/json', ...(t && { Authorization: `Bearer ${t}` }) },
    body: body && JSON.stringify(body),
  });
  if (r.headers.get('content-type')?.includes('text/csv')) return r.blob();
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/auth/login') { localStorage.removeItem('token'); location.reload(); }
  if (!r.ok) throw Object.assign(new Error(d.error || 'Request failed'), { details: d.details });
  return d;
}
export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
