import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

const STATUSES = ['NEW', 'CLASSIFIED', 'PRIORITIZED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'CLOSED'];
const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];
const fmt = (t) => (t ? new Date(t).toLocaleString() : '-');
const label = (s) => s.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

const Priority = ({ p }) => (p ? <span className={`badge ${p}`}>{p}</span> : '-');
const Status = ({ s }) => <span className="status">{label(s)}</span>;

function Countdown({ deadline, stopped, violated }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!deadline) return <b>-</b>;
  if (stopped) return violated ? <b className="bad">Breached</b> : <b className="ok">Met</b>;
  const ms = new Date(deadline) - now;
  if (ms < 0) return <b className="bad">Overdue {Math.floor(-ms / 60000)} min</b>;
  const s = Math.floor(ms / 1000);
  return <b className={ms < 300000 ? 'warn' : 'ok'}>{Math.floor(s / 3600)}h {Math.floor((s % 3600) / 60)}m {s % 60}s</b>;
}

/* ---------------- login ---------------- */
const ROLES = [
  { key: 'EMPLOYEE', title: 'Employee', blurb: 'Report IT problems and track their progress.' },
  { key: 'TECHNICIAN', title: 'Technician', blurb: 'Investigate and resolve the incidents assigned to you.' },
  { key: 'ADMIN', title: 'Administrator', blurb: 'Manage users, SLA policies and technician assignment.' },
];

function Login({ onAuth }) {
  const [role, setRole] = useState(null);
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const choose = (r) => { setRole(r); setMode('login'); setErr(''); setF({ name: '', email: '', password: '' }); };
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      if (mode === 'register') await api('/api/auth/register', { method: 'POST', body: f });
      const r = await api('/api/auth/login', { method: 'POST', body: { email: f.email, password: f.password } });
      if (r.user.role !== role.key) throw new Error(`This account is not a ${role.title.toLowerCase()} account. Go back and choose the right user type.`);
      localStorage.setItem('token', r.token);
      localStorage.setItem('user', JSON.stringify(r.user));
      onAuth(r.user);
    } catch (x) { setErr(x.message); }
  };

  if (!role) {
    return (
      <div className="landing">
        <h1>I-ITSM Service Desk</h1>
        <p className="muted">Choose how you want to sign in</p>
        <div className="role-grid">
          {ROLES.map((r) => (
            <button key={r.key} className="role-card" onClick={() => choose(r)}><b>{r.title}</b><span>{r.blurb}</span></button>
          ))}
        </div>
      </div>
    );
  }
  const canRegister = role.key === 'EMPLOYEE';
  return (
    <form className="panel login" onSubmit={submit}>
      <h2>{role.title} {mode === 'login' ? 'sign in' : 'sign up'}</h2>
      {mode === 'register' && <label>Full name<input required value={f.name} onChange={set('name')} /></label>}
      <label>Email<input required type="email" value={f.email} onChange={set('email')} /></label>
      <label>Password<input required type="password" minLength={6} value={f.password} onChange={set('password')} /></label>
      {!canRegister && <p className="muted">{role.title} accounts are created by an administrator.</p>}
      {err && <div className="error">{err}</div>}
      <div className="actions">
        <button className="btn">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        {canRegister && (
          <button type="button" className="btn alt" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
            {mode === 'login' ? 'Sign up instead' : 'I already have an account'}
          </button>
        )}
        <button type="button" className="btn alt" onClick={() => setRole(null)}>Change user type</button>
      </div>
    </form>
  );
}

