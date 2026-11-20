import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

const STATUSES = ['NEW', 'CLASSIFIED', 'PRIORITIZED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'CLOSED'];
const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];
const URGENCY = [
  { v: 1, t: 'Low', d: 'Not blocking me. Fix when convenient.' },
  { v: 2, t: 'Minor', d: 'Annoying, but I can keep working.' },
  { v: 3, t: 'Moderate', d: 'There is a workaround, but it slows me down.' },
  { v: 4, t: 'High', d: "I can't do an important part of my work." },
  { v: 5, t: 'Critical', d: 'Work has stopped and it needs fixing now.' },
];
const fmt = (t) => (t ? new Date(t).toLocaleString() : '-');
const label = (s) => s.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
const actionLabel = (a) => label(a).replace(/ l(\d)$/, ' (level $1)');
const tone = (s) => (['NEW', 'CLASSIFIED', 'PRIORITIZED'].includes(s) ? 'wait' : ['ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(s) ? 'active' : ['RESOLVED', 'VERIFIED'].includes(s) ? 'done' : 'closed');

const ICON = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  tool: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  plus: <path d="M12 5v14M5 12h14" />,
  sliders: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  logout: <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />,
};
const Icon = ({ name, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[name]}</svg>
);

const Priority = ({ p }) => (p ? <span className={`chip ${p}`}>{p}</span> : <span className="muted">-</span>);
const Status = ({ s }) => <span className={`pill ${tone(s)}`}>{label(s)}</span>;

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

/* ---------------- sign in ---------------- */
const ROLES = [
  { key: 'EMPLOYEE', title: 'Employee', icon: 'user', blurb: 'Report IT problems and follow their progress.' },
  { key: 'TECHNICIAN', title: 'Technician', icon: 'tool', blurb: 'Investigate and resolve the incidents assigned to you.' },
  { key: 'ADMIN', title: 'Administrator', icon: 'shield', blurb: 'Manage users, weights, SLA policies and assignment.' },
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
  return (
    <div className="auth">
      <div className="auth-brand">
        <div className="mark">IT</div>
        <h1>I-ITSM Service Desk</h1>
        <p>{role ? `Sign in as ${role.title.toLowerCase()}` : 'Report, prioritise and resolve IT incidents. Choose how you want to sign in.'}</p>
      </div>
      {!role ? (
        <div className="role-grid">
          {ROLES.map((r) => (
            <button key={r.key} className="role-card" onClick={() => choose(r)}>
              <span className="ic"><Icon name={r.icon} size={22} /></span><b>{r.title}</b><span className="d">{r.blurb}</span>
            </button>
          ))}
        </div>
      ) : (
        <form className="card auth-form" onSubmit={submit}>
          <div className="who"><span className="ic"><Icon name={role.icon} /></span><h3>{role.title} {mode === 'login' ? 'sign in' : 'sign up'}</h3></div>
          {mode === 'register' && <label>Full name<input required value={f.name} onChange={set('name')} /></label>}
          <label>Email<input required type="email" value={f.email} onChange={set('email')} /></label>
          <label>Password<input required type="password" minLength={6} value={f.password} onChange={set('password')} /></label>
          {role.key !== 'EMPLOYEE' && <p className="hint" style={{ margin: 0 }}>{role.title} accounts are created by an administrator.</p>}
          {err && <div className="error">{err}</div>}
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="btn">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
            {role.key === 'EMPLOYEE' && (
              <button type="button" className="btn alt" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
                {mode === 'login' ? 'Sign up instead' : 'I already have an account'}
              </button>
            )}
          </div>
          <button type="button" className="linkbtn" onClick={() => setRole(null)}>Change user type</button>
        </form>
      )}
    </div>
  );
}

/* ---------------- report incident ---------------- */
function ReportForm({ meta, onDone }) {
  const [f, setF] = useState({ title: '', description: '', categoryId: '', serviceId: '', urgency: 3 });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      const i = await api('/api/incidents', { method: 'POST', body: { ...f, categoryId: +f.categoryId, serviceId: +f.serviceId, urgency: +f.urgency } });
      onDone(i.id);
    } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <form className="card" onSubmit={submit}>
      <h3>Report an incident</h3>
      <p className="sub">Tell us what is wrong. The priority and the technician are decided automatically.</p>
      <div style={{ display: 'grid', gap: 14 }}>
        <label>Title<input required maxLength={200} placeholder="Short summary of the problem" value={f.title} onChange={set('title')} /></label>
        <label>What is happening?<textarea required maxLength={2000} placeholder="What did you try, what do you see, since when?" value={f.description} onChange={set('description')} /></label>
        <div className="row">
          <label>Category<select required value={f.categoryId} onChange={set('categoryId')}><option value="">Choose a category</option>{meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Affected IT service<select required value={f.serviceId} onChange={set('serviceId')}><option value="">Choose a service</option>{meta.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        </div>
        <fieldset className="urgency" style={{ display: 'block' }}>
          <div className="legend">How urgent is it for you?</div>
          <div className="urgency">
            {URGENCY.map((u) => (
              <label key={u.v} className={'opt' + (+f.urgency === u.v ? ' on' : '')}>
                <input type="radio" name="urgency" checked={+f.urgency === u.v} onChange={() => setF({ ...f, urgency: u.v })} />
                <b>{u.t}</b><span>{u.d}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      {err && <div className="error">{err}</div>}
      <div className="actions"><button className="btn" disabled={busy}>{busy ? 'Submitting, please wait…' : 'Submit incident'}</button></div>
    </form>
  );
}

/* ---------------- incident list ---------------- */
function Stats({ version }) {
  const [all, setAll] = useState([]);
  useEffect(() => { api('/api/incidents').then(setAll).catch(() => {}); }, [version]);
  const open = all.filter((i) => !['VERIFIED', 'CLOSED'].includes(i.status));
  const tiles = [
    ['Open incidents', open.length, false],
    ['Critical (P1 and P2)', open.filter((i) => ['P1', 'P2'].includes(i.priority)).length, true],
    ['SLA breached', all.filter((i) => i.responseViolated || i.resolutionViolated).length, true],
    ['Escalated', open.filter((i) => i.escalationLevel > 0).length, true],
  ];
  return <div className="stats">{tiles.map(([t, n, hot]) => <div key={t} className={'stat' + (hot && n > 0 ? ' hot' : '')}><span>{t}</span><b>{n}</b></div>)}</div>;
}

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
    <>
      <Stats version={version} />
      <div className="card">
        <div className="row" style={{ marginBottom: 14 }}>
          <label style={{ flex: '2 1 220px' }}>Search<input placeholder="Title or description" value={f.q} onChange={set('q')} /></label>
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
            <thead><tr><th>#</th><th>Incident</th><th>Priority</th><th>Status</th><th>Service</th><th>Technician</th><th>Resolve by</th></tr></thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="click" onClick={() => onOpen(i.id)}>
                  <td className="muted">{i.id}</td>
                  <td><b>{i.title}</b>{i.escalationLevel > 0 && <span className="flag esc">Escalated</span>}{i.duplicateOfId && <span className="flag dup">Duplicate of #{i.duplicateOfId}</span>}</td>
                  <td><Priority p={i.priority} /></td><td><Status s={i.status} /></td>
                  <td>{i.service}</td><td>{i.technician || <span className="muted">Unassigned</span>}</td>
                  <td><Countdown deadline={i.resolutionDeadline} stopped={!!i.resolvedAt} violated={i.resolutionViolated} /></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="muted">No incidents match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------------- incident detail ---------------- */
function Detail({ id, user, onBack, onChanged, onOpen, version }) {
  const [i, setI] = useState(null);
  const [hist, setHist] = useState([]);
  const [related, setRelated] = useState([]);
  const [techs, setTechs] = useState([]);
  const [techId, setTechId] = useState('');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    try {
      setI(await api('/api/incidents/' + id));
      setHist(await api(`/api/incidents/${id}/history`));
      if (user.role !== 'EMPLOYEE') setRelated(await api(`/api/incidents/${id}/related`));
      if (user.role === 'ADMIN') setTechs(await api('/api/technicians'));
    } catch (e) { setErr(e.message); }
  }, [id, user.role]);
  useEffect(() => { load(); }, [load, version]);
  const busy = useRef(false);
  const act = async (path, body) => {
    if (busy.current) return;
    busy.current = true;
    try { setErr(''); await api(`/api/incidents/${id}/${path}`, { method: 'POST', body }); setText(''); await load(); onChanged(); }
    catch (e) { setErr(e.message); }
    finally { busy.current = false; }
  };
  if (!i) return <div className="card">{err ? <div className="error">{err}</div> : 'Loading…'}</div>;
  const isTech = user.role === 'TECHNICIAN';
  const reporterOrAdmin = user.role === 'ADMIN' || user.role === 'EMPLOYEE';
  return (
    <>
      <button className="btn alt small" onClick={onBack} style={{ marginBottom: 14 }}>Back to incidents</button>
      <div className="cols">
        <div>
          <div className="card">
            <div className="titlebar"><h3>#{i.id} {i.title}</h3><Priority p={i.priority} /><Status s={i.status} /></div>
            {i.duplicateOfId && <div className="banner info">This looks like a duplicate of open incident #{i.duplicateOfId}. It has been linked so the team can handle both together.</div>}
            {i.escalationLevel > 0 && <div className="banner warn">Escalated (level {i.escalationLevel}) because it was not acknowledged in time.</div>}
            <div className="timers">
              <div className="timer"><span>Time to respond</span><Countdown deadline={i.responseDeadline} stopped={!!i.acknowledgedAt} violated={i.responseViolated} /></div>
              <div className="timer"><span>Time to resolve</span><Countdown deadline={i.resolutionDeadline} stopped={!!i.resolvedAt} violated={i.resolutionViolated} /></div>
            </div>
            <p style={{ margin: '4px 0 0' }}>{i.description}</p>
            <dl className="kv">
              <dt>Category</dt><dd>{i.category}</dd><dt>IT service</dt><dd>{i.service}</dd>
              <dt>Reported by</dt><dd>{i.reporter} on {fmt(i.createdAt)}</dd><dt>Technician</dt><dd>{i.technician || 'Not assigned yet'}</dd>
              {i.resolution && (<><dt>Resolution</dt><dd>{i.resolution}</dd></>)}
            </dl>
            {err && <div className="error">{err}</div>}

            {user.role === 'ADMIN' && ['PRIORITIZED', 'ASSIGNED'].includes(i.status) && (
              <div className="row" style={{ marginTop: 14 }}>
                <label>Assign technician<select value={techId} onChange={(e) => setTechId(e.target.value)}><option value="">Use the active strategy</option>{techs.map((t) => <option key={t.id} value={t.id} disabled={!t.available}>{t.name} ({t.activeIncidents} active){t.available ? '' : ' - unavailable'}</option>)}</select></label>
                <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => act('assign', { technicianId: techId ? +techId : null })}>{i.status === 'ASSIGNED' ? 'Reassign' : 'Assign'}</button>
              </div>
            )}
            {isTech && i.status === 'ASSIGNED' && <div className="actions"><button className="btn" onClick={() => act('acknowledge')}>Acknowledge</button></div>}
            {isTech && i.status === 'ACKNOWLEDGED' && <div className="actions"><button className="btn" onClick={() => act('start')}>Start investigation</button></div>}
            {isTech && ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(i.status) && (
              <>
                <label style={{ marginTop: 14 }}>Investigation note or resolution details<textarea value={text} onChange={(e) => setText(e.target.value)} /></label>
                <div className="actions">
                  <button className="btn alt" disabled={!text.trim()} onClick={() => act('notes', { text })}>Add note</button>
                  {i.status === 'IN_PROGRESS' && <button className="btn" disabled={!text.trim()} onClick={() => act('resolve', { text })}>Resolve incident</button>}
                </div>
              </>
            )}
            {reporterOrAdmin && i.status === 'RESOLVED' && (
              <div className="actions"><button className="btn" onClick={() => act('verify')}>Confirm it is fixed</button><button className="btn alt" onClick={() => act('reopen')}>Not fixed, reopen</button></div>
            )}
            {reporterOrAdmin && i.status === 'VERIFIED' && <div className="actions"><button className="btn" onClick={() => act('close')}>Close incident</button></div>}
            {user.role === 'ADMIN' && (
              <div className="actions"><button className="btn danger small" onClick={async () => { if (confirm('Delete this incident?')) { await api('/api/incidents/' + id, { method: 'DELETE' }); onChanged(); onBack(); } }}>Delete incident</button></div>
            )}
          </div>

          {user.role !== 'TECHNICIAN' && i.criticality != null && (
            <div className="card">
              <h3>How the priority was decided</h3>
              <p className="sub">Impact comes from the affected service, criticality from the category, urgency from the reporter.</p>
              <div className="formula">
                <div className="term"><small>Service impact</small><b>{i.impact}</b></div><span className="op">×</span>
                <div className="term"><small>Category criticality</small><b>{i.criticality}</b></div><span className="op">×</span>
                <div className="term"><small>Urgency</small><b>{i.urgency}</b></div><span className="op">=</span>
                <div className="term"><small>Score</small><b>{i.score}</b></div><span className="op">→</span><Priority p={i.priority} />
              </div>
            </div>
          )}

          {user.role !== 'EMPLOYEE' && related.length > 0 && (
            <div className="card">
              <h3>Related incidents</h3>
              <p className="sub">Reported for the same service with similar keywords.</p>
              <div className="table-wrap"><table><tbody>
                {related.map((r) => (
                  <tr key={r.id} className={user.role === 'ADMIN' ? 'click' : ''} onClick={() => user.role === 'ADMIN' && onOpen(r.id)}>
                    <td className="muted">#{r.id}</td><td><b>{r.title}</b></td><td><Priority p={r.priority} /></td><td><Status s={r.status} /></td>
                  </tr>
                ))}
              </tbody></table></div>
            </div>
          )}
        </div>

        <div className="card">
          <h3>History</h3>
          <p className="sub">Every change is recorded and cannot be edited.</p>
          <ul className="timeline">
            {hist.map((h, k) => (
              <li key={k} className={/ESCALATED|VIOLATION|DUPLICATE/.test(h.action) ? 'alert' : ''}>
                <b>{actionLabel(h.action)}</b> by {h.actor}{h.oldStatus && h.oldStatus !== h.newStatus ? ` (${label(h.oldStatus)} to ${label(h.newStatus)})` : ''}
                <small>{fmt(h.timestamp)}{h.description ? ' - ' + h.description : ''}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

/* ---------------- administration ---------------- */
function WeightTable({ title, sub, rows, setRows, saveUrl, onSaved, run }) {
  return (
    <div className="card">
      <h3>{title}</h3><p className="sub">{sub}</p>
      <div className="table-wrap"><table>
        <thead><tr><th>Name</th><th style={{ width: 150 }}>Weight (1 to 5)</th><th style={{ width: 90 }}></th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id}><td>{r.name}</td>
            <td><input type="number" min={1} max={5} value={r.criticality ?? ''} onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, criticality: +e.target.value } : x)))} /></td>
            <td><button className="btn alt small" onClick={() => run(async () => { await api(saveUrl(r.id), { method: 'PUT', body: { weight: r.criticality } }); onSaved(); })}>Save</button></td></tr>
        ))}</tbody></table></div>
    </div>
  );
}

