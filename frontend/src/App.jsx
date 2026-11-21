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
function Detail({ id, user, onBack, onChanged, onOpen, version }) {
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
    try { setErr(''); await api(`/api/incidents/${id}/${path}`, { method: 'POST', body }); setText(''); setInfoText(''); setConfirming(false); setRating(0); setComment(''); await load(); onChanged(); }
    catch (e) { setErr(e.message); }
    finally { busy.current = false; }
  };
  if (!i) return <div className="card">{err ? <div className="error">{err}</div> : 'Loading…'}</div>;
  const isTech = user.role === 'TECHNICIAN' && i.technicianId === user.id;
  const reporterOrAdmin = user.role === 'ADMIN' || user.role === 'EMPLOYEE';
  const isReporter = i.reporterId === user.id;
  const canEdit = (user.role === 'ADMIN' || isReporter) && ['NEW', 'CLASSIFIED', 'PRIORITIZED', 'ASSIGNED'].includes(i.status);
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
  return (
    <>
      <button className="btn alt small" onClick={onBack} style={{ marginBottom: 14 }}>Back to incidents</button>
      <div className="cols">
        <div>
          <div className="card">
            <div className="titlebar"><h3><span className="ref">{ref(i)}</span> {i.title}</h3><Priority p={i.priority} /><Status s={i.status} /></div>
            {i.duplicateOfId && <div className="banner info">This looks like a duplicate of open incident {i.duplicateOfReference || 'reported earlier'}. It has been linked so the team can handle both together.</div>}
            {i.escalationLevel > 0 && <div className="banner warn">Escalated (level {i.escalationLevel}) because it was not acknowledged in time.</div>}
            <div className="timers">
              <div className="timer"><span>Time to respond</span><Countdown deadline={i.responseDeadline} stopped={!!i.acknowledgedAt} violated={i.responseViolated} doneAt={i.acknowledgedAt} doneLabel="Acknowledged" /></div>
              <div className="timer"><span>Time to resolve</span><Countdown deadline={i.resolutionDeadline} stopped={!!i.resolvedAt} violated={i.resolutionViolated} doneAt={i.resolvedAt} doneLabel="Resolved" /></div>
            </div>
            <p style={{ margin: '4px 0 0' }}>{i.description}</p>
            <dl className="kv">
              <dt>Category</dt><dd>{i.category}</dd><dt>IT service</dt><dd>{i.service}</dd>
              <dt>Reported by</dt><dd>{i.reporter} on {fmt(i.createdAt)}</dd><dt>Technician</dt><dd>{i.technician || 'Not assigned yet'}</dd>
              {i.resolution && (<><dt>Resolution</dt><dd>{i.resolution}</dd></>)}
            </dl>
            {err && <div className="error">{err}</div>}

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
            {canEdit && !editing && <div className="actions"><button className="btn alt small" onClick={startEdit}>Edit incident</button><span className="hint">You can edit it until a technician acknowledges it.</span></div>}

            {user.role === 'ADMIN' && ['PRIORITIZED', 'ASSIGNED'].includes(i.status) && (
              <div className="row" style={{ marginTop: 14 }}>
                <label>Assign technician<select value={techId} onChange={(e) => setTechId(e.target.value)}><option value="">Use the active strategy</option>{techs.map((t) => <option key={t.id} value={t.id} disabled={!t.available}>{t.name} ({t.activeIncidents} active){t.available ? '' : ' - unavailable'}</option>)}</select></label>
                <button className="btn" style={{ flex: '0 0 auto' }} onClick={() => act('assign', { technicianId: techId ? +techId : null })}>{i.status === 'ASSIGNED' ? 'Reassign' : 'Assign'}</button>
              </div>
            )}
            {isTech && i.status === 'ASSIGNED' && <div className="actions"><button className="btn" onClick={() => act('acknowledge')}>Acknowledge</button></div>}
            {isTech && i.status === 'ACKNOWLEDGED' && <div className="actions"><button className="btn" onClick={() => act('start')}>Start investigation</button></div>}
            {isTech && ['ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(i.status) && (
              <div className="infobox">
                <label>Need more details from the reporter?<textarea placeholder="Write your question here" value={infoText} maxLength={2000} onChange={(e) => setInfoText(e.target.value)} /></label>
                <div className="actions"><button className="btn alt" disabled={!infoText.trim()} onClick={() => act('request-info', { text: infoText })}>Ask the reporter for information</button></div>
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
            {reporterOrAdmin && !['VERIFIED', 'CLOSED'].includes(i.status) && (
              <div className="infobox">
                {waitingForReply && <div className="banner info" style={{ margin: '0 0 10px' }}><b>The technician asked:</b> {lastInfo.description}</div>}
                <label>{waitingForReply ? 'Your reply' : 'Add more information (optional)'}<textarea value={infoText} maxLength={2000} onChange={(e) => setInfoText(e.target.value)} /></label>
                <div className="actions"><button className="btn alt" disabled={!infoText.trim()} onClick={() => act('info', { text: infoText })}>{waitingForReply ? 'Send reply' : 'Add information'}</button></div>
              </div>
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
            {user.role === 'ADMIN' && (
              <div className="actions"><button className="btn danger small" onClick={async () => { if (confirm('Delete this incident?')) { await api('/api/incidents/' + id, { method: 'DELETE' }); onChanged(); onBack(); } }}>Delete incident</button></div>
            )}
          </div>

          {i.rating != null && (
            <div className="card">
              <h3>Employee feedback</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}><Stars value={i.rating} size={22} /><b>{i.rating} / 5</b></div>
              {i.feedback ? <p style={{ margin: '8px 0 0' }}>{i.feedback}</p> : <p className="hint" style={{ margin: '8px 0 0' }}>No written comment.</p>}
              <p className="hint" style={{ margin: '6px 0 0' }}>Given on {fmt(i.ratedAt)}</p>
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
                    <td className="ref">{ref(r)}</td><td><b>{r.title}</b></td><td><Priority p={r.priority} /></td><td><Status s={r.status} /></td>
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

function RatingCard({ version }) {
  const [r, setR] = useState(null);
  useEffect(() => { api('/api/ratings/me').then(setR).catch(() => {}); }, [version]);
  if (!r) return null;
  return (
    <div className="card rating-card">
      <div className="score"><b>{r.score.toFixed(2)}</b><Stars value={r.score} size={22} /></div>
      <div>
        <h3>Your rating</h3>
        <p className="sub" style={{ margin: 0 }}>
          The average of your starting rating ({r.initial.toFixed(1)}) and {r.reviews} employee rating{r.reviews === 1 ? '' : 's'} is {r.average.toFixed(2)}.
          {r.slaViolations > 0 ? ` ${r.penalty.toFixed(2)} was deducted for ${r.slaViolations} SLA violation${r.slaViolations === 1 ? '' : 's'}.` : ' You have no SLA violations.'}
        </p>
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

function AdminTools({ meta, onMetaChange, version, onOpenIncident }) {
  const [section, setSection] = useState('settings');
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
  const run = async (fn) => { try { setErr(''); await fn(); load(); } catch (e) { setErr(e.message); } };
  const setPol = (p, k, v) => setPolicies(policies.map((x) => (x.priority === p ? { ...x, [k]: +v } : x)));
  const setVerified = (u, verified) => run(() => api(`/api/users/${u.id}/verified`, { method: 'PUT', body: { verified } }));
  const employees = users.filter((u) => u.role === 'EMPLOYEE');
  const pending = employees.filter((u) => u.verified === false);
  const admins = users.filter((u) => u.role === 'ADMIN');
  const escalated = all.filter((i) => i.escalationLevel > 0 && OPEN_STATUSES.includes(i.status));
  return (
    <>
      <div className="tabs">
        <button className={section === 'settings' ? 'on' : ''} onClick={() => setSection('settings')}>Settings</button>
        <button className={section === 'people' ? 'on' : ''} onClick={() => setSection('people')}>People {pending.length > 0 && <span className="count alert">{pending.length} to verify</span>}</button>
        <button className={section === 'monitoring' ? 'on' : ''} onClick={() => setSection('monitoring')}>Monitoring</button>
        <button className={section === 'audit' ? 'on' : ''} onClick={() => setSection('audit')}>Audit log</button>
      </div>
      {err && <div className="error">{err}</div>}

      {section === 'audit' && <AuditLogView onOpenIncident={onOpenIncident} version={version} />}

      {section === 'settings' && (
        <>
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
        </>
      )}

      {section === 'people' && (
        <>
          <div className="card">
            <h3>Waiting for verification</h3>
            <p className="sub">Employees who signed up themselves cannot report incidents until you verify them. Verifying also accepts their email address.</p>
            <div className="table-wrap"><table>
              <thead><tr><th>Name</th><th>Email</th><th>Email check</th><th style={{ width: 120 }}></th></tr></thead>
              <tbody>
                {pending.map((u) => (
                  <tr key={u.id}><td><b>{u.name}</b></td><td>{u.email}</td><td>{u.emailConfirmed === false ? <span className="bad">Not confirmed</span> : <span className="ok">Confirmed</span>}</td><td><button className="btn small" onClick={() => setVerified(u, true)}>Verify</button></td></tr>
                ))}
                {pending.length === 0 && <tr><td colSpan={4} className="muted">Nobody is waiting for verification.</td></tr>}
              </tbody></table></div>
          </div>

          <div className="card">
            <h3>Employees</h3>
            <div className="table-wrap" style={{ marginTop: 10 }}><table>
              <thead><tr><th>Name</th><th>Email</th><th>Email check</th><th>Account</th><th style={{ width: 150 }}></th></tr></thead>
              <tbody>
                {employees.map((u) => (
                  <tr key={u.id}><td>{u.name}</td><td>{u.email}</td>
                    <td>{u.emailConfirmed === false ? <span className="bad">Not confirmed</span> : 'Confirmed'}</td>
                    <td><span className={'pill ' + (u.verified === false ? 'wait' : 'done')}>{u.verified === false ? 'Pending' : 'Verified'}</span></td>
                    <td>{u.verified === false
                      ? <button className="btn small" onClick={() => setVerified(u, true)}>Verify</button>
                      : <button className="btn alt small" onClick={() => setVerified(u, false)}>Revoke</button>}</td></tr>
                ))}
                {employees.length === 0 && <tr><td colSpan={5} className="muted">No employees yet.</td></tr>}
              </tbody></table></div>
          </div>

          <div className="card">
            <h3>Technicians</h3>
            <div className="table-wrap" style={{ marginTop: 10 }}><table>
              <thead><tr><th>Name</th><th>Email</th><th>Skills</th><th>Active incidents</th><th>Rating</th><th>Availability</th></tr></thead>
              <tbody>
                {techs.map((t) => (
                  <tr key={t.id}><td>{t.name}</td><td>{t.email}</td><td>{[...t.skills].join(', ') || '-'}</td><td>{t.activeIncidents}</td>
                    <td><b>{t.rating.toFixed(2)}</b> <span className="hint">({t.reviews} review{t.reviews === 1 ? '' : 's'}, {t.slaViolations} SLA violation{t.slaViolations === 1 ? '' : 's'})</span></td>
                    <td><button className="btn alt small" onClick={() => run(() => api(`/api/users/${t.id}/technician`, { method: 'PUT', body: { available: !t.available } }))}>{t.available ? 'Available (pause)' : 'Unavailable (enable)'}</button></td></tr>
                ))}
                {techs.length === 0 && <tr><td colSpan={6} className="muted">No technicians yet.</td></tr>}
              </tbody></table></div>
          </div>

          <div className="card">
            <h3>Administrators</h3>
            <div className="table-wrap" style={{ marginTop: 10 }}><table>
              <thead><tr><th>Name</th><th>Email</th></tr></thead>
              <tbody>{admins.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td></tr>)}</tbody></table></div>
          </div>

          <div className="card">
            <h3>Add a user</h3>
            <p className="sub">Users you add are verified right away.</p>
            <form className="row" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/users', { method: 'POST', body: { ...nu, skills: nu.skills.split(',').map((s) => s.trim()).filter(Boolean) } }); setNu({ ...nu, name: '', email: '', password: '', skills: '' }); }); }}>
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
                <tr key={v.id}><td className="ref">{ref(v)}</td><td>{v.title}</td><td><Priority p={v.priority} /></td>
                  <td>{v.responseViolated ? <span className="bad">Breached</span> : 'OK'}</td><td>{v.resolutionViolated ? <span className="bad">Breached</span> : 'OK'}</td></tr>
              ))}{violations.length === 0 && <tr><td colSpan={5} className="muted">No SLA breaches recorded.</td></tr>}</tbody></table></div>
          </div>
          <div className="card">
            <h3>Escalated incidents</h3>
            <p className="sub">Open incidents that were not acknowledged in time.</p>
            <div className="table-wrap"><table>
              <thead><tr><th>ID</th><th>Title</th><th>Priority</th><th>Level</th><th>Technician</th></tr></thead>
              <tbody>{escalated.map((i) => (
                <tr key={i.id}><td className="ref">{ref(i)}</td><td>{i.title}</td><td><Priority p={i.priority} /></td><td>{i.escalationLevel}</td><td>{i.technician || 'Unassigned'}</td></tr>
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
export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [meta, setMeta] = useState({ categories: [], services: [] });
  const [techs, setTechs] = useState([]);
  const [tab, setTab] = useState('mine');
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
  const title = tab === 'report' ? 'Report an incident' : tab === 'admin' ? 'Administration' : openId ? 'Incident details' : tab === 'all' ? 'All incidents' : 'My incidents';
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
          {unverified && <div className="banner warn" style={{ marginTop: 0 }}>Your account is waiting for administrator verification. You can look around, but you cannot report incidents until an administrator verifies you. This page updates by itself once that happens.</div>}
          {tab === 'report' && !unverified && <ReportForm meta={meta} onDone={(id) => { bump(); setTab('mine'); setOpenId(id); }} />}
          {tab === 'admin' && <AdminTools meta={meta} onMetaChange={loadMeta} version={version} onOpenIncident={(id) => { setTab('all'); setOpenId(id); }} />}
          {tab === 'mine' && user.role === 'TECHNICIAN' && !openId && <RatingCard version={version} />}
          {(tab === 'mine' || tab === 'all') && (openId
            ? <Detail id={openId} user={user} onBack={() => setOpenId(null)} onChanged={bump} onOpen={setOpenId} version={version} />
            : <IncidentList user={user} meta={meta} techs={techs} onOpen={setOpenId} version={version} scope={tab} />)}
        </main>
      </div>
    </div>
  );
}