/* ---------------- report incident ---------------- */
function ReportForm({ meta, onDone }) {
  const [f, setF] = useState({ title: '', description: '', categoryId: '', serviceId: '', affectedUsers: 1, impact: 3, urgency: 3 });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const body = { ...f, categoryId: +f.categoryId, serviceId: +f.serviceId, affectedUsers: +f.affectedUsers, impact: +f.impact, urgency: +f.urgency };
      const i = await api('/api/incidents', { method: 'POST', body });
      onDone(i.id);
    } catch (x) { setErr(x.message); }
  };
  const scale = (k) => (
    <select value={f[k]} onChange={set(k)}>
      {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
  return (
    <form className="panel" onSubmit={submit}>
      <h2>Report an incident</h2>
      <label>Title<input required maxLength={200} value={f.title} onChange={set('title')} /></label>
      <label>What is happening?<textarea required maxLength={2000} value={f.description} onChange={set('description')} /></label>
      <div className="row">
        <label>Category<select required value={f.categoryId} onChange={set('categoryId')}><option value="">Choose…</option>{meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Affected IT service<select required value={f.serviceId} onChange={set('serviceId')}><option value="">Choose…</option>{meta.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label>People affected<input type="number" min={1} value={f.affectedUsers} onChange={set('affectedUsers')} /></label>
        <label>Impact (1 low – 5 severe){scale('impact')}</label>
        <label>Urgency (1 low – 5 immediate){scale('urgency')}</label>
      </div>
      <p className="muted">Priority is calculated by the system from impact, urgency and the service's business criticality.</p>
      {err && <div className="error">{err}</div>}
      <button className="btn">Submit incident</button>
    </form>
  );
}

/* ---------------- incident list with filters ---------------- */
function IncidentList({ user, meta, techs, onOpen, version }) {
  const [f, setF] = useState({ q: '', status: '', priority: '', categoryId: '', serviceId: '', technicianId: '', from: '' });
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  useEffect(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    api('/api/incidents?' + p).then(setRows).catch((e) => setErr(e.message));
  }, [f, version]);
  return (
    <div className="panel">
      <h2>{user.role === 'EMPLOYEE' ? 'My incidents' : user.role === 'TECHNICIAN' ? 'Assigned incidents' : 'All incidents'}</h2>
      <div className="row">
        <label>Search<input placeholder="Title or description" value={f.q} onChange={set('q')} /></label>
        <label>Status<select value={f.status} onChange={set('status')}><option value="">Any</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></label>
        <label>Priority<select value={f.priority} onChange={set('priority')}><option value="">Any</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label>Category<select value={f.categoryId} onChange={set('categoryId')}><option value="">Any</option>{meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Service<select value={f.serviceId} onChange={set('serviceId')}><option value="">Any</option>{meta.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        {user.role === 'ADMIN' && <label>Technician<select value={f.technicianId} onChange={set('technicianId')}><option value="">Any</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
        <label>Reported since<input type="date" value={f.from} onChange={set('from')} /></label>
      </div>
      {err && <div className="error">{err}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Title</th><th>Priority</th><th>Status</th><th>Service</th><th>Technician</th><th>Resolve by</th></tr></thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className="click" onClick={() => onOpen(i.id)}>
                <td>{i.id}</td><td>{i.title}</td><td><Priority p={i.priority} /></td><td><Status s={i.status} /></td>
                <td>{i.service}</td><td>{i.technician || '-'}</td>
                <td><Countdown deadline={i.resolutionDeadline} stopped={!!i.resolvedAt} violated={i.resolutionViolated} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted">No incidents match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- incident detail ---------------- */
function Detail({ id, user, onBack, onChanged }) {
  const [i, setI] = useState(null);
  const [hist, setHist] = useState([]);
  const [techs, setTechs] = useState([]);
  const [techId, setTechId] = useState('');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try {
      setI(await api('/api/incidents/' + id));
      setHist(await api(`/api/incidents/${id}/history`));
      if (user.role === 'ADMIN') setTechs(await api('/api/technicians'));
    } catch (e) { setErr(e.message); }
  }, [id, user.role]);
  useEffect(() => { load(); }, [load]);
  const act = async (path, body) => {
    try { setErr(''); await api(`/api/incidents/${id}/${path}`, { method: 'POST', body }); setText(''); await load(); onChanged(); }
    catch (e) { setErr(e.message); }
  };
  if (!i) return <div className="panel">{err ? <div className="error">{err}</div> : 'Loading…'}</div>;
  const isTech = user.role === 'TECHNICIAN';
  const isReporterOrAdmin = user.role === 'ADMIN' || user.role === 'EMPLOYEE';
  return (
    <div>
      <button className="btn alt" onClick={onBack}>Back to list</button>
      <div className="panel" style={{ marginTop: 12 }}>
        <h2>#{i.id} {i.title} <Priority p={i.priority} /> <Status s={i.status} /></h2>
        <div className="timers">
          <div className="timer"><span className="muted">Time to respond</span><Countdown deadline={i.responseDeadline} stopped={!!i.acknowledgedAt} violated={i.responseViolated} /></div>
          <div className="timer"><span className="muted">Time to resolve</span><Countdown deadline={i.resolutionDeadline} stopped={!!i.resolvedAt} violated={i.resolutionViolated} /></div>
        </div>
        <p>{i.description}</p>
        <dl className="kv">
          <dt>Category</dt><dd>{i.category}</dd><dt>IT service</dt><dd>{i.service}</dd>
          <dt>Reported by</dt><dd>{i.reporter} on {fmt(i.createdAt)}</dd><dt>Technician</dt><dd>{i.technician || 'Not assigned yet'}</dd>
          <dt>Impact / urgency</dt><dd>{i.impact} / {i.urgency} (score {i.score}), {i.affectedUsers} affected</dd>
          {i.resolution && (<><dt>Resolution</dt><dd>{i.resolution}</dd></>)}
        </dl>
        {err && <div className="error">{err}</div>}

        {user.role === 'ADMIN' && ['PRIORITIZED', 'ASSIGNED'].includes(i.status) && (
          <div className="row">
            <label>Assign technician<select value={techId} onChange={(e) => setTechId(e.target.value)}><option value="">Use the active strategy</option>{techs.map((t) => <option key={t.id} value={t.id} disabled={!t.available}>{t.name} ({t.activeIncidents} active){t.available ? '' : ' – unavailable'}</option>)}</select></label>
            <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => act('assign', { technicianId: techId ? +techId : null })}>{i.status === 'ASSIGNED' ? 'Reassign' : 'Assign'}</button>
          </div>
        )}
        {isTech && i.status === 'ASSIGNED' && <div className="actions"><button className="btn" onClick={() => act('acknowledge')}>Acknowledge</button></div>}
        {isTech && i.status === 'ACKNOWLEDGED' && <div className="actions"><button className="btn" onClick={() => act('start')}>Start investigation</button></div>}
        {isTech && ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(i.status) && (
          <>
            <label style={{ marginTop: 12 }}>Investigation note or resolution details<textarea value={text} onChange={(e) => setText(e.target.value)} /></label>
            <div className="actions">
              <button className="btn alt" disabled={!text.trim()} onClick={() => act('notes', { text })}>Add note</button>
              {i.status === 'IN_PROGRESS' && <button className="btn" disabled={!text.trim()} onClick={() => act('resolve', { text })}>Resolve incident</button>}
            </div>
          </>
        )}
        {isReporterOrAdmin && i.status === 'RESOLVED' && (
          <div className="actions">
            <button className="btn" onClick={() => act('verify')}>Confirm it is fixed</button>
            <button className="btn alt" onClick={() => act('reopen')}>Not fixed, reopen</button>
          </div>
        )}
        {isReporterOrAdmin && i.status === 'VERIFIED' && <div className="actions"><button className="btn" onClick={() => act('close')}>Close incident</button></div>}
        {user.role === 'ADMIN' && (
          <div className="actions"><button className="btn danger" onClick={async () => { if (confirm('Delete this incident?')) { await api('/api/incidents/' + id, { method: 'DELETE' }); onChanged(); onBack(); } }}>Delete incident</button></div>
        )}
      </div>
      <div className="panel">
        <h2>History</h2>
        <ul className="timeline">
          {hist.map((h, k) => (
            <li key={k}><b>{label(h.action)}</b> by {h.actor}{h.oldStatus && h.oldStatus !== h.newStatus ? ` (${label(h.oldStatus)} to ${label(h.newStatus)})` : ''}
              <small>{fmt(h.timestamp)}{h.description ? ' – ' + h.description : ''}</small></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- admin tools ---------------- */
function AdminTools({ meta, onMetaChange }) {
  const [users, setUsers] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [strategy, setStrategy] = useState({ active: '', options: [] });
  const [violations, setViolations] = useState([]);
  const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'TECHNICIAN', skills: '' });
  const [newCat, setNewCat] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    api('/api/users').then(setUsers).catch((e) => setErr(e.message));
    api('/api/sla/policies').then(setPolicies);
    api('/api/config/assignment-strategy').then(setStrategy);
    api('/api/sla/violations').then(setViolations);
  }, []);
  useEffect(load, [load]);
  const run = async (fn) => { try { setErr(''); await fn(); load(); } catch (e) { setErr(e.message); } };
  const setPol = (p, k, v) => setPolicies(policies.map((x) => (x.priority === p ? { ...x, [k]: +v } : x)));
  return (
    <>
      {err && <div className="error">{err}</div>}
      <div className="panel">
        <h2>Technician assignment strategy</h2>
        <div className="row">
          <select value={strategy.active} onChange={(e) => run(async () => setStrategy(await api('/api/config/assignment-strategy', { method: 'PUT', body: { strategy: e.target.value } })))}>
            {strategy.options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
          </select>
          <span className="muted" style={{ flex: '3 1 300px' }}>Skill based picks a matching technician with the lowest workload. Load based picks the least busy available technician.</span>
        </div>
      </div>
      <div className="panel">
        <h2>SLA policies (minutes)</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Priority</th><th>Respond within</th><th>Resolve within</th><th></th></tr></thead>
          <tbody>{policies.map((p) => (
            <tr key={p.priority}><td><Priority p={p.priority} /></td>
              <td><input type="number" min={1} value={p.responseMinutes} onChange={(e) => setPol(p.priority, 'responseMinutes', e.target.value)} /></td>
              <td><input type="number" min={1} value={p.resolutionMinutes} onChange={(e) => setPol(p.priority, 'resolutionMinutes', e.target.value)} /></td>
              <td><button className="btn alt" onClick={() => run(() => api('/api/sla/policies/' + p.priority, { method: 'PUT', body: { responseMinutes: p.responseMinutes, resolutionMinutes: p.resolutionMinutes } }))}>Save</button></td></tr>
          ))}</tbody></table></div>
      </div>
      <div className="panel">
        <h2>Users</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Skills</th><th>Availability</th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{label(u.role)}</td><td>{[...u.skills].join(', ') || '-'}</td>
              <td>{u.role === 'TECHNICIAN' ? <button className="btn alt" onClick={() => run(() => api(`/api/users/${u.id}/technician`, { method: 'PUT', body: { available: !u.available } }))}>{u.available ? 'Available (click to pause)' : 'Unavailable (click to enable)'}</button> : '-'}</td></tr>
          ))}</tbody></table></div>
        <h2 style={{ marginTop: 16 }}>Add a user</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/users', { method: 'POST', body: { ...nu, skills: nu.skills.split(',').map((s) => s.trim()).filter(Boolean) } }); setNu({ ...nu, name: '', email: '', password: '', skills: '' }); }); }}>
          <label>Name<input required value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></label>
          <label>Email<input required type="email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></label>
          <label>Password<input required minLength={6} value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /></label>
          <label>Role<select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>{['EMPLOYEE', 'TECHNICIAN', 'ADMIN'].map((r) => <option key={r}>{r}</option>)}</select></label>
          <label>Skills (category names, comma separated)<input value={nu.skills} onChange={(e) => setNu({ ...nu, skills: e.target.value })} /></label>
          <button className="btn" style={{ flex: '0 0 auto' }}>Add user</button>
        </form>
      </div>
      <div className="panel">
        <h2>Incident categories</h2>
        <p>{meta.categories.map((c) => c.name).join(', ')}</p>
        <form className="row" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/categories', { method: 'POST', body: { name: newCat } }); setNewCat(''); onMetaChange(); }); }}>
          <label>New category<input required value={newCat} onChange={(e) => setNewCat(e.target.value)} /></label>
          <button className="btn" style={{ flex: '0 0 auto' }}>Add category</button>
        </form>
      </div>
      <div className="panel">
        <h2>SLA violations</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>#</th><th>Title</th><th>Priority</th><th>Response</th><th>Resolution</th></tr></thead>
          <tbody>{violations.map((v) => (
            <tr key={v.id}><td>{v.id}</td><td>{v.title}</td><td><Priority p={v.priority} /></td>
              <td>{v.responseViolated ? <span className="bad">Breached</span> : 'OK'}</td><td>{v.resolutionViolated ? <span className="bad">Breached</span> : 'OK'}</td></tr>
          ))}{violations.length === 0 && <tr><td colSpan={5} className="muted">No SLA breaches recorded.</td></tr>}</tbody></table></div>
      </div>
    </>
  );
}

/* ---------------- notifications ---------------- */
function Bell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => api('/api/notifications').then(setItems).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  const unseen = items.filter((n) => !n.seen).length;
  const read = async (n) => { if (!n.seen) { await api(`/api/notifications/${n.id}/read`, { method: 'POST' }); load(); } };
  return (
    <>
      <span className="bell"><button onClick={() => setOpen(!open)}>Notifications{unseen > 0 && <span className="count">{unseen}</span>}</button></span>
      {open && (
        <div className="drop">
          {items.length === 0 && <div className="muted">Nothing yet. Updates on your incidents will show up here.</div>}
          {items.map((n) => <div key={n.id} className={n.seen ? '' : 'unseen'} onClick={() => read(n)}>{n.message}<small className="muted" style={{ display: 'block' }}>{fmt(n.createdAt)}</small></div>)}
        </div>
      )}
    </>
  );
}

/* ---------------- app shell ---------------- */
export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [meta, setMeta] = useState({ categories: [], services: [] });
  const [techs, setTechs] = useState([]);
  const [tab, setTab] = useState('incidents');
  const [openId, setOpenId] = useState(null);
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  const loadMeta = useCallback(async () => {
    const [categories, services] = await Promise.all([api('/api/categories'), api('/api/services')]);
    setMeta({ categories, services });
  }, []);
  useEffect(() => {
    if (!user) return;
    loadMeta().catch(() => {});
    if (user.role === 'ADMIN') api('/api/technicians').then(setTechs).catch(() => {});
  }, [user, loadMeta]);
  if (!user) return <Login onAuth={setUser} />;
  const go = (t) => { setTab(t); setOpenId(null); };
  const tabs = [['incidents', user.role === 'EMPLOYEE' ? 'My incidents' : 'Incidents']];
  if (user.role !== 'TECHNICIAN') tabs.push(['report', 'Report incident']);
  if (user.role === 'ADMIN') tabs.push(['admin', 'Administration']);
  return (
    <>
      <header className="top">
        <h1>I-ITSM Service Desk</h1>
        <nav>{tabs.map(([k, t]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{t}</button>)}</nav>
        <div className="who"><Bell />{user.name} ({label(user.role)})<button onClick={() => { localStorage.clear(); setUser(null); }}>Sign out</button></div>
      </header>
      <main>
        {tab === 'report' && <ReportForm meta={meta} onDone={(id) => { bump(); setTab('incidents'); setOpenId(id); }} />}
        {tab === 'admin' && <AdminTools meta={meta} onMetaChange={loadMeta} />}
        {tab === 'incidents' && (openId
          ? <Detail id={openId} user={user} onBack={() => setOpenId(null)} onChanged={bump} />
          : <IncidentList user={user} meta={meta} techs={techs} onOpen={setOpenId} version={version} />)}
      </main>
    </>
  );
}
