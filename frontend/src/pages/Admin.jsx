import { useState } from 'react';
import { api } from '../api';
import { Card, Btn, Table, AddForm, pctColor, useLoad, fail } from '../ui';

export function Dashboard() {
  const { data: d, err } = useLoad(() => api('/admin/dashboard'));
  if (err) return <p className="text-red-600">{err}</p>;
  if (!d) return <p>Loading…</p>;
  const t = d.totals, daily = d.trends.daily;
  const pts = daily.map((x, i) => `${daily.length > 1 ? (i * 300) / (daily.length - 1) : 150},${100 - x.pct}`).join(' ');
  const exportCsv = async () => {
    const b = await api('/admin/export/attendance');
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'attendance.csv'; a.click();
  };
  const stat = (l, v) => <Card key={l}><p className="text-sm text-slate-500">{l}</p><p className="text-2xl font-bold">{v}</p></Card>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stat('Students', t.students)}{stat('Faculty', t.faculty)}
        {stat('Overall attendance', t.overallPct == null ? '—' : t.overallPct + '%')}{stat('Below 75%', d.belowThreshold.length)}
      </div>
      <Card title="Department-wise">
        <Table rows={d.byDept} cols={[['Dept', (r) => r.code], ['Students', (r) => r.students], ['Faculty', (r) => r.faculty],
          ['Attendance', (r) => r.attendancePct == null ? '—' : (
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 bg-slate-100 rounded"><div className="h-2 rounded bg-indigo-500" style={{ width: r.attendancePct + '%' }} /></div>
              <span className={pctColor(r.attendancePct)}>{r.attendancePct}%</span>
            </div>)]]} />
      </Card>
      <Card title="Daily attendance % (last 30 days)">
        {daily.length ? <svg viewBox="0 0 300 100" preserveAspectRatio="none" className="w-full h-32"><polyline fill="none" stroke="#4f46e5" strokeWidth="2" points={pts} /></svg>
          : <p className="text-sm text-slate-400">No data</p>}
      </Card>
      <Card title="Students below 75%">
        <Table rows={d.belowThreshold} cols={[['ID', (r) => r.userId], ['Name', (r) => r.name], ['Dept', (r) => r.department],
          ['Year/Sec', (r) => `${r.year}-${r.section}`], ['%', (r) => <span className={pctColor(r.pct)}>{r.pct}%</span>]]} />
      </Card>
      <Card title="Faculty who haven't marked attendance today">
        <Table rows={d.facultyNotMarkedToday} cols={[['ID', (r) => r.userId], ['Name', (r) => r.name]]} />
      </Card>
      <Btn onClick={exportCsv}>Export attendance CSV</Btn>
    </div>
  );
}

export function People({ kind }) {
  const isS = kind === 'students';
  const { data: rows, err, reload } = useLoad(() => api('/admin/' + kind), [kind]);
  const run = async (fn) => { try { await fn(); reload(); } catch (e) { fail(e); } };
  return (
    <Card title={isS ? 'Students' : 'Faculty'}>
      <p className="text-xs text-slate-500 mb-3">To add a new {isS ? 'student' : 'faculty member'}, go to Setup.</p>
      {err && <p className="text-red-600">{err}</p>}
      <Table rows={rows || []} cols={[
        [isS ? 'Roll No' : 'Faculty ID', (r) => r.userId], ['Name', (r) => r.name], ['Dept', (r) => r.department],
        ...(isS ? [['Yr-Sec', (r) => `${r.year}-${r.section}`]] : [['Designation', (r) => r.designation || '—']]),
        ['Status', (r) => (r.isActive ? 'Active' : 'Inactive')],
        ['Actions', (r) => (
          <div className="flex gap-1">
            <Btn color="slate" onClick={() => run(async () => { const x = await api(`/admin/users/${r.userPk}/reset-password`, { method: 'POST' }); alert('New password: ' + x.newPassword); })}>Reset</Btn>
            <Btn color="amber" onClick={() => run(() => api(`/admin/users/${r.userPk}/status`, { method: 'PATCH', body: { isActive: !r.isActive } }))}>{r.isActive ? 'Deactivate' : 'Activate'}</Btn>
            <Btn color="red" onClick={() => confirm('Delete permanently?') && run(() => api(`/admin/users/${r.userPk}`, { method: 'DELETE' }))}>Delete</Btn>
          </div>)],
      ]} />
    </Card>
  );
}

const SECTIONS = [['departments', 'Departments & Subjects'], ['student', 'Add student'], ['faculty', 'Add faculty'], ['assign', 'Assign faculty']];

