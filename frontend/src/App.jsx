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
/** 45m, 3h 05m, or 1d 6h 30m once it is a day or more. */
const duration = (ms) => {
  const total = Math.floor(ms / 60000);
  const d = Math.floor(total / 1440), h = Math.floor((total % 1440) / 60), m = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};
const fmtShort = (t) => (t ? new Date(t).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
const OPEN_STATUSES = ['NEW', 'CLASSIFIED', 'PRIORITIZED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS'];
const DONE_STATUSES = ['RESOLVED', 'VERIFIED', 'CLOSED'];
/** How a resolved incident did against its resolution deadline. */
const slaResult = (i) => {
  if (!i.resolvedAt || !i.resolutionDeadline) return null;
  const diff = new Date(i.resolvedAt) - new Date(i.resolutionDeadline);
  return diff > 0 ? { late: true, text: `Late by ${duration(diff)}` } : { late: false, text: 'Within SLA' };
};
const ref = (i) => i.reference || `INC-${i.priority || 'P0'}-${String(i.id).padStart(4, '0')}`;
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
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  logout: <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />,
  back: <path d="M15 18l-6-6 6-6" />,
  down: <path d="M6 9l6 6 6-6" />,
  panel: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></>,
  alert: <><path d="M12 8v5" /><path d="M12 16.5h.01" /><circle cx="12" cy="12" r="9" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 10" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  server: <><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><path d="M7.5 8h.01" /></>,
  route: <><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.5 2.4 3.5 5.2" /></>,
  usercheck: <><circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3-6 7-6s7 2 7 6" /><path d="M16 11l2 2 4-4" /></>,
  userplus: <><circle cx="9" cy="8" r="4" /><path d="M2 21c0-4 3-6 7-6s7 2 7 6" /><path d="M19 8v6M16 11h6" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
};
const Icon = ({ name, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[name]}</svg>
);

const Priority = ({ p }) => (p ? <span className={`chip ${p}`}>{p}</span> : <span className="muted">-</span>);
const Status = ({ s }) => <span className={`pill ${tone(s)}`}>{label(s)}</span>;

function Countdown({ deadline, stopped, violated, doneAt, doneLabel }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!deadline) return <b>-</b>;
  if (stopped) {
    return (
      <>
        <b className={'done ' + (violated ? 'bad' : 'ok')}>{doneLabel || 'Done'} on {fmtShort(doneAt)}</b>
        <small className={violated ? 'bad' : 'ok'}>{violated ? 'SLA breached' : 'Within SLA'}</small>
      </>
    );
  }
  const ms = new Date(deadline) - now;
  if (ms < 0) return <b className="bad">Overdue {duration(-ms)}</b>;
  const s = Math.floor(ms / 1000);
  if (ms >= 86400000) return <b className="ok">{duration(ms)}</b>;
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
  const [info, setInfo] = useState('');
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const choose = (r) => { setRole(r); setMode('login'); setErr(''); setInfo(''); setUnconfirmed(false); setF({ name: '', email: '', password: '' }); };

  // Confirmation link from the verification email: /?verify=<token>
  useEffect(() => {
    const token = new URLSearchParams(location.search).get('verify');
    if (!token) return;
    history.replaceState(null, '', location.pathname);
    setRole(ROLES[0]);
    api('/api/auth/verify', { method: 'POST', body: { token } })
      .then((r) => { setErr(''); setInfo(r.message); })
      .catch((x) => setErr(x.message));
  }, []);

  const resend = async () => {
    try {
      const r = await api('/api/auth/resend-verification', { method: 'POST', body: { email: f.email } });
      setErr(''); setUnconfirmed(false); setInfo(r.message);
    } catch (x) { setErr(x.message); }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(''); setInfo(''); setUnconfirmed(false);
    try {
      if (mode === 'register') {
        const reg = await api('/api/auth/register', { method: 'POST', body: f });
        if (reg.verificationRequired) {
          setMode('login');
          setF({ ...f, name: '', password: '' });
          setInfo(reg.message);
          return;
        }
      }
      const r = await api('/api/auth/login', { method: 'POST', body: { email: f.email, password: f.password } });
      if (r.user.role !== role.key) throw new Error(`This account is not a ${role.title.toLowerCase()} account. Go back and choose the right user type.`);
      localStorage.setItem('token', r.token);
      localStorage.setItem('user', JSON.stringify(r.user));
      onAuth(r.user);
    } catch (x) {
      setErr(x.message);
      setUnconfirmed(/confirm your email/i.test(x.message));
    } finally { setBusy(false); }
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
          {info && <div className="banner info" style={{ margin: 0 }}>{info}</div>}
          {mode === 'register' && <label>Full name<input required value={f.name} onChange={set('name')} /></label>}
          <label>Email<input required type="email" value={f.email} onChange={set('email')} /></label>
          <label>Password<input required type="password" minLength={6} value={f.password} onChange={set('password')} /></label>
          {role.key !== 'EMPLOYEE' && <p className="hint" style={{ margin: 0 }}>{role.title} accounts are created by an administrator.</p>}
          {mode === 'register' && <p className="hint" style={{ margin: 0 }}>We email you a link to confirm the address. After that, an administrator has to verify your account before you can report incidents.</p>}
          {err && <div className="error">{err}</div>}
          {unconfirmed && <button type="button" className="linkbtn" onClick={resend}>Send the confirmation link again</button>}
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="btn" disabled={busy}>{mode === 'login' ? 'Sign in' : 'Create account'}</button>
            {role.key === 'EMPLOYEE' && (
              <button type="button" className="btn alt" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); setInfo(''); setUnconfirmed(false); }}>
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
const scopeHint = (role, scope) => {
  if (role === 'EMPLOYEE') return 'The incidents you reported.';
  if (scope === 'all') return 'Every incident in the system.';
  return role === 'TECHNICIAN' ? 'Every incident assigned to you, past and present.' : 'The incidents you reported yourself.';
};

function Stats({ version, scope }) {
  const [all, setAll] = useState([]);
  useEffect(() => { api('/api/incidents?scope=' + scope).then(setAll).catch(() => {}); }, [version, scope]);
  const open = all.filter((i) => OPEN_STATUSES.includes(i.status));
  const tiles = [
    ['Open incidents', open.length, false],
    ['Resolved incidents', all.filter((i) => DONE_STATUSES.includes(i.status)).length, false],
    ['Critical open (P1 and P2)', open.filter((i) => ['P1', 'P2'].includes(i.priority)).length, true],
    ['SLA breached', all.filter((i) => i.responseViolated || i.resolutionViolated).length, true],
    ['Escalated open', open.filter((i) => i.escalationLevel > 0).length, true],
  ];
  return <div className="stats">{tiles.map(([t, n, hot]) => <div key={t} className={'stat' + (hot && n > 0 ? ' hot' : '')}><span>{t}</span><b>{n}</b></div>)}</div>;
}

