import { useState, useEffect } from 'react';
import { api } from './api';
import { COLLEGE } from './config';
import { Card, Btn, Field, fail } from './ui';
import { Dashboard, People, Setup } from './pages/Admin';
import { Mark, Reports } from './pages/Faculty';
import { Summary, Calendar } from './pages/Student';

function Header() {
  return (
    <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
      <img src={COLLEGE.logo} alt="College logo" style={{ width: "60px", height: "60px", objectFit: "contain",display: "block" }} />
      <div>
        <h1 className="text-lg font-bold text-slate-800 leading-tight">{COLLEGE.name}</h1>
        <p className="text-xs text-slate-500">{COLLEGE.tagline}</p>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 text-sm px-4 py-5">
      <div className="grid gap-3 md:grid-cols-3">
        <div><p className="font-semibold text-white">{COLLEGE.name}</p><p>{COLLEGE.address}</p></div>
        <div><p>Email: {COLLEGE.email}</p><p>Phone: {COLLEGE.phone}</p></div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <a href={COLLEGE.website} target="_blank" rel="noreferrer" className="underline">Website</a>
          {(COLLEGE.links || []).map((l) => <a key={l.label} href={l.url} target="_blank" rel="noreferrer" className="underline">{l.label}</a>)}
        </div>
      </div>
      <p className="text-xs text-slate-500 mt-3">© {new Date().getFullYear()} {COLLEGE.name}. All rights reserved.</p>
    </footer>
  );
}

function ChangePassword({ forced, onDone }) {
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const submit = async (e) => {
    e.preventDefault();
    try { await api('/auth/change-password', { method: 'POST', body: f }); alert('Password updated'); setF({ currentPassword: '', newPassword: '' }); onDone?.(); } catch (x) { fail(x); }
  };
  return (
    <Card title={forced ? 'Set a new password to continue' : 'Change password'} className="max-w-md">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Current password" type="password" required value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} />
        <Field label="New password (min 8 characters)" type="password" minLength={8} required value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />
        <Btn>Update password</Btn>
      </form>
    </Card>
  );
}

function Login({ onLogin }) {
  const [f, setF] = useState({ userId: '', password: '' }), [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { const r = await api('/auth/login', { method: 'POST', body: f }); localStorage.setItem('token', r.token); onLogin(r.user); } catch (x) { setErr(x.message); }
  };
  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <Header />
      <div className="flex-1 grid place-items-center p-4">
        <form onSubmit={submit} className="bg-white rounded-2xl shadow p-6 w-full max-w-sm space-y-4">
          <h2 className="text-xl font-bold text-slate-800">Sign in</h2>
          <Field label="User ID" required value={f.userId} onChange={(e) => setF({ ...f, userId: e.target.value })} />
          <Field label="Password" type="password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Btn className="w-full">Sign in</Btn>
        </form>
      </div>
      <Footer />
    </div>
  );
}

const NAV = {
  admin: [['Dashboard', <Dashboard key="d" />], ['Students', <People key="s" kind="students" />], ['Faculty', <People key="f" kind="faculty" />], ['Setup', <Setup key="u" />]],
  faculty: [['Mark attendance', <Mark key="m" />], ['Reports', <Reports key="r" />]],
  student: [['My attendance', <Summary key="a" />], ['Calendar', <Calendar key="c" />]],
};

export default function App() {
  const [user, setUser] = useState(null), [ready, setReady] = useState(false), [tab, setTab] = useState(0);
  useEffect(() => { document.title = COLLEGE.name; }, []);
  useEffect(() => {
    if (!localStorage.getItem('token')) return setReady(true);
    api('/auth/me').then(setUser).catch(() => localStorage.removeItem('token')).finally(() => setReady(true));
  }, []);
  if (!ready) return null;
  if (!user) return <Login onLogin={setUser} />;
  const logout = () => { localStorage.removeItem('token'); setUser(null); setTab(0); };
  const pages = [...NAV[user.role], ['Password', <ChangePassword key="p" />]];
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <div className="flex-1 md:flex">
        <aside className="md:w-56 bg-slate-900 text-slate-200 p-3 flex md:block gap-1 overflow-x-auto">
          {!user.mustChangePassword && pages.map(([n], i) => (
            <button key={n} onClick={() => setTab(i)} className={`block md:w-full text-left px-3 py-2 rounded-lg text-sm whitespace-nowrap ${tab === i ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}>{n}</button>
          ))}
        </aside>
        <main className="flex-1 p-4 min-w-0">
          <div className="flex justify-between items-start mb-4">
            <div><h2 className="font-semibold text-slate-800">{user.name}</h2><p className="text-xs text-slate-500">{user.userId} · {user.role}</p></div>
            <Btn color="slate" onClick={logout}>Logout</Btn>
          </div>
          {user.mustChangePassword
            ? <ChangePassword forced onDone={() => setUser({ ...user, mustChangePassword: false })} />
            : pages[tab][1]}
        </main>
      </div>
      <Footer />
    </div>
  );
}