function AdminTools({ meta, onMetaChange }) {
  const [users, setUsers] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [strategy, setStrategy] = useState({ active: '', options: [] });
  const [violations, setViolations] = useState([]);
  const [cats, setCats] = useState([]);
  const [svcs, setSvcs] = useState([]);
  const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'TECHNICIAN', skills: '' });
  const [nc, setNc] = useState({ name: '', criticality: 3 });
  const [ns, setNs] = useState({ name: '', criticality: 3 });
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    api('/api/users').then(setUsers).catch((e) => setErr(e.message));
    api('/api/sla/policies').then(setPolicies);
    api('/api/config/assignment-strategy').then(setStrategy);
    api('/api/sla/violations').then(setViolations);
  }, []);
  useEffect(load, [load]);
  useEffect(() => { setCats(meta.categories); setSvcs(meta.services); }, [meta]);
  const run = async (fn) => { try { setErr(''); await fn(); load(); } catch (e) { setErr(e.message); } };
  const setPol = (p, k, v) => setPolicies(policies.map((x) => (x.priority === p ? { ...x, [k]: +v } : x)));
  return (
    <>
      {err && <div className="error">{err}</div>}
      <div className="card">
        <h3>How priority is calculated</h3>
        <p className="sub">Score = service impact × category criticality × urgency (each 1 to 5, so 1 to 125). P1 is 75 or more, P2 is 40 or more, P3 is 15 or more, P4 is below that. Changing a weight affects new and edited incidents only.</p>
      </div>
      <div className="cols" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <div>
          <WeightTable title="Service impact weights" sub="How badly an incident on this service hurts the business." rows={svcs} setRows={setSvcs} saveUrl={(id) => `/api/services/${id}/weight`} onSaved={onMetaChange} run={run} />
          <form className="card" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/services', { method: 'POST', body: { ...ns, criticality: +ns.criticality } }); setNs({ name: '', criticality: 3 }); onMetaChange(); }); }}>
            <h3>Add a service</h3>
            <div className="row" style={{ marginTop: 10 }}>
              <label>Name<input required value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} /></label>
              <label>Impact weight<input type="number" min={1} max={5} value={ns.criticality} onChange={(e) => setNs({ ...ns, criticality: e.target.value })} /></label>
              <button className="btn" style={{ flex: '0 0 auto' }}>Add</button>
            </div>
          </form>
        </div>
        <div>
          <WeightTable title="Category criticality weights" sub="How business-critical this kind of problem is." rows={cats} setRows={setCats} saveUrl={(id) => `/api/categories/${id}/weight`} onSaved={onMetaChange} run={run} />
          <form className="card" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/categories', { method: 'POST', body: { ...nc, criticality: +nc.criticality } }); setNc({ name: '', criticality: 3 }); onMetaChange(); }); }}>
            <h3>Add a category</h3>
            <div className="row" style={{ marginTop: 10 }}>
              <label>Name<input required value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></label>
              <label>Criticality weight<input type="number" min={1} max={5} value={nc.criticality} onChange={(e) => setNc({ ...nc, criticality: e.target.value })} /></label>
              <button className="btn" style={{ flex: '0 0 auto' }}>Add</button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <h3>Technician assignment strategy</h3>
        <p className="sub">Skill based picks a matching technician with the lowest workload. Load based picks the least busy available technician.</p>
        <select style={{ maxWidth: 280 }} value={strategy.active} onChange={(e) => run(async () => setStrategy(await api('/api/config/assignment-strategy', { method: 'PUT', body: { strategy: e.target.value } })))}>
          {strategy.options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
        </select>
      </div>

      <div className="card">
        <h3>SLA policies</h3>
        <p className="sub">Minutes. Unacknowledged P1 and P2 incidents escalate to administrators after the response time, then to IT management and another technician after a second response window.</p>
        <div className="table-wrap"><table>
          <thead><tr><th>Priority</th><th>Respond within</th><th>Resolve within</th><th></th></tr></thead>
          <tbody>{policies.map((p) => (
            <tr key={p.priority}><td><Priority p={p.priority} /></td>
              <td><input type="number" min={1} value={p.responseMinutes} onChange={(e) => setPol(p.priority, 'responseMinutes', e.target.value)} /></td>
              <td><input type="number" min={1} value={p.resolutionMinutes} onChange={(e) => setPol(p.priority, 'resolutionMinutes', e.target.value)} /></td>
              <td><button className="btn alt small" onClick={() => run(() => api('/api/sla/policies/' + p.priority, { method: 'PUT', body: { responseMinutes: p.responseMinutes, resolutionMinutes: p.resolutionMinutes } }))}>Save</button></td></tr>
          ))}</tbody></table></div>
      </div>

      <div className="card">
        <h3>Users</h3>
        <div className="table-wrap" style={{ marginTop: 10 }}><table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Skills</th><th>Availability</th></tr></thead>
          <tbody>{users.map((u) => (
            <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{label(u.role)}</td><td>{[...u.skills].join(', ') || '-'}</td>
              <td>{u.role === 'TECHNICIAN' ? <button className="btn alt small" onClick={() => run(() => api(`/api/users/${u.id}/technician`, { method: 'PUT', body: { available: !u.available } }))}>{u.available ? 'Available (pause)' : 'Unavailable (enable)'}</button> : '-'}</td></tr>
          ))}</tbody></table></div>
        <h3 style={{ marginTop: 20 }}>Add a user</h3>
        <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/users', { method: 'POST', body: { ...nu, skills: nu.skills.split(',').map((s) => s.trim()).filter(Boolean) } }); setNu({ ...nu, name: '', email: '', password: '', skills: '' }); }); }}>
          <label>Name<input required value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></label>
          <label>Email<input required type="email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></label>
          <label>Password<input required minLength={6} value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /></label>
          <label>Role<select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>{['EMPLOYEE', 'TECHNICIAN', 'ADMIN'].map((r) => <option key={r}>{r}</option>)}</select></label>
          <label>Skills (category names, comma separated)<input value={nu.skills} onChange={(e) => setNu({ ...nu, skills: e.target.value })} /></label>
          <button className="btn" style={{ flex: '0 0 auto' }}>Add user</button>
        </form>
      </div>

      <div className="card">
        <h3>SLA violations</h3>
        <div className="table-wrap" style={{ marginTop: 10 }}><table>
          <thead><tr><th>#</th><th>Title</th><th>Priority</th><th>Response</th><th>Resolution</th></tr></thead>
          <tbody>{violations.map((v) => (
            <tr key={v.id}><td className="muted">{v.id}</td><td>{v.title}</td><td><Priority p={v.priority} /></td>
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
    <div className="bell-wrap">
      <button className="bell-btn" onClick={() => setOpen(!open)} aria-label="Notifications"><Icon name="bell" />{unseen > 0 && <span className="count">{unseen}</span>}</button>
      {open && (
        <div className="drop">
          {items.length === 0 && <div className="muted">Nothing yet. Updates on your incidents will appear here.</div>}
          {items.map((n) => <div key={n.id} className={n.seen ? '' : 'unseen'} onClick={() => read(n)}>{n.message}<small>{fmt(n.createdAt)}</small></div>)}
        </div>
      )}
    </div>
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
    if (!user) return undefined;
    loadMeta().catch(() => {});
    if (user.role === 'ADMIN') api('/api/technicians').then(setTechs).catch(() => {});
    const t = setInterval(bump, 20000);
    return () => clearInterval(t);
  }, [user, loadMeta]);
  if (!user) return <Login onAuth={setUser} />;
  const go = (t) => { setTab(t); setOpenId(null); };
  const tabs = [['incidents', user.role === 'EMPLOYEE' ? 'My incidents' : 'Incidents', 'list']];
  if (user.role !== 'TECHNICIAN') tabs.push(['report', 'Report incident', 'plus']);
  if (user.role === 'ADMIN') tabs.push(['admin', 'Administration', 'sliders']);
  const title = tab === 'report' ? 'Report an incident' : tab === 'admin' ? 'Administration' : openId ? `Incident #${openId}` : user.role === 'EMPLOYEE' ? 'My incidents' : user.role === 'TECHNICIAN' ? 'Assigned to me' : 'All incidents';
  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><span className="mark">IT</span><div><b>I-ITSM</b><small>Service Desk</small></div></div>
        <nav>{tabs.map(([k, t, ic]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}><Icon name={ic} />{t}</button>)}</nav>
        <div className="me">
          <div className="avatar">{initials}</div>
          <div><b>{user.name}</b><small>{label(user.role)}</small></div>
          <button title="Sign out" aria-label="Sign out" onClick={() => { localStorage.clear(); setUser(null); }}><Icon name="logout" /></button>
        </div>
      </aside>
      <div className="content">
        <div className="topbar"><h2>{title}</h2><Bell /></div>
        <main>
          {tab === 'report' && <ReportForm meta={meta} onDone={(id) => { bump(); setTab('incidents'); setOpenId(id); }} />}
          {tab === 'admin' && <AdminTools meta={meta} onMetaChange={loadMeta} />}
          {tab === 'incidents' && (openId
            ? <Detail id={openId} user={user} onBack={() => setOpenId(null)} onChanged={bump} onOpen={setOpenId} version={version} />
            : <IncidentList user={user} meta={meta} techs={techs} onOpen={setOpenId} version={version} />)}
        </main>
      </div>
    </div>
  );
}