function IncidentList({ user, meta, techs, onOpen, version, scope }) {
  const [f, setF] = useState({ q: '', status: '', priority: '', categoryId: '', serviceId: '', technicianId: '', from: '' });
  const [group, setGroup] = useState('open');
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  useEffect(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    p.set('scope', scope);
    api('/api/incidents?' + p).then(setRows).catch((e) => setErr(e.message));
  }, [f, version, scope]);
  const open = rows.filter((r) => OPEN_STATUSES.includes(r.status));
  const done = rows
    .filter((r) => DONE_STATUSES.includes(r.status))
    .sort((a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt));
  const resolved = group === 'done';
  const shown = resolved ? done : open;
  const pick = (g) => { setGroup(g); setF({ ...f, status: '' }); };
  return (
    <>
      <Stats version={version} scope={scope} />
      <p className="hint" style={{ margin: '0 0 10px' }}>{scopeHint(user.role, scope)}</p>
      <div className="tabs">
        <button className={!resolved ? 'on' : ''} onClick={() => pick('open')}>Open cases <span className="count">{open.length}</span></button>
        <button className={resolved ? 'on' : ''} onClick={() => pick('done')}>Resolved cases <span className="count">{done.length}</span></button>
      </div>
      <div className="card">
        <div className="row" style={{ marginBottom: 14 }}>
          <label style={{ flex: '2 1 220px' }}>Search<input placeholder="Title, description or ID (INC-P3-0003)" value={f.q} onChange={set('q')} /></label>
          <label>Status<select value={f.status} onChange={set('status')}><option value="">Any</option>{(resolved ? DONE_STATUSES : OPEN_STATUSES).map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></label>
          <label>Priority<select value={f.priority} onChange={set('priority')}><option value="">Any</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label>Category<select value={f.categoryId} onChange={set('categoryId')}><option value="">Any</option>{meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Service<select value={f.serviceId} onChange={set('serviceId')}><option value="">Any</option>{meta.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          {user.role === 'ADMIN' && <label>Technician<select value={f.technicianId} onChange={set('technicianId')}><option value="">Any</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
          <label>Reported since<input type="date" value={f.from} onChange={set('from')} /></label>
        </div>
        {err && <div className="error">{err}</div>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Incident</th><th>Priority</th><th>Status</th><th>Service</th><th>Technician</th>{resolved ? <><th>Resolved on</th><th>SLA</th></> : <th>Resolve by</th>}</tr>
            </thead>
            <tbody>
              {shown.map((i) => {
                const sla = slaResult(i);
                return (
                  <tr key={i.id} className="click" onClick={() => onOpen(i.id)}>
                    <td className="ref">{ref(i)}</td>
                    <td><b>{i.title}</b>{i.escalationLevel > 0 && <span className="flag esc">Escalated</span>}{i.duplicateOfId && <span className="flag dup">Duplicate of {i.duplicateOfReference || 'another incident'}</span>}</td>
                    <td><Priority p={i.priority} /></td><td><Status s={i.status} /></td>
                    <td>{i.service}</td><td>{i.technician || <span className="muted">Unassigned</span>}</td>
                    {resolved
                      ? <><td>{fmtShort(i.resolvedAt)}</td><td>{sla ? <span className={sla.late ? 'bad' : 'ok'}>{sla.text}</span> : '-'}</td></>
                      : <td><Countdown deadline={i.resolutionDeadline} stopped={!!i.resolvedAt} violated={i.resolutionViolated} doneAt={i.resolvedAt} doneLabel="Resolved" /></td>}
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={resolved ? 8 : 7} className="muted">{resolved ? 'No resolved incidents match these filters.' : 'No open incidents match these filters.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------------- incident detail ---------------- */
const HISTORY_PREVIEW = 5;
function Detail({ id, user, onBack, onChanged, onOpen, version, backLabel }) {
  const [i, setI] = useState(null);
  const [hist, setHist] = useState([]);
  const [related, setRelated] = useState([]);
  const [techs, setTechs] = useState([]);
  const [techId, setTechId] = useState('');
  const [text, setText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showAllHist, setShowAllHist] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
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
  useEffect(() => { setShowAllHist(false); setConfirmDel(false); setEditing(false); setConfirming(false); setErr(''); window.scrollTo(0, 0); }, [id]);
  const busy = useRef(false);
  const act = async (path, body) => {
    if (busy.current) return;
    busy.current = true;
    try { setErr(''); await api(`/api/incidents/${id}/${path}`, { method: 'POST', body }); setText(''); setInfoText(''); setConfirming(false); setRating(0); setComment(''); await load(); onChanged(); }
    catch (e) { setErr(e.message); }
    finally { busy.current = false; }
  };
  if (!i) return <div className="card">{err ? <div className="error">{err}</div> : 'Loading…'}</div>;
  const isTech = user.role === 'TECHNICIAN' && i.technicianId === user.id;
  const isAdmin = user.role === 'ADMIN';
  const reporterOrAdmin = isAdmin || user.role === 'EMPLOYEE';
  const isReporter = i.reporterId === user.id;
  const canEdit = (isAdmin || isReporter) && ['NEW', 'CLASSIFIED', 'PRIORITIZED', 'ASSIGNED'].includes(i.status);
  const thread = hist.filter((h) => h.action === 'INFO_REQUESTED' || h.action === 'INFO_PROVIDED');
  const lastInfo = thread.length ? thread[thread.length - 1] : null;
  const waitingForReply = lastInfo && lastInfo.action === 'INFO_REQUESTED';
  const startEdit = () => { setEdit({ title: i.title, description: i.description, urgency: i.urgency || 3 }); setEditing(true); };
  const saveEdit = async (e) => {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    try { setErr(''); await api('/api/incidents/' + id, { method: 'PUT', body: { ...edit, urgency: +edit.urgency } }); setEditing(false); await load(); onChanged(); }
    catch (x) { setErr(x.message); }
    finally { busy.current = false; }
  };
  const remove = async () => {
    if (busy.current) return;
    busy.current = true;
    try { setErr(''); await api('/api/incidents/' + id, { method: 'DELETE' }); onChanged(); onBack(); }
    catch (x) { setErr(x.message); setConfirmDel(false); }
    finally { busy.current = false; }
  };

  const done = DONE_STATUSES.includes(i.status);
  const breached = i.responseViolated || i.resolutionViolated;
  const heroTone = done ? 'good' : ['P1', 'P2'].includes(i.priority) || breached || i.escalationLevel > 0 ? 'hot' : 'calm';
  const heroIcon = done ? 'check' : heroTone === 'hot' ? 'alert' : 'clock';
  const showRelated = user.role !== 'EMPLOYEE';
  const shownHist = showAllHist ? hist : hist.slice(0, HISTORY_PREVIEW);
  const canInfo = reporterOrAdmin && !['VERIFIED', 'CLOSED'].includes(i.status);
  const canAssign = isAdmin && ['PRIORITIZED', 'ASSIGNED'].includes(i.status);
  const techWork = isTech && ['ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(i.status);
  const hasActions = editing || canEdit || canAssign || techWork || (reporterOrAdmin && ['RESOLVED', 'VERIFIED'].includes(i.status));

  return (
    <>
      <button className="backlink" onClick={onBack}><Icon name="back" size={16} />{backLabel || 'Back to incidents'}</button>

      <section className={'hero ' + heroTone}>
        <span className="hero-ic"><Icon name={heroIcon} size={30} /></span>
        <div className="hero-text">
          <div className="hero-title">
            <h3><span className="hero-ref">{ref(i)}</span> {i.title}</h3>
            <Priority p={i.priority} /><Status s={i.status} />
            {i.escalationLevel > 0 && <span className="flag esc">Escalated L{i.escalationLevel}</span>}
            {i.duplicateOfId && <span className="flag dup">Possible duplicate</span>}
          </div>
          <p>{i.description}</p>
        </div>
      </section>

      {i.duplicateOfId && <div className="banner info">This looks like a duplicate of open incident {i.duplicateOfReference || 'reported earlier'}. It has been linked so the team can handle both together.</div>}
      {i.escalationLevel > 0 && <div className="banner warn">Escalated (level {i.escalationLevel}) because it was not acknowledged in time.</div>}
      {err && <div className="error">{err}</div>}

      <div className={'detail-top' + (showRelated ? '' : ' no-rel')}>
        <div className="card">
          <h3>SLA overview</h3>
          <div className="sla-grid">
            <div className="sla-box"><span>Response SLA</span><Countdown deadline={i.responseDeadline} stopped={!!i.acknowledgedAt} violated={i.responseViolated} doneAt={i.acknowledgedAt} doneLabel="Acknowledged" /></div>
            <div className="sla-box"><span>Resolution SLA</span><Countdown deadline={i.resolutionDeadline} stopped={!!i.resolvedAt} violated={i.resolutionViolated} doneAt={i.resolvedAt} doneLabel="Resolved" /></div>
          </div>
        </div>

        {showRelated && (
          <div className="card">
            <h3>Related incident{related.length === 1 ? '' : 's'}</h3>
            {related.length === 0 && <p className="hint" style={{ margin: '6px 0 0' }}>No similar incidents on this service.</p>}
            <div className="related">
              {related.slice(0, 3).map((r) => (
                <div key={r.id} className="rel">
                  {isAdmin ? <button className="linkbtn ref-link" onClick={() => onOpen(r.id)}>{ref(r)}</button> : <span className="ref">{ref(r)}</span>}
                  <div className="rel-title">{r.title}</div>
                  <div className="rel-tags"><Priority p={r.priority} /><Status s={r.status} /></div>
                </div>
              ))}
              {related.length > 3 && <p className="hint" style={{ margin: 0 }}>and {related.length - 3} more</p>}
            </div>
          </div>
        )}
      </div>

      <div className="detail-mid">
        <div className="detail-main">
          <div className="card">
            <h3>Incident details</h3>
            <dl className="kv">
              <dt>Description</dt><dd>{i.description}</dd>
              <dt>Category</dt><dd>{i.category}</dd>
              <dt>IT service</dt><dd>{i.service}</dd>
              {i.urgency ? <><dt>Urgency</dt><dd>{i.urgency} - {URGENCY.find((u) => u.v === i.urgency)?.t}</dd></> : null}
              <dt>Reported by</dt><dd>{i.reporter}</dd>
              <dt>Reported on</dt><dd>{fmt(i.createdAt)}</dd>
              <dt>Technician</dt><dd>{i.technician || <span className="muted">Not assigned yet</span>}</dd>
              {i.resolution && (<><dt>Resolution</dt><dd>{i.resolution}</dd></>)}
            </dl>
          </div>
        {hasActions && (
          <div className="card">
            <h3>Actions</h3>
            {editing && edit && (
              <form className="editbox" onSubmit={saveEdit}>
                <h3>Edit incident</h3>
                <label>Title<input required maxLength={200} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
                <label>Description<textarea required maxLength={2000} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
                <label>Urgency<select value={edit.urgency} onChange={(e) => setEdit({ ...edit, urgency: e.target.value })}>{URGENCY.map((u) => <option key={u.v} value={u.v}>{u.v} - {u.t}: {u.d}</option>)}</select></label>
                <p className="hint" style={{ margin: 0 }}>The priority and SLA deadlines are recalculated when you save.</p>
                <div className="actions" style={{ marginTop: 0 }}><button className="btn">Save changes</button><button type="button" className="btn alt" onClick={() => setEditing(false)}>Cancel</button></div>
              </form>
            )}
            {canEdit && !editing && <div className="actions"><button className="btn alt small" onClick={startEdit}>Edit incident</button><span className="hint" style={{ alignSelf: 'center' }}>You can edit it until a technician acknowledges it.</span></div>}

            {canAssign && (
              <div className="row" style={{ marginTop: 14 }}>
                <label>Assign technician<select value={techId} onChange={(e) => setTechId(e.target.value)}><option value="">Use the active strategy</option>{techs.map((t) => <option key={t.id} value={t.id} disabled={!t.available}>{t.name} ({t.activeIncidents} active){t.available ? '' : ' - unavailable'}</option>)}</select></label>
                <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => act('assign', { technicianId: techId ? +techId : null })}>{i.status === 'ASSIGNED' ? 'Reassign' : 'Assign'}</button>
              </div>
            )}
            {isTech && i.status === 'ASSIGNED' && <div className="actions"><button className="btn" onClick={() => act('acknowledge')}>Acknowledge</button></div>}
            {isTech && i.status === 'ACKNOWLEDGED' && <div className="actions"><button className="btn" onClick={() => act('start')}>Start investigation</button></div>}
            {techWork && (
              <div className="infobox">
                <label>Need more details from the reporter?<textarea placeholder="Write your question here" value={infoText} maxLength={2000} onChange={(e) => setInfoText(e.target.value)} /></label>
                <div className="actions" style={{ marginTop: 0 }}><button className="btn alt" disabled={!infoText.trim()} onClick={() => act('request-info', { text: infoText })}>Ask the reporter for information</button></div>
              </div>
            )}
            {isTech && ['ACKNOWLEDGED', 'IN_PROGRESS'].includes(i.status) && (
              <>
                <label style={{ marginTop: 14 }}>Investigation note or resolution details<textarea value={text} onChange={(e) => setText(e.target.value)} /></label>
                <div className="actions">
                  <button className="btn alt" disabled={!text.trim()} onClick={() => act('notes', { text })}>Add note</button>
                  {i.status === 'IN_PROGRESS' && <button className="btn" disabled={!text.trim()} onClick={() => act('resolve', { text })}>Resolve incident</button>}
                </div>
              </>
            )}
            {reporterOrAdmin && i.status === 'RESOLVED' && (confirming ? (
              <div className="ratebox">
                <div className="legend">How well was it resolved? A star rating is required.</div>
                <StarPicker value={rating} onChange={setRating} />
                <label style={{ marginTop: 10 }}>Comments (optional)<textarea value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} /></label>
                <div className="actions"><button className="btn" disabled={!rating} onClick={() => act('verify', { rating, comment })}>Confirm and send rating</button><button className="btn alt" onClick={() => setConfirming(false)}>Cancel</button></div>
              </div>
            ) : (
              <div className="actions"><button className="btn" onClick={() => (isReporter ? setConfirming(true) : act('verify'))}>Confirm it is fixed</button><button className="btn alt" onClick={() => act('reopen')}>Not fixed, reopen</button></div>
            ))}
            {reporterOrAdmin && i.status === 'VERIFIED' && <div className="actions"><button className="btn" onClick={() => act('close')}>Close incident</button></div>}
          </div>
        )}

        {thread.length > 0 && (
          <div className="card">
            <h3>Questions and answers</h3>
            <p className="sub">Information requested by the technician and added by the reporter.</p>
            <ul className="timeline">
              {thread.map((h, k) => (
                <li key={k}><b>{h.action === 'INFO_REQUESTED' ? 'Question' : 'Answer'}</b> from {h.actor}<small>{fmt(h.timestamp)}</small><div>{h.description}</div></li>
              ))}
            </ul>
          </div>
        )}

        {i.rating != null && (
          <div className="card">
            <h3>Employee feedback</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}><Stars value={i.rating} size={22} /><b>{i.rating} / 5</b></div>
            {i.feedback ? <p style={{ margin: '8px 0 0' }}>{i.feedback}</p> : <p className="hint" style={{ margin: '8px 0 0' }}>No written comment.</p>}
            <p className="hint" style={{ margin: '6px 0 0' }}>Given on {fmt(i.ratedAt)}</p>
          </div>
        )}
        </div>
        <div className="card history">
          <h3>History</h3>
          <ul className="timeline" style={{ marginTop: 12 }}>
            {shownHist.map((h, k) => (
              <li key={k} className={/ESCALATED|VIOLATION|DUPLICATE/.test(h.action) ? 'alert' : ''}>
                <b>{actionLabel(h.action)}</b> by {h.actor}{h.oldStatus && h.oldStatus !== h.newStatus ? ` (${label(h.oldStatus)} to ${label(h.newStatus)})` : ''}
                <small>{fmt(h.timestamp)}{h.description ? ' - ' + h.description : ''}</small>
              </li>
            ))}
          </ul>
          {hist.length > HISTORY_PREVIEW && (
            <button className="linkbtn viewmore" onClick={() => setShowAllHist(!showAllHist)}>
              {showAllHist ? 'Show less' : `View more (${hist.length - HISTORY_PREVIEW})`}<span className={showAllHist ? 'flip' : ''}><Icon name="down" size={16} /></span>
            </button>
          )}
        </div>
      </div>

      {(canInfo || isAdmin) && (
        <div className="bottombar">
          {canInfo ? (
            <div className="card addinfo">
              {waitingForReply && <div className="banner info" style={{ margin: '0 0 10px' }}><b>The technician asked:</b> {lastInfo.description}</div>}
              <form className="addinfo-row" onSubmit={(e) => { e.preventDefault(); if (infoText.trim()) act('info', { text: infoText }); }}>
                <input aria-label="Add more information" placeholder={waitingForReply ? 'Write your reply' : 'Add more information (optional)'} value={infoText} maxLength={2000} onChange={(e) => setInfoText(e.target.value)} />
                <button className="btn" disabled={!infoText.trim()}>{waitingForReply ? 'Send reply' : 'Add information'}</button>
              </form>
            </div>
          ) : <div />}
          {isAdmin && (confirmDel ? (
            <div className="delconfirm"><span>Delete this incident for good?</span><button className="btn danger" onClick={remove}>Yes, delete</button><button className="btn alt" onClick={() => setConfirmDel(false)}>Cancel</button></div>
          ) : (
            <button className="btn danger" onClick={() => setConfirmDel(true)}><Icon name="trash" size={16} />Delete incident</button>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- ratings & audit log ---------------- */
const Stars = ({ value, size = 18 }) => (
  <span className="stars" style={{ fontSize: size }} aria-label={`${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= Math.round(value) ? 'on' : ''}>★</span>)}
  </span>
);

function StarPicker({ value, onChange }) {
  return (
    <div className="stars pick" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} className={n <= value ? 'on' : ''} onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>★</button>
      ))}
    </div>
  );
}

/** Five stars filled to the exact score, e.g. 3.92 fills the fourth star to 92%. */
const ExactStars = ({ value, size = 22 }) => (
  <span className="xstars" style={{ fontSize: size }} aria-label={`${value.toFixed(2)} out of 5`}>
    {[0, 1, 2, 3, 4].map((k) => {
      const fill = Math.max(0, Math.min(1, value - k)) * 100;
      return <span key={k} className="xstar"><span className="xstar-on" style={{ width: fill + '%' }}>★</span>★</span>;
    })}
  </span>
);

function RatingCard({ version }) {
  const [r, setR] = useState(null);
  useEffect(() => {
    const get = () => api('/api/ratings/me').then(setR).catch(() => {});
    get();
    // Re-check on its own too, so a deadline that just passed shows up without waiting for other changes.
    const t = setInterval(get, 15000);
    return () => clearInterval(t);
  }, [version]);
  if (!r) return null;
  const tier = r.score >= 4.5 ? 'Excellent' : r.score >= 3.5 ? 'Good' : r.score >= 2.5 ? 'Fair' : 'Needs attention';
  return (
    <div className="card rating-card">
      <div className="rating-score">
        <span className="rating-label">Your rating</span>
        <div className="rating-big"><b>{r.score.toFixed(2)}</b><span>/ 5</span></div>
        <ExactStars value={r.score} size={24} />
        <span className={'rating-tier ' + (r.score >= 3.5 ? 'good' : 'low')}>{tier}</span>
      </div>
      <div className="rating-parts">
        <div className="rating-part"><span>Employee average</span><b>{r.average.toFixed(2)}</b><small>Starting rating {r.initial.toFixed(1)} counts as one review</small></div>
        <div className="rating-part"><span>Reviews</span><b>{r.reviews}</b><small>Star ratings from employees</small></div>
        <div className={'rating-part' + (r.slaViolations > 0 ? ' hot' : '')}><span>SLA violations</span><b>{r.slaViolations}</b><small>{r.slaViolations > 0 ? `−${r.penalty.toFixed(2)} from your rating. Each missed response or resolution deadline counts.` : 'No deduction'}</small></div>
      </div>
    </div>
  );
}

const AUDIT_ACTIONS = ['CREATED', 'CLASSIFIED', 'PRIORITIZED', 'ASSIGNED', 'REASSIGNED', 'ACKNOWLEDGED', 'INVESTIGATION_STARTED', 'NOTE_ADDED',
  'INFO_REQUESTED', 'INFO_PROVIDED', 'UPDATED', 'PRIORITY_CHANGED', 'RESOLVED', 'VERIFIED', 'REOPENED', 'CLOSED', 'DUPLICATE_DETECTED',
  'ESCALATED_L1', 'ESCALATED_L2', 'SLA_RESPONSE_VIOLATION', 'SLA_RESOLUTION_VIOLATION', 'DELETED'];
const actionTone = (a) => (/ESCALATED|VIOLATION|DUPLICATE|DELETED/.test(a) ? 'warnpill' : /RESOLVED|VERIFIED|CLOSED/.test(a) ? 'done' : /NOTE|INFO/.test(a) ? 'wait' : 'active');

function AuditLogView({ onOpenIncident, version }) {
  const [f, setF] = useState({ action: '', actor: '', incident: '', from: '', to: '' });
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ items: [], page: 0, totalPages: 0, total: 0 });
  const [err, setErr] = useState('');
  const query = (extra) => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    Object.entries(extra).forEach(([k, v]) => p.set(k, v));
    return '/api/audit?' + p;
  };
  useEffect(() => {
    api(query({ page, size: 25 })).then((d) => { setErr(''); setData(d); }).catch((e) => setErr(e.message));
  }, [f, page, version]);
  const set = (k) => (e) => { setPage(0); setF({ ...f, [k]: e.target.value }); };
  const exportCsv = async () => {
    try {
      const d = await api(query({ page: 0, size: 1000 }));
      const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
      const rows = [['Time', 'Incident', 'Action', 'By', 'Old status', 'New status', 'Description'],
        ...d.items.map((a) => [a.timestamp, a.reference, a.action, a.actor, a.oldStatus, a.newStatus, a.description])];
      const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'audit-log.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };
  return (
    <div className="card">
      <h3>Audit log</h3>
      <p className="sub">Every important action on every incident, newest first. Entries cannot be edited or deleted.</p>
      <div className="row" style={{ marginBottom: 14 }}>
        <label>Action<select value={f.action} onChange={set('action')}><option value="">Any</option>{AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}</select></label>
        <label>Done by<input placeholder="Name" value={f.actor} onChange={set('actor')} /></label>
        <label>Incident<input placeholder="ID or INC-P1-0008" value={f.incident} onChange={set('incident')} /></label>
        <label>From<input type="date" value={f.from} onChange={set('from')} /></label>
        <label>To<input type="date" value={f.to} onChange={set('to')} /></label>
        <button className="btn alt" style={{ flex: '0 0 auto' }} onClick={exportCsv}>Export CSV</button>
      </div>
      {err && <div className="error">{err}</div>}
      <div className="table-wrap"><table>
        <thead><tr><th>Time</th><th>Incident</th><th>Action</th><th>By</th><th>Status change</th><th>Details</th></tr></thead>
        <tbody>
          {data.items.map((a) => (
            <tr key={a.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{fmtShort(a.timestamp)}</td>
              <td className="ref">{a.reference.includes('(deleted)') ? a.reference : <button className="linkbtn" onClick={() => onOpenIncident(a.incidentId)}>{a.reference}</button>}</td>
              <td><span className={'pill ' + actionTone(a.action)}>{actionLabel(a.action)}</span></td>
              <td>{a.actor}</td>
              <td>{a.oldStatus && a.oldStatus !== a.newStatus ? `${label(a.oldStatus)} → ${label(a.newStatus)}` : a.newStatus && !a.oldStatus ? `→ ${label(a.newStatus)}` : '-'}</td>
              <td>{a.description || '-'}</td>
            </tr>
          ))}
          {data.items.length === 0 && <tr><td colSpan={6} className="muted">No audit entries match these filters.</td></tr>}
        </tbody></table></div>
      <div className="actions" style={{ alignItems: 'center' }}>
        <button className="btn alt small" disabled={page <= 0} onClick={() => setPage(page - 1)}>Previous</button>
        <span className="hint">Page {data.totalPages === 0 ? 0 : data.page + 1} of {data.totalPages} ({data.total} entries)</span>
        <button className="btn alt small" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
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

function TileGrid({ tiles, onPick }) {
  return (
    <div className={`tile-grid fill n${tiles.length}`}>
      {tiles.map((t) => (
        <button key={t.key} className="tile" onClick={() => onPick(t.key)}>
          <span className="ic"><Icon name={t.icon} size={22} /></span>
          <b>{t.title}</b>
          <span className="d">{t.blurb}</span>
          {t.meta != null && <span className={'meta' + (t.alert ? ' alert' : '')}>{t.meta}</span>}
        </button>
      ))}
    </div>
  );
}

const PanelHead = ({ back, onBack, title, sub }) => (
  <div className="panel-head">
    <button className="backlink" onClick={onBack}><Icon name="back" size={16} />{back}</button>
    {title && <h3>{title}</h3>}
    {sub && <p className="sub">{sub}</p>}
  </div>
);

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const initialsOf = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/** Every incident one employee reported, or one technician was assigned. */
function PersonHistory({ person, kind, onBack, onOpenIncident, version }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [group, setGroup] = useState('all');
  useEffect(() => {
    const key = kind === 'tech' ? 'technicianId' : 'reporterId';
    api(`/api/incidents?scope=all&${key}=${person.id}`).then((r) => { setErr(''); setRows(r); }).catch((e) => setErr(e.message));
  }, [person.id, kind, version]);
  const list = rows || [];
  const open = list.filter((i) => OPEN_STATUSES.includes(i.status));
  const done = list.filter((i) => DONE_STATUSES.includes(i.status));
  const breached = list.filter((i) => i.responseViolated || i.resolutionViolated);
  const shown = (group === 'open' ? open : group === 'done' ? done : list)
    .slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <>
      <PanelHead back={kind === 'tech' ? 'Back to technicians' : 'Back to employees'} onBack={onBack} />
      <div className="card person">
        <div className="avatar big">{initialsOf(person.name)}</div>
        <div className="person-info">
          <h3>{person.name}</h3>
          <p className="sub" style={{ margin: 0 }}>{person.email} · {kind === 'tech' ? 'Technician' : 'Employee'}</p>
          {kind === 'tech' && (
            <div className="person-meta">
              <span><Stars value={person.rating} size={15} /> <b>{person.rating.toFixed(2)}</b></span>
              <span>{plural(person.reviews, 'review')}</span>
              <span>{[...person.skills].join(', ') || 'No skills listed'}</span>
              <span className={'pill ' + (person.available ? 'done' : 'closed')}>{person.available ? 'Available' : 'Unavailable'}</span>
            </div>
          )}
        </div>
      </div>
      <div className="stats">
        <div className="stat"><span>{kind === 'tech' ? 'Incidents assigned' : 'Incidents reported'}</span><b>{list.length}</b></div>
        <div className="stat"><span>Open</span><b>{open.length}</b></div>
        <div className="stat"><span>Resolved</span><b>{done.length}</b></div>
        <div className={'stat' + (breached.length ? ' hot' : '')}><span>SLA breached</span><b>{breached.length}</b></div>
      </div>
      <div className="tabs">
        <button className={group === 'all' ? 'on' : ''} onClick={() => setGroup('all')}>All <span className="count">{list.length}</span></button>
        <button className={group === 'open' ? 'on' : ''} onClick={() => setGroup('open')}>Open <span className="count">{open.length}</span></button>
        <button className={group === 'done' ? 'on' : ''} onClick={() => setGroup('done')}>Resolved <span className="count">{done.length}</span></button>
      </div>
      <div className="card">
        <h3>Incident history</h3>
        <p className="sub">Click an incident to open it.</p>
        {err && <div className="error">{err}</div>}
        <div className="table-wrap"><table>
          <thead><tr><th>ID</th><th>Incident</th><th>Priority</th><th>Status</th><th>Service</th><th>{kind === 'tech' ? 'Reported by' : 'Technician'}</th><th>Reported on</th><th>SLA</th></tr></thead>
          <tbody>
            {shown.map((i) => {
              const sla = slaResult(i);
              return (
                <tr key={i.id} className="click" onClick={() => onOpenIncident(i.id)}>
                  <td className="ref">{ref(i)}</td>
                  <td><b>{i.title}</b>{i.escalationLevel > 0 && <span className="flag esc">Escalated</span>}</td>
                  <td><Priority p={i.priority} /></td><td><Status s={i.status} /></td>
                  <td>{i.service}</td>
                  <td>{kind === 'tech' ? i.reporter : (i.technician || <span className="muted">Unassigned</span>)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtShort(i.createdAt)}</td>
                  <td>{i.responseViolated || i.resolutionViolated ? <span className="bad">Breached</span> : sla ? <span className={sla.late ? 'bad' : 'ok'}>{sla.text}</span> : <span className="muted">Running</span>}</td>
                </tr>
              );
            })}
            {rows && shown.length === 0 && <tr><td colSpan={8} className="muted">No incidents here yet.</td></tr>}
            {!rows && !err && <tr><td colSpan={8} className="muted">Loading…</td></tr>}
          </tbody></table></div>
      </div>
    </>
  );
}

function AdminTools({ meta, onMetaChange, version, onOpenIncident }) {
  const [section, setSection] = useState('settings');
  const [panel, setPanel] = useState(null);
  const [person, setPerson] = useState(null);
  const [users, setUsers] = useState([]);
  const [techs, setTechs] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [strategy, setStrategy] = useState({ active: '', options: [] });
  const [violations, setViolations] = useState([]);
  const [all, setAll] = useState([]);
  const [cats, setCats] = useState([]);
  const [svcs, setSvcs] = useState([]);
  const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'TECHNICIAN', skills: '' });
  const [nc, setNc] = useState({ name: '', criticality: 3 });
  const [ns, setNs] = useState({ name: '', criticality: 3 });
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const load = useCallback(() => {
    api('/api/users').then(setUsers).catch((e) => setErr(e.message));
    api('/api/technicians').then(setTechs).catch(() => {});
    api('/api/sla/policies').then(setPolicies).catch(() => {});
    api('/api/config/assignment-strategy').then(setStrategy).catch(() => {});
    api('/api/sla/violations').then(setViolations).catch(() => {});
    api('/api/incidents').then(setAll).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load, version]);
  useEffect(() => { setCats(meta.categories); setSvcs(meta.services); }, [meta]);
  const run = async (fn, done) => { try { setErr(''); setNote(''); await fn(); load(); if (done) setNote(done); } catch (e) { setErr(e.message); } };
  const setPol = (p, k, v) => setPolicies(policies.map((x) => (x.priority === p ? { ...x, [k]: +v } : x)));
  const setVerified = (u, verified) => run(() => api(`/api/users/${u.id}/verified`, { method: 'PUT', body: { verified } }));
  const employees = users.filter((u) => u.role === 'EMPLOYEE');
  const pending = employees.filter((u) => u.verified === false);
  const admins = users.filter((u) => u.role === 'ADMIN');
  const escalated = all.filter((i) => i.escalationLevel > 0 && OPEN_STATUSES.includes(i.status));
  const goSection = (s) => { setSection(s); setPanel(null); setPerson(null); setErr(''); setNote(''); };
  const goPanel = (p) => { setPanel(p); setPerson(null); setErr(''); setNote(''); };
  // Keep the open person in step with refreshed technician data (rating, availability).
  const personNow = person && (person.kind === 'tech' ? techs.find((t) => t.id === person.data.id) || person.data : person.data);

  const settingTiles = [
    { key: 'services', icon: 'server', title: 'Service impact weights', blurb: 'How badly an incident on each IT service hurts the business.', meta: plural(svcs.length, 'service') },
    { key: 'categories', icon: 'tag', title: 'Category criticality weights', blurb: 'How business-critical each kind of problem is.', meta: plural(cats.length, 'category').replace('categorys', 'categories') },
    { key: 'strategy', icon: 'route', title: 'Assignment strategy', blurb: 'How new incidents are matched to a technician.', meta: strategy.active ? label(strategy.active) : null },
    { key: 'sla', icon: 'clock', title: 'SLA policies', blurb: 'Response and resolution time limits for each priority.', meta: plural(policies.length, 'policy').replace('policys', 'policies') },
  ];
  const peopleTiles = [
    { key: 'pending', icon: 'usercheck', title: 'Waiting for verification', blurb: 'Employees who signed up and need your approval.', meta: pending.length ? `${pending.length} to verify` : 'Nobody waiting', alert: pending.length > 0 },
    { key: 'employees', icon: 'users', title: 'Employees', blurb: 'Accounts and the incidents each employee reported.', meta: plural(employees.length, 'employee') },
    { key: 'technicians', icon: 'tool', title: 'Technicians', blurb: 'Workload, ratings and each technician’s incidents.', meta: plural(techs.length, 'technician') },
    { key: 'admins', icon: 'shield', title: 'Administrators', blurb: 'People who can manage this service desk.', meta: plural(admins.length, 'administrator') },
    { key: 'add', icon: 'userplus', title: 'Add a user', blurb: 'Create an employee, technician or administrator account.', meta: null },
  ];
  const nameBtn = (u, kind) => <button className="linkbtn person-link" onClick={() => setPerson({ kind, data: u })}>{u.name}</button>;
  const settingsBack = <PanelHead back="All settings" onBack={() => goPanel(null)} />;
  const peopleBack = <PanelHead back="All people" onBack={() => goPanel(null)} />;

  return (
    <>
      <div className="tabs">
        <button className={section === 'settings' ? 'on' : ''} onClick={() => goSection('settings')}>Settings</button>
        <button className={section === 'people' ? 'on' : ''} onClick={() => goSection('people')}>People {pending.length > 0 && <span className="count alert">{pending.length} to verify</span>}</button>
        <button className={section === 'monitoring' ? 'on' : ''} onClick={() => goSection('monitoring')}>Monitoring</button>
        <button className={section === 'audit' ? 'on' : ''} onClick={() => goSection('audit')}>Audit log</button>
      </div>
      {err && <div className="error">{err}</div>}
      {note && <div className="banner info" style={{ marginTop: 0 }}>{note}</div>}

      {section === 'audit' && <AuditLogView onOpenIncident={onOpenIncident} version={version} />}

      {section === 'settings' && !panel && <TileGrid tiles={settingTiles} onPick={goPanel} />}

      {section === 'settings' && panel === 'services' && (
        <>
          {settingsBack}
          <WeightTable title="Service impact weights" sub="How badly an incident on this service hurts the business. Changing a weight affects new and edited incidents only." rows={svcs} setRows={setSvcs} saveUrl={(id) => `/api/services/${id}/weight`} onSaved={onMetaChange} run={run} />
          <form className="card" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/services', { method: 'POST', body: { ...ns, criticality: +ns.criticality } }); setNs({ name: '', criticality: 3 }); onMetaChange(); }, 'Service added.'); }}>
            <h3>Add a service</h3>
            <div className="row" style={{ marginTop: 10 }}>
              <label>Name<input required value={ns.name} onChange={(e) => setNs({ ...ns, name: e.target.value })} /></label>
              <label>Impact weight<input type="number" min={1} max={5} value={ns.criticality} onChange={(e) => setNs({ ...ns, criticality: e.target.value })} /></label>
              <button className="btn" style={{ flex: '0 0 auto' }}>Add</button>
            </div>
          </form>
        </>
      )}

      {section === 'settings' && panel === 'categories' && (
        <>
          {settingsBack}
          <WeightTable title="Category criticality weights" sub="How business-critical this kind of problem is. Changing a weight affects new and edited incidents only." rows={cats} setRows={setCats} saveUrl={(id) => `/api/categories/${id}/weight`} onSaved={onMetaChange} run={run} />
          <form className="card" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/categories', { method: 'POST', body: { ...nc, criticality: +nc.criticality } }); setNc({ name: '', criticality: 3 }); onMetaChange(); }, 'Category added.'); }}>
            <h3>Add a category</h3>
            <div className="row" style={{ marginTop: 10 }}>
              <label>Name<input required value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /></label>
              <label>Criticality weight<input type="number" min={1} max={5} value={nc.criticality} onChange={(e) => setNc({ ...nc, criticality: e.target.value })} /></label>
              <button className="btn" style={{ flex: '0 0 auto' }}>Add</button>
            </div>
          </form>
        </>
      )}

      {section === 'settings' && panel === 'strategy' && (
        <>
          {settingsBack}
          <div className="card">
            <h3>Technician assignment strategy</h3>
            <p className="sub">Skill based picks a matching technician with the lowest workload. Load based picks the least busy available technician.</p>
            <select style={{ maxWidth: 280 }} value={strategy.active} onChange={(e) => run(async () => setStrategy(await api('/api/config/assignment-strategy', { method: 'PUT', body: { strategy: e.target.value } })), 'Assignment strategy saved.')}>
              {strategy.options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
            </select>
          </div>
        </>
      )}

      {section === 'settings' && panel === 'sla' && (
        <>
          {settingsBack}
          <div className="card">
            <h3>SLA policies</h3>
            <p className="sub">Minutes. Unacknowledged P1 and P2 incidents escalate to administrators after the response time, then to IT management and another technician after a second response window.</p>
            <div className="table-wrap"><table>
              <thead><tr><th>Priority</th><th>Respond within</th><th>Resolve within</th><th></th></tr></thead>
              <tbody>{policies.map((p) => (
                <tr key={p.priority}><td><Priority p={p.priority} /></td>
                  <td><input type="number" min={1} value={p.responseMinutes} onChange={(e) => setPol(p.priority, 'responseMinutes', e.target.value)} /></td>
                  <td><input type="number" min={1} value={p.resolutionMinutes} onChange={(e) => setPol(p.priority, 'resolutionMinutes', e.target.value)} /></td>
                  <td><button className="btn alt small" onClick={() => run(() => api('/api/sla/policies/' + p.priority, { method: 'PUT', body: { responseMinutes: p.responseMinutes, resolutionMinutes: p.resolutionMinutes } }), `${p.priority} policy saved.`)}>Save</button></td></tr>
              ))}</tbody></table></div>
          </div>
        </>
      )}

      {section === 'people' && person && (
        <PersonHistory person={personNow} kind={person.kind} onBack={() => setPerson(null)} onOpenIncident={onOpenIncident} version={version} />
      )}

      {section === 'people' && !person && !panel && <TileGrid tiles={peopleTiles} onPick={goPanel} />}

      {section === 'people' && !person && panel === 'pending' && (
        <>
          {peopleBack}
          <div className="card">
            <h3>Waiting for verification</h3>
            <p className="sub">Employees who signed up themselves cannot report incidents until you verify them. Verifying also accepts their email address.</p>
            <div className="table-wrap"><table>
              <thead><tr><th>Name</th><th>Email</th><th>Email check</th><th style={{ width: 120 }}></th></tr></thead>
              <tbody>
                {pending.map((u) => (
                  <tr key={u.id}><td>{nameBtn(u, 'employee')}</td><td>{u.email}</td><td>{u.emailConfirmed === false ? <span className="bad">Not confirmed</span> : <span className="ok">Confirmed</span>}</td><td><button className="btn small" onClick={() => setVerified(u, true)}>Verify</button></td></tr>
                ))}
                {pending.length === 0 && <tr><td colSpan={4} className="muted">Nobody is waiting for verification.</td></tr>}
              </tbody></table></div>
          </div>
        </>
      )}

      {section === 'people' && !person && panel === 'employees' && (
        <>
          {peopleBack}
          <div className="card">
            <h3>Employees</h3>
            <p className="sub">Click a name to see every incident that employee reported.</p>
            <div className="table-wrap"><table>
              <thead><tr><th>Name</th><th>Email</th><th>Email check</th><th>Account</th><th style={{ width: 150 }}></th></tr></thead>
              <tbody>
                {employees.map((u) => (
                  <tr key={u.id}><td>{nameBtn(u, 'employee')}</td><td>{u.email}</td>
                    <td>{u.emailConfirmed === false ? <span className="bad">Not confirmed</span> : 'Confirmed'}</td>
                    <td><span className={'pill ' + (u.verified === false ? 'wait' : 'done')}>{u.verified === false ? 'Pending' : 'Verified'}</span></td>
                    <td>{u.verified === false
                      ? <button className="btn small" onClick={() => setVerified(u, true)}>Verify</button>
                      : <button className="btn alt small" onClick={() => setVerified(u, false)}>Revoke</button>}</td></tr>
                ))}
                {employees.length === 0 && <tr><td colSpan={5} className="muted">No employees yet.</td></tr>}
              </tbody></table></div>
          </div>
        </>
      )}

      {section === 'people' && !person && panel === 'technicians' && (
        <>
          {peopleBack}
          <div className="card">
            <h3>Technicians</h3>
            <p className="sub">Click a name to see every incident assigned to that technician.</p>
            <div className="table-wrap"><table>
              <thead><tr><th>Name</th><th>Email</th><th>Skills</th><th>Active incidents</th><th>Rating</th><th>Availability</th></tr></thead>
              <tbody>
                {techs.map((t) => (
                  <tr key={t.id}><td>{nameBtn(t, 'tech')}</td><td>{t.email}</td><td>{[...t.skills].join(', ') || '-'}</td><td>{t.activeIncidents}</td>
                    <td><b>{t.rating.toFixed(2)}</b> <span className="hint">({plural(t.reviews, 'review')}, {plural(t.slaViolations, 'SLA violation')})</span></td>
                    <td><button className="btn alt small" onClick={() => run(() => api(`/api/users/${t.id}/technician`, { method: 'PUT', body: { available: !t.available } }))}>{t.available ? 'Available (pause)' : 'Unavailable (enable)'}</button></td></tr>
                ))}
                {techs.length === 0 && <tr><td colSpan={6} className="muted">No technicians yet.</td></tr>}
              </tbody></table></div>
          </div>
        </>
      )}

      {section === 'people' && !person && panel === 'admins' && (
        <>
          {peopleBack}
          <div className="card">
            <h3>Administrators</h3>
            <div className="table-wrap" style={{ marginTop: 10 }}><table>
              <thead><tr><th>Name</th><th>Email</th></tr></thead>
              <tbody>{admins.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td></tr>)}</tbody></table></div>
          </div>
        </>
      )}

      {section === 'people' && !person && panel === 'add' && (
        <>
          {peopleBack}
          <div className="card">
            <h3>Add a user</h3>
            <p className="sub">Users you add are verified right away.</p>
            <form className="row" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/users', { method: 'POST', body: { ...nu, skills: nu.skills.split(',').map((s) => s.trim()).filter(Boolean) } }); setNu({ ...nu, name: '', email: '', password: '', skills: '' }); }, 'User added.'); }}>
              <label>Name<input required value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} /></label>
              <label>Email<input required type="email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} /></label>
              <label>Password<input required minLength={6} value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /></label>
              <label>Role<select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>{['EMPLOYEE', 'TECHNICIAN', 'ADMIN'].map((r) => <option key={r}>{r}</option>)}</select></label>
              <label>Skills (category names, comma separated)<input value={nu.skills} onChange={(e) => setNu({ ...nu, skills: e.target.value })} /></label>
              <button className="btn" style={{ flex: '0 0 auto' }}>Add user</button>
            </form>
          </div>
        </>
      )}

      {section === 'monitoring' && (
        <>
          <div className="card">
            <h3>SLA violations</h3>
            <div className="table-wrap" style={{ marginTop: 10 }}><table>
              <thead><tr><th>ID</th><th>Title</th><th>Priority</th><th>Response</th><th>Resolution</th></tr></thead>
              <tbody>{violations.map((v) => (
                <tr key={v.id} className="click" onClick={() => onOpenIncident(v.id)}><td className="ref">{ref(v)}</td><td>{v.title}</td><td><Priority p={v.priority} /></td>
                  <td>{v.responseViolated ? <span className="bad">Breached</span> : 'OK'}</td><td>{v.resolutionViolated ? <span className="bad">Breached</span> : 'OK'}</td></tr>
              ))}{violations.length === 0 && <tr><td colSpan={5} className="muted">No SLA breaches recorded.</td></tr>}</tbody></table></div>
          </div>
          <div className="card">
            <h3>Escalated incidents</h3>
            <p className="sub">Open incidents that were not acknowledged in time.</p>
            <div className="table-wrap"><table>
              <thead><tr><th>ID</th><th>Title</th><th>Priority</th><th>Level</th><th>Technician</th></tr></thead>
              <tbody>{escalated.map((i) => (
                <tr key={i.id} className="click" onClick={() => onOpenIncident(i.id)}><td className="ref">{ref(i)}</td><td>{i.title}</td><td><Priority p={i.priority} /></td><td>{i.escalationLevel}</td><td>{i.technician || 'Unassigned'}</td></tr>
              ))}{escalated.length === 0 && <tr><td colSpan={5} className="muted">No open incidents are escalated.</td></tr>}</tbody></table></div>
          </div>
        </>
      )}
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
const readCollapsed = () => { try { return localStorage.getItem('sideCollapsed') === '1'; } catch { return false; } };

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [meta, setMeta] = useState({ categories: [], services: [] });
  const [techs, setTechs] = useState([]);
  const [tab, setTab] = useState('mine');
  const [openId, setOpenId] = useState(null);
  const [version, setVersion] = useState(0);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const bump = () => setVersion((v) => v + 1);
  const toggleSide = () => setCollapsed((c) => { try { localStorage.setItem('sideCollapsed', c ? '0' : '1'); } catch { /* storage unavailable */ } return !c; });
  const loadMeta = useCallback(async () => {
    const [categories, services] = await Promise.all([api('/api/categories'), api('/api/services')]);
    setMeta({ categories, services });
  }, []);
  useEffect(() => {
    if (!user) return undefined;
    loadMeta().catch(() => {});
    if (user.role === 'ADMIN') api('/api/technicians').then(setTechs).catch(() => {});
    // Pick up changes made by an administrator (for example this employee being verified).
    const refreshMe = () => api('/api/me').then((u) => {
      if (u.verified !== user.verified || u.role !== user.role) { localStorage.setItem('user', JSON.stringify(u)); setUser(u); }
    }).catch(() => {});
    refreshMe();
    const t = setInterval(() => { bump(); refreshMe(); }, 10000);
    return () => clearInterval(t);
  }, [user, loadMeta]);
  if (!user) return <Login onAuth={setUser} />;
  const go = (t) => { setTab(t); setOpenId(null); };
  const unverified = user.role === 'EMPLOYEE' && user.verified === false;
  const tabs = [['mine', 'My incidents', 'list']];
  if (user.role !== 'EMPLOYEE') tabs.push(['all', 'All incidents', 'layers']);
  if (user.role !== 'TECHNICIAN' && !unverified) tabs.push(['report', 'Report incident', 'plus']);
  if (user.role === 'ADMIN') tabs.push(['admin', 'Administration', 'sliders']);
  const title = openId ? 'Incident details' : tab === 'report' ? 'Report an incident' : tab === 'admin' ? 'Administration' : tab === 'all' ? 'All incidents' : 'My incidents';
  const initials = initialsOf(user.name);
  return (
    <div className={'app' + (collapsed ? ' collapsed' : '')}>
      <aside className="side">
        <div className="brand">
          <span className="mark">IT</span>
          <div className="lbl"><b>I-ITSM</b><small>Service Desk</small></div>
          <button className="side-toggle" onClick={toggleSide} title={collapsed ? 'Expand sidebar' : 'Minimise sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Minimise sidebar'} aria-expanded={!collapsed}><Icon name="panel" /></button>
        </div>
        <nav>{tabs.map(([k, t, ic]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)} title={collapsed ? t : undefined}><Icon name={ic} /><span className="lbl">{t}</span></button>)}</nav>
        <div className="me">
          <div className="avatar" title={collapsed ? user.name : undefined}>{initials}</div>
          <div className="lbl"><b>{user.name}</b><small>{label(user.role)}</small></div>
          <button title="Sign out" aria-label="Sign out" onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); }}><Icon name="logout" /></button>
        </div>
      </aside>
      <div className="content">
        <div className="topbar"><div className="topbar-in"><h2>{title}</h2><Bell /></div></div>
        <main>
          {unverified && <div className="banner warn" style={{ marginTop: 0 }}>Your account is waiting for administrator verification. You can look around, but you cannot report incidents until an administrator verifies you. This page updates by itself once that happens.</div>}
          {tab === 'report' && !unverified && <ReportForm meta={meta} onDone={(id) => { bump(); setTab('mine'); setOpenId(id); }} />}
          {tab === 'admin' && (
            <div hidden={!!openId}>
              <AdminTools meta={meta} onMetaChange={loadMeta} version={version} onOpenIncident={setOpenId} />
            </div>
          )}
          {tab === 'admin' && openId && <Detail id={openId} user={user} onBack={() => setOpenId(null)} onChanged={bump} onOpen={setOpenId} version={version} backLabel="Back to administration" />}
          {tab === 'mine' && user.role === 'TECHNICIAN' && !openId && <RatingCard version={version} />}
          {(tab === 'mine' || tab === 'all') && (openId
            ? <Detail id={openId} user={user} onBack={() => setOpenId(null)} onChanged={bump} onOpen={setOpenId} version={version} />
            : <IncidentList user={user} meta={meta} techs={techs} onOpen={setOpenId} version={version} scope={tab} />)}
        </main>
      </div>
    </div>
  );
}
