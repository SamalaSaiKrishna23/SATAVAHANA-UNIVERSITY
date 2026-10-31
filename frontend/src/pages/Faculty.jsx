import { useState } from 'react';
import { api, today } from '../api';
import { Card, Btn, Field, Sel, Table, pctColor, useLoad, fail } from '../ui';

const SC = { Present: 'bg-emerald-600 text-white border-emerald-600', Absent: 'bg-red-600 text-white border-red-600', Leave: 'bg-amber-500 text-white border-amber-500' };
const label = (c) => `${c.subjectCode} · ${c.department} Y${c.year}-${c.section}`;

export function Mark() {
  const { data: classes } = useLoad(() => api('/faculty/classes'));
  const [cid, setCid] = useState(''), [date, setDate] = useState(today()), [period, setPeriod] = useState(1), [rows, setRows] = useState(null), [view, setView] = useState(null);
  const load = async (e) => {
    setView(null);
    e.preventDefault();
    try { const r = await api(`/faculty/roster?assignmentId=${cid}&date=${date}&period=${period}`); setRows(r.map((x) => ({ ...x, status: x.status || 'Present' }))); } catch (x) { fail(x); }
  };
  const save = async () => {
    try {
      await api('/faculty/attendance', { method: 'POST', body: { assignmentId: +cid, date, period: +period, records: rows.map((r) => ({ studentId: r.studentId, status: r.status })) } });
      alert('Attendance saved');
    } catch (x) { fail(x); }
  };
  const showMarked = async () => {
    try {
      const r = await api(`/faculty/roster?assignmentId=${cid}&date=${date}&period=${period}`);
      setView(r.filter((x) => x.status));
    } catch (x) { fail(x); }
  };
  const set = (id, status) => setRows(rows.map((x) => (x.studentId === id ? { ...x, status } : x)));
  return (
    <div className="space-y-4">
      <Card title="Mark attendance">
        <form onSubmit={load} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
          <Sel label="Class" required value={cid} onChange={(e) => { setCid(e.target.value); setRows(null); setView(null); }}>
            <option value="">Select</option>{(classes || []).map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
          </Sel>
          <Field label="Date" type="date" max={today()} required value={date} onChange={(e) => { setDate(e.target.value); setRows(null); setView(null); }} />
          <Field label="Period" type="number" min="1" max="10" required value={period} onChange={(e) => { setPeriod(e.target.value); setRows(null); setView(null); }} />
          <Btn>Load students</Btn>
        </form>
      </Card>
      {rows && (
        <Card title={`${rows.length} students (P = Present, A = Absent, L = Leave)`}>
          <div className="flex gap-2 mb-3">
            <Btn color="slate" onClick={() => setRows(rows.map((r) => ({ ...r, status: 'Present' })))}>Mark all present</Btn>
            <Btn onClick={save}>Save</Btn>
            <Btn color="amber" onClick={showMarked}>View attendance</Btn>
          </div>
          {rows.map((r) => (
            <div key={r.studentId} className="flex items-center justify-between py-2 border-b">
              <div><p className="text-sm font-medium">{r.name}</p><p className="text-xs text-slate-500">{r.userId}</p></div>
              <div className="flex gap-1">
                {['Present', 'Absent', 'Leave'].map((s) => (
                  <button key={s} onClick={() => set(r.studentId, s)} className={`w-8 h-8 rounded border text-xs ${r.status === s ? SC[s] : 'bg-white text-slate-500'}`}>{s[0]}</button>
                ))}
              </div>
            </div>
          ))}
        </Card>
      )}
      {view && (
        <Card title={`Marked attendance · ${date} · Period ${period}`}>
          {view.length === 0 ? <p className="text-sm text-slate-500">Attendance has not been saved for this class, date and period yet.</p> : (
            <>
              <p className="text-sm mb-3">
                <span className="text-emerald-600 font-medium">Present: {view.filter((x) => x.status === 'Present').length}</span> ·{' '}
                <span className="text-red-600 font-medium">Absent: {view.filter((x) => x.status === 'Absent').length}</span> ·{' '}
                <span className="text-amber-600 font-medium">Leave: {view.filter((x) => x.status === 'Leave').length}</span>
              </p>
              <Table rows={view} cols={[['Roll No', (r) => r.userId], ['Name', (r) => r.name],
                ['Status', (r) => <span className={`px-2 py-0.5 rounded text-xs text-white ${SC[r.status].split(' ')[0]}`}>{r.status}</span>]]} />
            </>
          )}
          <div className="mt-3"><Btn color="slate" onClick={() => setView(null)}>Hide</Btn></div>
        </Card>
      )}
    </div>
  );
}

export function Reports() {
  const { data: classes } = useLoad(() => api('/faculty/classes'));
  const [cid, setCid] = useState(''), [low, setLow] = useState(false), [rows, setRows] = useState(null);
  const load = async (id, l) => { if (!id) return setRows(null); try { setRows(await api(`/faculty/report?assignmentId=${id}${l ? '&lowOnly=1' : ''}`)); } catch (x) { fail(x); } };
  return (
    <Card title="Class report">
      <div className="grid grid-cols-2 gap-2 items-end mb-3 max-w-lg">
        <Sel label="Class" value={cid} onChange={(e) => { setCid(e.target.value); load(e.target.value, low); }}>
          <option value="">Select</option>{(classes || []).map((c) => <option key={c.id} value={c.id}>{label(c)}</option>)}
        </Sel>
        <label className="text-sm flex items-center gap-2 pb-2"><input type="checkbox" checked={low} onChange={(e) => { setLow(e.target.checked); load(cid, e.target.checked); }} /> Below 75% only</label>
      </div>
      {rows && <Table rows={rows} cols={[['ID', (r) => r.userId], ['Name', (r) => r.name], ['P', (r) => r.present], ['A', (r) => r.absent], ['L', (r) => r.leaveCount],
        ['Total', (r) => r.total], ['%', (r) => <span className={pctColor(r.pct)}>{r.pct == null ? '—' : r.pct + '%'}</span>]]} />}
    </Card>
  );
}
