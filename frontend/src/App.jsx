import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";

const CATEGORIES = ["Academic", "Infrastructure", "Electrical", "Cleanliness", "Hostel", "Transport", "Safety", "Other"];
const STATUSES = ["Pending", "In Progress", "Resolved"];
const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" }
});

async function sendRequest(path, options = {}) {
  try {
    const response = await api.request({ url: path, ...options });
    return response.data;
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error;
    const message = error.response?.data?.error || error.message || "Something went wrong.";
    const requestError = new Error(message);
    requestError.status = error.response?.status;
    throw requestError;
  }
}

function request(path, options = {}) { return sendRequest(`/complaints${path}`, options); }
function authRequest(path, options = {}) { return sendRequest(`/auth${path}`, options); }

function statusClass(status) {
  return status.toLowerCase().replace(" ", "-");
}

function App() {
  const [page, setPage] = useState("landing");
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, resolved: 0 });
  const [connectionStatus, setConnectionStatus] = useState("checking");
  const [filters, setFilters] = useState({ category: "", status: "" });
  const [search, setSearch] = useState("");
  const [searchId, setSearchId] = useState("");
  const [tracked, setTracked] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ studentName: "", department: "", category: "Auto-detect", description: "" });
  const [adminCredentials, setAdminCredentials] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const loadSequence = useRef(0);

  const loadComplaints = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (page === "admin" && filters.category) query.set("category", filters.category);
      if (page === "admin" && filters.status) query.set("status", filters.status);
      if (page === "admin" && search.trim()) query.set("q", search.trim());
      const rows = await request(`?${query.toString()}`);
      if (sequence !== loadSequence.current) return;
      setComplaints(rows);
      setConnectionStatus("connected");
      const currentStats = await request("/stats");
      if (sequence !== loadSequence.current) return;
      setStats(currentStats);
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      setConnectionStatus("disconnected");
      if (err.status === 401 && page === "admin") {
        setAuthError("Your staff session expired. Please sign in again.");
        setPage("admin-login");
      } else {
        setError(err.message);
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [filters, page, search]);

  useEffect(() => {
    if (page === "admin") loadComplaints();
  }, [loadComplaints, page]);

  async function signInAsAdmin(event) {
    event.preventDefault();
    setAuthError("");
    setAuthSubmitting(true);
    try {
      await authRequest("/login", {
        method: "POST",
        data: adminCredentials
      });
      setAdminCredentials({ email: "", password: "" });
      setPage("admin");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function signOutAsAdmin() {
    setError("");
    try {
      await authRequest("/logout", { method: "POST" });
      setComplaints([]);
      setSelected(null);
      setPage("landing");
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitComplaint(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const created = await request("", { method: "POST", data: form });
      setForm({ studentName: "", department: "", category: "Auto-detect", description: "" });
      setNotice(`Complaint submitted. Your tracking ID is ${created.complaintId}.`);
      setSearch("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function searchComplaint(event) {
    event.preventDefault();
    if (!searchId.trim()) return;
    setError("");
    setNotice("");
    try {
      const found = await request(`/${encodeURIComponent(searchId.trim())}`);
      setTracked(found);
      setNotice(`Found ${found.complaintId}.`);
    } catch (err) {
      setTracked(null);
      setError(err.message);
    }
  }

  async function updateStatus(complaintId, status) {
    setError("");
    setNotice("");
    try {
      const updated = await request(`/${encodeURIComponent(complaintId)}/status`, {
        method: "PATCH",
        data: { status }
      });
      setSelected((current) => current && current.complaintId === complaintId ? updated : current);
      setNotice(`${complaintId} updated to ${status}.`);
      await loadComplaints();
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateComplaint(complaintId, values) {
    setError("");
    setNotice("");
    try {
      const updated = await request(`/${encodeURIComponent(complaintId)}`, {
        method: "PUT",
        data: values
      });
      setSelected(updated);
      setTracked((current) => current && current.complaintId === complaintId ? updated : current);
      setNotice(`${complaintId} details updated.`);
      await loadComplaints();
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  async function deleteComplaint(complaintId) {
    if (!window.confirm(`Permanently delete complaint ${complaintId}?`)) return;
    setError("");
    try {
      await request(`/${encodeURIComponent(complaintId)}`, { method: "DELETE" });
      setNotice(`${complaintId} deleted.`);
      setSelected(null);
      await loadComplaints();
    } catch (err) {
      setError(err.message);
    }
  }

  if (page === "landing") {
    return <LandingPage onStudent={() => setPage("student")} onAdmin={() => setPage("admin-login")} />;
  }

  if (page === "admin-login") {
    return (
      <AdminLogin
        credentials={adminCredentials}
        onChange={setAdminCredentials}
        onSubmit={signInAsAdmin}
        error={authError}
        submitting={authSubmitting}
        onHome={() => { setAuthError(""); setPage("landing"); }}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("landing"); }}>
          <span className="brand-mark">✳</span>
          <span>Complaint<span className="brand-light">Desk</span><small>STUDENT & STAFF SUPPORT</small></span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <button className={`nav-item ${page === "student" ? "active" : ""}`} onClick={() => setPage("student")}><span className="nav-icon">＋</span> Student portal</button>
        <button className={`nav-item ${page === "admin" ? "active" : ""}`} onClick={() => setPage(page === "admin" ? "admin" : "admin-login")}><span className="nav-icon">▦</span> Staff dashboard</button>
        <div className="sidebar-note">
          <span className="note-icon">✦</span>
          <strong>Campus, made better.</strong>
          <p>Every report helps make our campus a better place to learn.</p>
        </div>
        <div className="profile"><span className="avatar">SC</span><span><b>Campus support</b><small>Student services</small></span><span className="profile-dots">···</span></div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">Complaint Desk <span>/</span> {page === "student" ? "Complaint desk" : "Staff dashboard"}</div>
          <div className="top-actions">{page === "admin" && <span className={`system-state ${connectionStatus}`}><i /> {connectionStatus === "connected" ? "Live system" : connectionStatus === "checking" ? "Connecting" : "Offline"}</span>}{page === "admin" ? <button className="logout-button" onClick={signOutAsAdmin}>Sign out</button> : <span className="top-avatar">SC</span>}</div>
        </header>

        <div className="page-wrap">
          {error && <div className="alert error-alert" role="alert"><span>!</span>{error}<button onClick={() => setError("")}>×</button></div>}
          {notice && <div className="alert success-alert" role="status"><span>✓</span>{notice}<button onClick={() => setNotice("")}>×</button></div>}

          {page === "student" ? (
            <>
              <section className="welcome-row">
                <div><div className="eyebrow">CAMPUS COMPLAINT DESK</div><h1>Your campus complaint desk.</h1><p>Report an issue, track your complaint, and see status updates in one place.</p></div>
                <button className="back-home-button" onClick={() => setPage("landing")}>← Back to home</button>
              </section>
              <section className="student-grid">
                <div className="panel form-panel">
                  <div className="panel-heading"><div><div className="eyebrow">WE’RE LISTENING</div><h2>Submit a complaint</h2></div><span className="heading-icon">↗</span></div>
                  <form onSubmit={submitComplaint}>
                    <div className="form-grid">
                      <label>Student name<input required minLength="2" maxLength="100" placeholder="e.g. Alex Johnson" value={form.studentName} onChange={(e) => setForm({ ...form, studentName: e.target.value })} /></label>
                      <label>Department<input required minLength="2" maxLength="100" placeholder="e.g. Computer Science" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label>
                    </div>
                    <label>Category <span className="optional">AI can suggest one</span>
                      <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                        <option>Auto-detect</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                      </select>
                    </label>
                    <label>Tell us what happened<textarea required minLength="10" maxLength="3000" rows="4" placeholder="Describe the issue and where it’s happening..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
                    <div className="ai-note"><span>✦</span><div><b>Smart assist is on</b><small>We’ll suggest a category, priority, and summary from your description.</small></div></div>
                    <button className="primary-button submit-button" type="submit" disabled={submitting}>{submitting ? <><span className="spinner" /> Sending...</> : <>Submit complaint <span>→</span></>}</button>
                  </form>
                </div>
                <div className="panel track-panel">
                  <div className="panel-heading"><div><div className="eyebrow">STAY IN THE LOOP</div><h2>Track a complaint</h2></div><span className="track-icon">⌕</span></div>
                  <p className="muted">Enter your complaint ID to check its latest status.</p>
                  <form className="search-form" onSubmit={searchComplaint}><input aria-label="Complaint ID" placeholder="e.g. SC-2026-A1B2C3D4" value={searchId} onChange={(e) => setSearchId(e.target.value)} /><button className="primary-button" type="submit">Search</button></form>
                  {tracked ? <ComplaintCard item={tracked} /> : <div className="track-empty"><span className="empty-search">⌕</span><b>Your complaint updates will show here</b><small>Use your complaint ID to check progress.</small></div>}
                  <div className="track-foot"><span>◷</span> Your complaint ID keeps status updates easy to find.</div>
                </div>
              </section>
              <section className="student-privacy-note"><span>✳</span><p><b>Your complaint details stay private.</b><small>Keep your complaint ID handy to check its status at any time.</small></p></section>
            </>
          ) : (
            <>
              <section className="admin-welcome"><div><div className="eyebrow">CAMPUS COMPLAINT DESK</div><h1>Complaint desk overview</h1><p>Review incoming complaints, update case status, and keep students informed.</p></div><button className="subtle-button" onClick={loadComplaints}>↻ Refresh data</button></section>
              <section className="stats-grid">
                <StatCard label="Total complaints" value={stats.total} icon="▤" tone="blue" />
                <StatCard label="Pending" value={stats.pending} icon="◷" tone="amber" />
                <StatCard label="In progress" value={stats.inProgress} icon="↗" tone="violet" />
                <StatCard label="Resolved" value={stats.resolved} icon="✓" tone="green" />
              </section>
              <section className="panel admin-table-panel">
                <div className="list-heading admin-list-heading"><div><div className="eyebrow">INBOX</div><h2>All complaints</h2></div><div className="filter-controls">
                  <label><span>Category</span><select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                  <label><span>Status</span><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
                  <label className="admin-search"><span>Search ID</span><input placeholder="SC-2026..." value={search} onChange={(e) => setSearch(e.target.value)} /></label>
                </div></div>
                <ComplaintTable items={complaints} loading={loading} admin onOpen={setSelected} onStatus={updateStatus} />
              </section>
            </>
          )}
        </div>
      </main>
      {selected && <DetailsModal item={selected} onClose={() => setSelected(null)} onStatus={updateStatus} onEdit={updateComplaint} onDelete={deleteComplaint} />}
    </div>
  );
}

function LandingPage({ onStudent, onAdmin }) {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <a className="landing-brand" href="#" onClick={(event) => event.preventDefault()}>
          <span className="landing-brand-mark">✳</span>
          <span>Complaint Desk</span>
        </a>
        <nav className="landing-links" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#report-process">How reports move</a>
        </nav>
        <div className="landing-nav-actions">
          <button className="text-button" onClick={onAdmin}>Staff sign in <span>↗</span></button>
          <button className="landing-nav-cta" onClick={onStudent}>File a complaint <span>→</span></button>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <div className="hero-kicker"><span /> CAMPUS COMPLAINT DESK</div>
            <h1>File a complaint.<br />Know what’s <em>next.</em></h1>
            <p>Use the campus complaint desk to report an issue, track its progress, and see staff updates.</p>
            <div className="hero-actions">
              <button className="hero-primary" onClick={onStudent}>File a complaint <span>↗</span></button>
              <a className="hero-secondary" href="#how-it-works">How the desk works <span>↓</span></a>
            </div>
            <div className="hero-trust"><div className="trust-avatars"><span>J</span><span>M</span><span>A</span></div><p><b>A clear place to report campus issues.</b><br />Track your complaint from submission to update.</p></div>
          </div>
          <div className="hero-art" role="img" aria-label="Illustration of a student complaint being received and reviewed">
            <div className="art-sun" />
            <div className="art-caption"><span className="caption-dot" /> COMPLAINT RECEIVED, NEXT STEPS CLEAR</div>
            <div className="art-paper">
              <div className="paper-top"><span>STUDENT COMPLAINT</span><span>№ 024</span></div>
              <div className="paper-icon">↗</div>
              <h2>“The courtyard<br />needs a little<br /><em>more light.”</em></h2>
              <div className="paper-rule" />
              <div className="paper-status"><span>✓</span><div><b>Received</b><small>Your complaint is in review.</small></div></div>
            </div>
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-sticker">YOUR<br />VOICE<br /><span>MATTERS</span></div>
            <div className="art-ground" />
          </div>
        </section>

        <section className="landing-band" id="report-process">
          <div><span className="band-number">01</span><b>File a complaint.</b><small>Tell us what happened and where.</small></div>
          <div><span className="band-number">02</span><b>Track your case.</b><small>Use your complaint ID to check progress.</small></div>
          <div><span className="band-number">03</span><b>Get an update.</b><small>Staff update the status as they review it.</small></div>
        </section>

        <section className="how-section" id="how-it-works">
          <div className="how-heading"><div className="eyebrow">A CLEAR PROCESS FROM START TO UPDATE</div><h2>Every complaint<br />gets a <em>next step.</em></h2></div>
          <div className="how-copy"><p>Use one desk to report a campus issue, get a complaint ID, and check its status. The staff dashboard keeps updates visible as each case moves forward.</p><button className="how-link" onClick={onStudent}>Open the complaint desk <span>→</span></button></div>
        </section>
      </main>

      <footer className="landing-footer">
        <a className="landing-brand" href="#" onClick={(event) => event.preventDefault()}><span className="landing-brand-mark">✳</span><span>Complaint Desk</span></a>
        <span>Your campus complaint desk.</span>
        <button onClick={onAdmin}>Staff sign in ↗</button>
      </footer>
    </div>
  );
}

function AdminLogin({ credentials, onChange, onSubmit, onHome, error, submitting }) {
  return (
    <main className="admin-login-page">
      <button className="login-back" onClick={onHome}>← <span>Back to Complaint Desk</span></button>
      <section className="login-layout">
        <div className="login-intro">
          <a className="landing-brand" href="#" onClick={(event) => event.preventDefault()}><span className="landing-brand-mark">✳</span><span>Complaint Desk</span></a>
          <div className="login-intro-copy">
            <div className="hero-kicker"><span /> FOR CAMPUS STAFF</div>
            <h1>Every complaint<br />deserves a clear<br /><em>next step.</em></h1>
            <p>Review reports, update case status, and keep students informed as complaints progress.</p>
          </div>
          <div className="login-note"><span>✳</span><p><b>Clear updates build trust.</b><small>Keep each complaint moving forward.</small></p></div>
        </div>
        <div className="login-form-wrap">
          <form className="login-card" onSubmit={onSubmit}>
            <span className="login-icon">↗</span>
            <div className="eyebrow">STAFF SIGN IN</div>
            <h2>Complaint desk.</h2>
            <p>Sign in to review and update campus complaints.</p>
            <label>Staff email<input type="email" autoComplete="username" required placeholder="staff@campus.edu" value={credentials.email} onChange={(event) => onChange({ ...credentials, email: event.target.value })} /></label>
            <label>Password<input type="password" autoComplete="current-password" required placeholder="Enter your password" value={credentials.password} onChange={(event) => onChange({ ...credentials, password: event.target.value })} /></label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="submit" className="login-submit" disabled={submitting}>{submitting ? "Signing in..." : <>Open staff dashboard <span>→</span></>}</button>
            <small className="login-config-note">Staff credentials are configured privately in Backend/.env.</small>
          </form>
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, icon, tone }) {
  return <div className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong></div><span className={`stat-trend ${tone}`}>↗</span></div>;
}

function ComplaintCard({ item }) {
  return <div className="found-card"><span className="found-marker">✓</span><span><b>{item.complaintId}</b><small>{item.category} · Submitted {new Date(item.createdAt).toLocaleDateString()}</small></span><StatusBadge status={item.status} /></div>;
}

function ComplaintTable({ items, loading, admin = false, onOpen, onStatus }) {
  if (loading) return <div className="table-state"><span className="spinner dark-spinner" /> Loading complaints...</div>;
  if (!items.length) return <div className="table-state empty-state"><span>◌</span><b>No complaints to show</b><small>New submissions will appear here.</small></div>;
  return <div className="table-scroll"><table><thead><tr><th>COMPLAINT</th><th>STUDENT</th><th>CATEGORY</th><th>PRIORITY</th><th>STATUS</th>{admin && <th>UPDATE STATUS</th>}<th></th></tr></thead><tbody>
    {items.map((item) => <tr key={item.complaintId}>
      <td><button className="id-button" onClick={() => onOpen(item)}>{item.complaintId}</button><small className="cell-sub">{new Date(item.createdAt).toLocaleDateString()}</small></td>
      <td><span className="student-cell">{item.studentName}</span><small className="cell-sub">{item.department}</small></td>
      <td><span className="category-chip">{item.category}</span>{item.categorySuggestion && item.category !== item.categorySuggestion && <small className="cell-sub">AI: {item.categorySuggestion}</small>}</td>
      <td><span className={`priority ${item.priority.toLowerCase()}`}><i />{item.priority}</span></td>
      <td><StatusBadge status={item.status} /></td>
      {admin && <td><select className="status-select" aria-label={`Update status for ${item.complaintId}`} value={item.status} onChange={(e) => onStatus(item.complaintId, e.target.value)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></td>}
      <td><button className="row-more" aria-label={`View ${item.complaintId}`} onClick={() => onOpen(item)}>···</button></td>
    </tr>)}
  </tbody></table></div>;
}

function StatusBadge({ status }) {
  return <span className={`status-badge ${statusClass(status)}`}><i />{status}</span>;
}

function DetailsModal({ item, onClose, onStatus, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    studentName: item.studentName,
    department: item.department,
    category: item.category,
    description: item.description
  });
  const [editError, setEditError] = useState("");
  useEffect(() => {
    setEditForm({
      studentName: item.studentName,
      department: item.department,
      category: item.category,
      description: item.description
    });
  }, [item.complaintId, item.studentName, item.department, item.category, item.description]);
  useEffect(() => {
    function onKey(event) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  async function saveEdits(event) {
    event.preventDefault();
    setEditError("");
    try {
      await onEdit(item.complaintId, editForm);
      setEditing(false);
    } catch (error) {
      setEditError(error.message);
    }
  }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="details-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div className="modal-top"><span className="eyebrow">COMPLAINT DETAILS</span><button className="close-button" onClick={onClose} aria-label="Close">×</button></div>
    <h2 id="modal-title">{item.complaintId}</h2><p className="modal-date">Submitted {new Date(item.createdAt).toLocaleString()}</p>
    <div className="detail-status-row"><StatusBadge status={item.status} /><span className={`priority ${item.priority.toLowerCase()}`}><i />{item.priority} priority</span></div>
    {editing ? <form onSubmit={saveEdits} className="edit-form">
      <label>Student name<input required minLength="2" maxLength="100" value={editForm.studentName} onChange={(e) => setEditForm({ ...editForm, studentName: e.target.value })} /></label>
      <label>Department<input required minLength="2" maxLength="100" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} /></label>
      <label>Category<select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>Description<textarea required minLength="10" maxLength="3000" rows="4" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></label>
      {editError && <p className="edit-error" role="alert">{editError}</p>}
      <div className="modal-actions"><button type="button" className="subtle-button" onClick={() => { setEditing(false); setEditError(""); }}>Cancel</button><button className="primary-button" type="submit">Save changes</button></div>
    </form> : <>
      <div className="detail-grid"><div><small>STUDENT</small><b>{item.studentName}</b></div><div><small>DEPARTMENT</small><b>{item.department}</b></div><div><small>CATEGORY</small><b>{item.category}</b></div><div><small>AI SUGGESTION</small><b>{item.categorySuggestion || item.category}</b></div></div>
      <div className="summary-box"><small>SMART SUMMARY</small><p>{item.summary}</p></div>
      <div className="description-box"><small>DESCRIPTION</small><p>{item.description}</p></div>
    </>}
    <label className="modal-status">Update status<select value={item.status} onChange={(e) => onStatus(item.complaintId, e.target.value)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
    {!editing && <div className="modal-actions"><button className="delete-button" onClick={() => onDelete(item.complaintId)}>Delete complaint</button><div className="modal-action-group"><button className="subtle-button" onClick={() => setEditing(true)}>Edit details</button><button className="primary-button" onClick={onClose}>Done</button></div></div>}
  </section></div>;
}

export default App;