export function Setup() {
  const [sec, setSec] = useState('departments'), [selId, setSelId] = useState(null);
  const D = useLoad(() => api('/admin/departments')), S = useLoad(() => api('/admin/subjects')),
    F = useLoad(() => api('/admin/faculty')), A = useLoad(() => api('/admin/assignments'));
  const all = () => [D, S, F, A].forEach((x) => x.reload());
  const add = (path) => async (f) => { await api(path, { method: 'POST', body: f }); all(); };
  const del = (path, after) => async () => { if (!confirm('Delete?')) return; try { await api(path, { method: 'DELETE' }); after?.(); all(); } catch (e) { fail(e); } };
  const X = (path) => (r) => <Btn color="red" onClick={del(`${path}/${r.id}`)}>Delete</Btn>;
  const d = D.data || [], s = S.data || [], f = F.data || [], a = A.data || [];
  const sel = d.find((x) => x.id === selId), subs = s.filter((x) => x.departmentId === selId);
  const deptOptions = d.map((x) => [x.id, x.code]);
  const created = (r) => { alert(`Created ${r.userId}\nInitial password: ${r.initialPassword}\n(shown only once)`); all(); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map(([k, n]) => (
          <button key={k} onClick={() => setSec(k)} className={`px-3 py-2 rounded-lg text-sm border ${sec === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>{n}</button>
        ))}
      </div>

      {sec === 'departments' && (
        <>
          <Card title="Departments">
            <AddForm label="Add department" onSubmit={add('/admin/departments')} fields={[{ k: 'code', label: 'Code (e.g. CSE)' }, { k: 'name', label: 'Name' }]} />
            <p className="text-xs text-slate-500 mb-2">Click a department to see its subjects.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {d.map((x) => (
                <button key={x.id} onClick={() => setSelId(selId === x.id ? null : x.id)}
                  className={`text-left rounded-lg border px-3 py-2 ${selId === x.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                  <span className="block font-semibold text-slate-800">{x.code}</span>
                  <span className="block text-xs text-slate-500 truncate">{x.name}</span>
                  <span className="block text-xs text-indigo-600 mt-1">{s.filter((y) => y.departmentId === x.id).length} subjects</span>
                </button>
              ))}
              {!d.length && <p className="text-sm text-slate-400">No departments yet</p>}
            </div>
          </Card>
          {sel && (
            <Card title={`${sel.code} — subjects`}>
              <AddForm label="Add subject" onSubmit={(v) => add('/admin/subjects')({ ...v, departmentId: sel.id })}
                fields={[{ k: 'code', label: 'Code' }, { k: 'name', label: 'Name' }, { k: 'year', label: 'Year', type: 'number' }, { k: 'semester', label: 'Semester', type: 'number' }]} />
              <Table rows={subs} cols={[['Code', (r) => r.code], ['Name', (r) => r.name], ['Yr/Sem', (r) => `${r.year}/${r.semester}`], ['', X('/admin/subjects')]]} />
              <div className="mt-4 pt-3 border-t">
                <Btn color="red" onClick={del(`/admin/departments/${sel.id}`, () => setSelId(null))}>Delete {sel.code} department</Btn>
              </div>
            </Card>
          )}
        </>
      )}

      {sec === 'student' && (
        <Card title="Add student">
          <p className="text-xs text-slate-500 mb-3">The roll no you enter becomes the student's login ID.</p>
          <AddForm label="Add student" onSubmit={async (v) => created(await api('/admin/students', { method: 'POST', body: v }))} fields={[
            { k: 'name', label: 'Name' }, { k: 'rollNo', label: 'Roll no (login ID)' },
            { k: 'email', label: 'Email (optional)', type: 'email', opt: true },
            { k: 'departmentId', label: 'Department', num: true, options: deptOptions },
            { k: 'year', label: 'Year (1-4)', type: 'number' }, { k: 'semester', label: 'Semester (1-8)', type: 'number' }, { k: 'section', label: 'Section' }]} />
        </Card>
      )}

      {sec === 'faculty' && (
        <Card title="Add faculty">
          <p className="text-xs text-slate-500 mb-3">The faculty ID you enter becomes the faculty member's login ID.</p>
          <AddForm label="Add faculty" onSubmit={async (v) => created(await api('/admin/faculty', { method: 'POST', body: v }))} fields={[
            { k: 'name', label: 'Name' }, { k: 'facultyId', label: 'Faculty ID (login ID)' },
            { k: 'email', label: 'Email (optional)', type: 'email', opt: true },
            { k: 'departmentId', label: 'Department', num: true, options: deptOptions },
            { k: 'designation', label: 'Designation', opt: true }]} />
        </Card>
      )}

      {sec === 'assign' && (
        <Card title="Assign faculty to subject & section">
          <AddForm label="Assign" onSubmit={add('/admin/assignments')} fields={[
            { k: 'facultyId', label: 'Faculty', num: true, options: f.map((x) => [x.id, `${x.name} (${x.userId})`]) },
            { k: 'subjectId', label: 'Subject', num: true, options: s.map((x) => [x.id, `${x.code} · ${x.department} Y${x.year}`]) },
            { k: 'section', label: 'Section' }]} />
          <Table rows={a} cols={[['Faculty', (r) => r.facultyName], ['Subject', (r) => r.subjectCode], ['Class', (r) => `${r.department} Y${r.year}-${r.section}`], ['', X('/admin/assignments')]]} />
        </Card>
      )}
    </div>
  );
}
