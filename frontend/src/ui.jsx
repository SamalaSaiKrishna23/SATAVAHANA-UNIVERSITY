import { useEffect, useState, useCallback } from 'react';
export const Card = ({ title, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-200 p-4 ${className}`}>
    {title && <h3 className="font-semibold mb-3 text-slate-800">{title}</h3>}{children}
  </div>
);
const COLORS = { indigo: 'bg-indigo-600 hover:bg-indigo-700', slate: 'bg-slate-600 hover:bg-slate-700',
  amber: 'bg-amber-600 hover:bg-amber-700', red: 'bg-red-600 hover:bg-red-700' };
export const Btn = ({ color = 'indigo', className = '', ...p }) => (
  <button className={`px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${COLORS[color]} ${className}`} {...p} />
);
const inp = 'mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 bg-white';
export const Field = ({ label, ...p }) => <label className="block text-sm text-slate-600">{label}<input className={inp} {...p} /></label>;
export const Sel = ({ label, children, ...p }) => <label className="block text-sm text-slate-600">{label}<select className={inp} {...p}>{children}</select></label>;
export const Table = ({ cols, rows }) => (
  <div className="overflow-x-auto"><table className="w-full text-sm">
    <thead><tr className="text-left text-slate-500 border-b">{cols.map(([h]) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
    <tbody>
      {rows.map((r, i) => <tr key={i} className="border-b last:border-0">{cols.map(([h, f]) => <td key={h} className="py-2 pr-4">{f(r)}</td>)}</tr>)}
      {!rows.length && <tr><td className="py-3 text-slate-400" colSpan={cols.length}>No data</td></tr>}
    </tbody></table></div>
);
export const pctColor = (p) => (p == null ? 'text-slate-400' : p < 75 ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold');
export const fail = (e) => alert(e.details?.join('\n') || e.message);
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null), [err, setErr] = useState('');
  const reload = useCallback(() => { fn().then(setData).catch((e) => setErr(e.message)); }, deps); // eslint-disable-line
  useEffect(() => { reload(); }, [reload]);
  return { data, err, reload };
}
// fields: [{k,label,type,opt,num,options:[[value,label]]}]
export function AddForm({ fields, onSubmit, label = 'Add' }) {
  const [f, setF] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    const out = {};
    fields.forEach(({ k, type, num }) => { const v = f[k]; if (v !== undefined && v !== '') out[k] = num || type === 'number' ? Number(v) : v; });
    try { await onSubmit(out); setF({}); } catch (x) { fail(x); }
  };
  return (
    <form onSubmit={submit} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end mb-4">
      {fields.map(({ k, label: l, options, type = 'text', opt }) => options
        ? <Sel key={k} label={l} required value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
            <option value="">Select</option>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</Sel>
        : <Field key={k} label={l} type={type} required={!opt} value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
      <Btn>{label}</Btn>
    </form>
  );
}
