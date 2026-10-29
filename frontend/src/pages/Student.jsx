import { useState } from 'react';
import { api, today } from '../api';
import { Card, Field, Table, pctColor, useLoad } from '../ui';

export function Summary() {
  const { data: d, err } = useLoad(() => api('/student/summary'));
  if (err) return <p className="text-red-600">{err}</p>;
  if (!d) return <p>Loading…</p>;
  return (
    <div className="space-y-4">
      {d.overallWarning && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">Warning: your overall attendance is below {d.threshold}%.</div>}
      <Card><p className="text-sm text-slate-500">Overall attendance</p>
        <p className={`text-3xl font-bold ${pctColor(d.overallPct)}`}>{d.overallPct == null ? '—' : d.overallPct + '%'}</p></Card>
      <Card title="Subject-wise">
        <Table rows={d.subjects} cols={[['Subject', (r) => `${r.code} · ${r.name}`], ['Present', (r) => r.present], ['Absent', (r) => r.absent],
          ['Leave', (r) => r.leaveCount], ['%', (r) => <span className={pctColor(r.pct)}>{r.pct}%{r.warning ? ' ⚠' : ''}</span>]]} />
      </Card>
    </div>
  );
}

const col = (ds) => ds.some((x) => x.status === 'Absent') ? 'bg-red-100 text-red-700' : ds.some((x) => x.status === 'Leave') ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

export function Calendar() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const { data } = useLoad(() => api(`/student/calendar?month=${month}`), [month]);
  const [y, m] = month.split('-').map(Number), n = new Date(y, m, 0).getDate(), off = new Date(y, m - 1, 1).getDay();
  const by = {};
  (data?.days || []).forEach((x) => { (by[+x.date.slice(8)] ||= []).push(x); });
  return (
    <Card title="Monthly calendar" className="max-w-xl">
      <div className="max-w-xs mb-3"><Field label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {'SMTWTFS'.split('').map((c, i) => <div key={i} className="text-slate-400">{c}</div>)}
        {Array.from({ length: off }, (_, i) => <div key={'o' + i} />)}
        {Array.from({ length: n }, (_, i) => i + 1).map((day) => {
          const ds = by[day];
          return <div key={day} title={ds?.map((x) => `P${x.period} ${x.subject}: ${x.status}`).join('\n')} className={`py-2 rounded ${ds ? col(ds) : 'bg-slate-50 text-slate-400'}`}>{day}</div>;
        })}
      </div>
      <p className="text-xs text-slate-500 mt-3">Green = all present · Red = absent in at least one class · Amber = leave. Hover/long-press a day for details.</p>
    </Card>
  );
}
