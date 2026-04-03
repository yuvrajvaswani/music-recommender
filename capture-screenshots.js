const { chromium } = require('../moodeats/node_modules/playwright');
const path = require('path');

const OUT = path.join(__dirname, 'screenshots');

const COMMON_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg-900:#121212;--bg-800:#161616;--panel:#181818;--panel-soft:#222222;
  --text-main:#f5f7f5;--text-muted:#aeb6b0;
  --accent:#1DB954;--accent-soft:#39d06d;--border:#2e2e2e;
  --glow:rgba(29,185,84,0.28);
}
body{
  font-family:'Space Grotesk',sans-serif;
  background:
    radial-gradient(circle at 75% 10%,rgba(29,185,84,0.17) 0%,transparent 36%),
    radial-gradient(circle at 12% 85%,rgba(29,185,84,0.12) 0%,transparent 31%),
    linear-gradient(160deg,var(--bg-900),#0f0f0f);
  color:var(--text-main);
  min-height:100vh;
}
`;

// ─── reusable sidebar HTML ───────────────────────────────────────────────────
function sidebar(active) {
  const links = [
    { icon: '⊞', label: 'Home',            id: 'home' },
    { icon: '♪', label: 'Library',         id: 'library' },
    { icon: '⏱', label: 'History',         id: 'history' },
    { icon: '⚙', label: 'Admin',           id: 'admin' },
    { icon: '✦', label: 'Recommendations', id: 'recs' },
  ];
  const navItems = links.map(l => `
    <a class="nav-item${l.id===active?' active':''}" href="#">
      <span class="nav-icon">${l.icon}</span>${l.label}
    </a>`).join('');

  return `
  <aside class="sidebar">
    <div class="brand">🎵 MusicRec</div>
    <nav class="nav">${navItems}</nav>
    <div class="side-card profile-card">
      <div class="avatar">YV</div>
      <div class="profile-info">
        <div class="profile-name">yuvraj</div>
        <div class="profile-sub">Free — 8 sessions</div>
      </div>
    </div>
    <div class="side-card">
      <div class="side-label">Quick Actions</div>
      <button class="queue-btn">+ New Queue</button>
      <button class="queue-btn">⬇ Export</button>
    </div>
    <div class="side-card">
      <div class="side-label">Mode Shortcuts</div>
      <div class="mode-chips">
        <span class="mode-chip${active==='home'?' active':''}">Hybrid</span>
        <span class="mode-chip">Vibe</span>
        <span class="mode-chip">Artist</span>
      </div>
    </div>
    <div class="side-card">
      <div class="side-label">Recent Seeds</div>
      <div class="seed-item">Blinding Lights</div>
      <div class="seed-item">Levitating</div>
      <div class="seed-item">As It Was</div>
    </div>
  </aside>`;
}

// ─── reusable topbar HTML ────────────────────────────────────────────────────
function topbar(title='Music Recommender') {
  return `
  <header class="topbar">
    <div class="topbar-left">
      <span class="topbar-title">${title}</span>
      <span class="badge">Beta</span>
    </div>
    <div class="topbar-right">
      <span class="meta-pill">Dataset: 19,000+ tracks</span>
      <span class="meta-pill accent">● Connected</span>
    </div>
  </header>`;
}

// ─── song card component ─────────────────────────────────────────────────────
function songCard({ title, artist, genre, year, confidence, coverColor }) {
  return `
  <div class="song-card">
    <div class="cover-frame" style="background:${coverColor||'rgba(29,185,84,0.15)'}">
      <span class="cover-note">♪</span>
    </div>
    <div class="card-body">
      <div class="track-title">${title}</div>
      <div class="track-artist">${artist}</div>
      <div class="track-meta">
        <span class="meta-pill">${genre}</span>
        <span class="meta-pill">${year}</span>
      </div>
      <div class="confidence-wrap">
        <div class="confidence-fill" style="width:${confidence}%"></div>
      </div>
      <div class="confidence-label">${confidence}% match</div>
    </div>
  </div>`;
}

// ─── layout CSS ──────────────────────────────────────────────────────────────
const LAYOUT_CSS = `
.layout{
  display:grid;
  grid-template-columns:240px 1fr;
  grid-template-rows:78px 1fr;
  grid-template-areas:'topbar topbar' 'sidebar main';
  height:100vh;
}
.topbar{
  grid-area:topbar;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 28px;
  background:rgba(18,18,18,0.95);
  border-bottom:1px solid var(--border);
  backdrop-filter:blur(16px);
  z-index:10;
}
.topbar-left{display:flex;align-items:center;gap:12px}
.topbar-title{font-size:1.1rem;font-weight:700;color:var(--text-main)}
.topbar-right{display:flex;align-items:center;gap:10px}
.badge{
  font-size:.6rem;font-weight:700;letter-spacing:.08em;
  background:rgba(29,185,84,0.18);color:var(--accent);
  border:1px solid rgba(29,185,84,0.35);
  padding:2px 7px;border-radius:10px;
}
.meta-pill{
  font-size:.68rem;font-weight:500;color:var(--text-muted);
  background:var(--panel-soft);border:1px solid var(--border);
  padding:3px 9px;border-radius:20px;
}
.meta-pill.accent{color:var(--accent-soft);background:rgba(29,185,84,0.1);border-color:rgba(29,185,84,0.25)}
.sidebar{
  grid-area:sidebar;
  display:flex;flex-direction:column;gap:14px;
  padding:18px 14px;
  background:var(--bg-800);
  border-right:1px solid var(--border);
  overflow-y:auto;
}
.brand{font-size:1rem;font-weight:700;padding:4px 6px;color:var(--accent);letter-spacing:.03em}
.nav{display:flex;flex-direction:column;gap:2px}
.nav-item{
  display:flex;align-items:center;gap:10px;
  padding:9px 12px;border-radius:8px;
  font-size:.82rem;font-weight:500;color:var(--text-muted);
  text-decoration:none;transition:all .18s;
}
.nav-item:hover,.nav-item.active{background:var(--panel-soft);color:var(--text-main)}
.nav-item.active .nav-icon{color:var(--accent)}
.nav-icon{font-size:.9rem;width:18px;text-align:center;color:var(--text-muted)}
.side-card{
  background:var(--panel);border:1px solid var(--border);
  border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;
}
.profile-card{flex-direction:row;align-items:center;gap:10px}
.avatar{
  width:36px;height:36px;border-radius:50%;
  background:linear-gradient(135deg,var(--accent),#0d6e30);
  display:flex;align-items:center;justify-content:center;
  font-size:.75rem;font-weight:700;color:#fff;flex-shrink:0;
}
.profile-name{font-size:.82rem;font-weight:600;color:var(--text-main)}
.profile-sub{font-size:.68rem;color:var(--text-muted)}
.side-label{font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)}
.queue-btn{
  background:var(--panel-soft);border:1px solid var(--border);
  border-radius:7px;padding:7px 12px;
  font-size:.74rem;font-weight:500;color:var(--text-main);
  cursor:pointer;text-align:left;
}
.mode-chips{display:flex;flex-wrap:wrap;gap:5px}
.mode-chip{
  font-size:.68rem;font-weight:600;padding:4px 10px;border-radius:20px;
  background:var(--panel-soft);border:1px solid var(--border);color:var(--text-muted);
  cursor:pointer;
}
.mode-chip.active{background:rgba(29,185,84,0.18);color:var(--accent);border-color:rgba(29,185,84,0.35)}
.seed-item{
  font-size:.74rem;color:var(--text-muted);
  padding:4px 0;border-bottom:1px solid var(--border);
}
.seed-item:last-child{border:none;padding-bottom:0}
`;

// ═══════════════════════════════════════════════════════════════════════════
// PAGE BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

function buildLogin() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${COMMON_CSS}
.auth-shell{
  min-height:100vh;display:flex;align-items:center;justify-content:center;
}
.auth-card{
  background:var(--panel);border:1px solid var(--border);border-radius:18px;
  padding:44px 40px;width:380px;
  box-shadow:0 24px 80px rgba(0,0,0,0.55),0 0 0 1px rgba(29,185,84,0.06);
}
.hero-kicker{
  font-size:.65rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;
  color:var(--accent);margin-bottom:10px;
}
.auth-card h1{font-size:1.9rem;font-weight:700;color:var(--text-main);margin-bottom:7px}
.subtext{font-size:.82rem;color:var(--text-muted);margin-bottom:28px}
.form-group{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
.form-group label{font-size:.75rem;font-weight:600;color:var(--text-muted);letter-spacing:.03em}
.form-group input{
  background:var(--panel-soft);border:1px solid var(--border);border-radius:9px;
  padding:11px 14px;color:var(--text-main);font-size:.85rem;font-family:inherit;
}
.form-group input:focus{outline:none;border-color:rgba(29,185,84,0.5)}
.btn-primary{
  width:100%;padding:13px;border-radius:10px;
  background:linear-gradient(135deg,var(--accent),#19a34a);
  border:none;color:#fff;font-size:.9rem;font-weight:700;
  cursor:pointer;letter-spacing:.02em;margin-top:6px;
  box-shadow:0 4px 24px rgba(29,185,84,0.35);
}
.auth-link{
  text-align:center;font-size:.8rem;color:var(--text-muted);margin-top:18px;
}
.auth-link a{color:var(--accent);text-decoration:none;font-weight:600}
.brand-mark{
  display:flex;align-items:center;gap:8px;margin-bottom:28px;
  font-size:1rem;font-weight:700;color:var(--accent);
}
.brand-icon{
  width:34px;height:34px;border-radius:8px;
  background:linear-gradient(135deg,var(--accent),#0d6e30);
  display:flex;align-items:center;justify-content:center;font-size:1rem;
}
</style></head><body>
<div class="auth-shell">
  <div class="auth-card">
    <div class="brand-mark"><div class="brand-icon">🎵</div>MusicRec</div>
    <div class="hero-kicker">Welcome Back</div>
    <h1>Sign in</h1>
    <p class="subtext">Log in to access your personalised recommendations and saved queues.</p>
    <div class="form-group">
      <label>Username</label>
      <input type="text" value="yuvraj" placeholder="Enter username">
    </div>
    <div class="form-group">
      <label>Password</label>
      <input type="password" value="••••••••" placeholder="Enter password">
    </div>
    <button class="btn-primary">Sign In</button>
    <div class="auth-link">Don't have an account? <a href="#">Create one</a></div>
  </div>
</div>
</body></html>`;
}

function buildSignup() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${COMMON_CSS}
.auth-shell{
  min-height:100vh;display:flex;align-items:center;justify-content:center;
}
.auth-card{
  background:var(--panel);border:1px solid var(--border);border-radius:18px;
  padding:44px 40px;width:400px;
  box-shadow:0 24px 80px rgba(0,0,0,0.55),0 0 0 1px rgba(29,185,84,0.06);
}
.hero-kicker{
  font-size:.65rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;
  color:var(--accent);margin-bottom:10px;
}
.auth-card h1{font-size:1.9rem;font-weight:700;color:var(--text-main);margin-bottom:7px}
.subtext{font-size:.82rem;color:var(--text-muted);margin-bottom:28px}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:6px}
.form-group{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
.form-group label{font-size:.75rem;font-weight:600;color:var(--text-muted);letter-spacing:.03em}
.form-group input{
  background:var(--panel-soft);border:1px solid var(--border);border-radius:9px;
  padding:11px 14px;color:var(--text-main);font-size:.85rem;font-family:inherit;
}
.btn-primary{
  width:100%;padding:13px;border-radius:10px;
  background:linear-gradient(135deg,var(--accent),#19a34a);
  border:none;color:#fff;font-size:.9rem;font-weight:700;
  cursor:pointer;letter-spacing:.02em;margin-top:6px;
  box-shadow:0 4px 24px rgba(29,185,84,0.35);
}
.auth-link{
  text-align:center;font-size:.8rem;color:var(--text-muted);margin-top:18px;
}
.auth-link a{color:var(--accent);text-decoration:none;font-weight:600}
.brand-mark{
  display:flex;align-items:center;gap:8px;margin-bottom:28px;
  font-size:1rem;font-weight:700;color:var(--accent);
}
.brand-icon{
  width:34px;height:34px;border-radius:8px;
  background:linear-gradient(135deg,var(--accent),#0d6e30);
  display:flex;align-items:center;justify-content:center;font-size:1rem;
}
</style></head><body>
<div class="auth-shell">
  <div class="auth-card">
    <div class="brand-mark"><div class="brand-icon">🎵</div>MusicRec</div>
    <div class="hero-kicker">Get Started</div>
    <h1>Create account</h1>
    <p class="subtext">Join MusicRec to get personalised song recommendations powered by ML similarity models.</p>
    <div class="form-row">
      <div class="form-group">
        <label>Username</label>
        <input type="text" value="yuvraj_v" placeholder="username">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" value="yuvraj@email.com" placeholder="email">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Password</label>
        <input type="password" value="••••••••" placeholder="password">
      </div>
      <div class="form-group">
        <label>Confirm</label>
        <input type="password" value="••••••••" placeholder="confirm">
      </div>
    </div>
    <div class="form-group" style="margin-bottom:0">
      <label>Invite Code (optional)</label>
      <input type="text" placeholder="BETA-XXXX">
    </div>
    <button class="btn-primary" style="margin-top:18px">Create Account</button>
    <div class="auth-link">Already have an account? <a href="#">Sign in</a></div>
  </div>
</div>
</body></html>`;
}

function buildHomeEmpty() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${COMMON_CSS}
${LAYOUT_CSS}
.main-scroll{grid-area:main;display:grid;grid-template-columns:minmax(0,1fr) 290px;overflow:hidden}
.main-col{padding:22px 24px;display:flex;flex-direction:column;gap:18px;overflow-y:auto}
.context-rail{padding:22px 16px;border-left:1px solid var(--border);display:flex;flex-direction:column;gap:14px;overflow-y:auto}
.hero-card{
  background:linear-gradient(135deg,rgba(29,185,84,0.12),rgba(29,185,84,0.04));
  border:1px solid rgba(29,185,84,0.2);border-radius:16px;
  padding:28px 30px;
}
.hero-kicker{font-size:.65rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--accent);margin-bottom:8px}
.hero-title{font-size:1.7rem;font-weight:700;line-height:1.2;margin-bottom:8px}
.hero-title span{color:var(--accent)}
.hero-desc{font-size:.82rem;color:var(--text-muted);line-height:1.5;max-width:420px}
.hero-chips{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.hero-chip{
  font-size:.7rem;font-weight:600;padding:5px 12px;border-radius:20px;
  background:rgba(29,185,84,0.12);border:1px solid rgba(29,185,84,0.25);color:var(--accent);
}
.controls-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:22px 24px}
.card-title{font-size:.85rem;font-weight:700;color:var(--text-main);margin-bottom:16px;display:flex;align-items:center;gap:8px}
.card-title .label{
  font-size:.6rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  background:rgba(29,185,84,0.15);color:var(--accent);
  border:1px solid rgba(29,185,84,0.3);padding:2px 7px;border-radius:10px;
}
.controls-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.form-group{display:flex;flex-direction:column;gap:6px}
.form-group label{font-size:.72rem;font-weight:600;color:var(--text-muted);letter-spacing:.03em;text-transform:uppercase}
.form-group input,.form-group select{
  background:var(--panel-soft);border:1px solid var(--border);border-radius:9px;
  padding:10px 14px;color:var(--text-main);font-size:.82rem;font-family:inherit;
}
.mode-selector{display:flex;gap:7px;flex-wrap:wrap;margin-top:4px}
.mode-btn{
  padding:7px 14px;border-radius:20px;font-size:.74rem;font-weight:600;
  background:var(--panel-soft);border:1px solid var(--border);color:var(--text-muted);cursor:pointer;
}
.mode-btn.active{background:rgba(29,185,84,0.18);color:var(--accent);border-color:rgba(29,185,84,0.35)}
.recommend-btn{
  background:linear-gradient(135deg,var(--accent),#19a34a);
  border:none;border-radius:10px;padding:12px 28px;
  color:#fff;font-size:.9rem;font-weight:700;
  cursor:pointer;box-shadow:0 4px 20px rgba(29,185,84,0.4);
  margin-top:6px;
}
.context-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px}
.context-title{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-muted);margin-bottom:12px}
.stat-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(46,46,46,0.6)}
.stat-row:last-child{border:none;padding-bottom:0}
.stat-label{font-size:.75rem;color:var(--text-muted)}
.stat-val{font-size:.82rem;font-weight:600;color:var(--text-main)}
.stat-val.green{color:var(--accent)}
.genre-bar-row{display:flex;flex-direction:column;gap:8px}
.g-label{display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-muted)}
.g-track{height:5px;background:var(--border);border-radius:3px;margin-top:3px}
.g-fill{height:5px;border-radius:3px;background:linear-gradient(90deg,var(--accent),var(--accent-soft))}
</style></head><body>
<div class="layout">
  ${topbar()}
  ${sidebar('home')}
  <div class="main-scroll">
    <div class="main-col">
      <div class="hero-card">
        <div class="hero-kicker">ML-Powered Discovery</div>
        <h1 class="hero-title">Find Your Next <span>Favourite Track</span></h1>
        <p class="hero-desc">Enter any song you love and our recommendation engine analyses lyrics, artist style, genre vibe, and collaborative listening patterns to find your perfect match.</p>
        <div class="hero-chips">
          <span class="hero-chip">Hybrid Mode</span>
          <span class="hero-chip">Vibe Matching</span>
          <span class="hero-chip">19,000+ Tracks</span>
          <span class="hero-chip">Artist Similarity</span>
        </div>
      </div>
      <div class="controls-card">
        <div class="card-title">Recommendation Engine <span class="label">TF-IDF + KNN</span></div>
        <div class="controls-grid">
          <div class="form-group" style="grid-column:1/-1">
            <label>Song Title</label>
            <input type="text" placeholder="e.g. Blinding Lights, Shape of You…" value="">
          </div>
          <div class="form-group">
            <label>Artist (optional)</label>
            <input type="text" placeholder="e.g. The Weeknd">
          </div>
          <div class="form-group">
            <label>Results count</label>
            <select><option>10</option><option>15</option><option>20</option></select>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Similarity Mode</label>
            <div class="mode-selector">
              <button class="mode-btn active">Hybrid</button>
              <button class="mode-btn">Artist</button>
              <button class="mode-btn">Lyrics</button>
              <button class="mode-btn">Vibe</button>
              <button class="mode-btn">Collaborative</button>
            </div>
          </div>
        </div>
        <button class="recommend-btn">Get Recommendations →</button>
      </div>
    </div>
    <div class="context-rail">
      <div class="context-card">
        <div class="context-title">Dataset Info</div>
        <div class="stat-row"><span class="stat-label">Total tracks</span><span class="stat-val green">19,482</span></div>
        <div class="stat-row"><span class="stat-label">Unique artists</span><span class="stat-val">4,210</span></div>
        <div class="stat-row"><span class="stat-label">Genres covered</span><span class="stat-val">87</span></div>
        <div class="stat-row"><span class="stat-label">Decades</span><span class="stat-val">1960s–2020s</span></div>
        <div class="stat-row"><span class="stat-label">Model status</span><span class="stat-val green">● Ready</span></div>
      </div>
      <div class="context-card">
        <div class="context-title">Genre Distribution</div>
        <div class="genre-bar-row">
          <div><div class="g-label"><span>Pop</span><span>34%</span></div><div class="g-track"><div class="g-fill" style="width:34%"></div></div></div>
          <div><div class="g-label"><span>Hip-Hop</span><span>22%</span></div><div class="g-track"><div class="g-fill" style="width:22%"></div></div></div>
          <div><div class="g-label"><span>Rock</span><span>18%</span></div><div class="g-track"><div class="g-fill" style="width:18%"></div></div></div>
          <div><div class="g-label"><span>R&amp;B</span><span>12%</span></div><div class="g-track"><div class="g-fill" style="width:12%"></div></div></div>
          <div><div class="g-label"><span>Electronic</span><span>9%</span></div><div class="g-track"><div class="g-fill" style="width:9%"></div></div></div>
          <div><div class="g-label"><span>Other</span><span>5%</span></div><div class="g-track"><div class="g-fill" style="width:5%"></div></div></div>
        </div>
      </div>
      <div class="context-card">
        <div class="context-title">Quick Picks</div>
        ${['Blinding Lights','As It Was','Levitating','Stay','Peaches'].map(t=>`
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <span style="font-size:.9rem">♪</span>
          <span style="font-size:.76rem;color:var(--text-muted)">${t}</span>
          <span style="margin-left:auto;font-size:.68rem;color:var(--accent)">→</span>
        </div>`).join('')}
      </div>
    </div>
  </div>
</div>
</body></html>`;
}

function buildHomeResults() {
  const songs = [
    { title:'Save Your Tears',    artist:'The Weeknd',      genre:'Synth-pop',  year:'2021', confidence:97, coverColor:'linear-gradient(135deg,rgba(29,185,84,0.25),rgba(29,185,84,0.08))' },
    { title:'In Your Eyes',       artist:'The Weeknd',      genre:'R&B',        year:'2020', confidence:94, coverColor:'linear-gradient(135deg,rgba(100,60,200,0.2),rgba(29,185,84,0.08))' },
    { title:'Starboy',            artist:'The Weeknd ft. Daft Punk', genre:'Electropop', year:'2016', confidence:91, coverColor:'linear-gradient(135deg,rgba(200,60,60,0.2),rgba(29,185,84,0.06))' },
    { title:'Stay',               artist:'The Kid LAROI & Justin Bieber', genre:'Pop', year:'2021', confidence:88, coverColor:'linear-gradient(135deg,rgba(60,120,220,0.2),rgba(29,185,84,0.06))' },
    { title:'Levitating',         artist:'Dua Lipa',         genre:'Disco-pop',  year:'2020', confidence:85, coverColor:'linear-gradient(135deg,rgba(220,120,200,0.2),rgba(29,185,84,0.06))' },
    { title:'Good 4 U',           artist:'Olivia Rodrigo',   genre:'Pop-punk',   year:'2021', confidence:82, coverColor:'linear-gradient(135deg,rgba(180,60,120,0.2),rgba(29,185,84,0.06))' },
    { title:'Peaches',            artist:'Justin Bieber ft. Daniel Caesar', genre:'R&B', year:'2021', confidence:80, coverColor:'linear-gradient(135deg,rgba(210,140,40,0.2),rgba(29,185,84,0.06))' },
    { title:'Kiss Me More',       artist:'Doja Cat ft. SZA', genre:'Pop',        year:'2021', confidence:77, coverColor:'linear-gradient(135deg,rgba(80,180,200,0.2),rgba(29,185,84,0.06))' },
    { title:'Therefore I Am',     artist:'Billie Eilish',    genre:'Electropop', year:'2020', confidence:75, coverColor:'linear-gradient(135deg,rgba(80,200,140,0.2),rgba(29,185,84,0.06))' },
    { title:'Drivers License',    artist:'Olivia Rodrigo',   genre:'Pop',        year:'2021', confidence:73, coverColor:'linear-gradient(135deg,rgba(60,80,200,0.2),rgba(29,185,84,0.06))' },
  ];

  const SONG_CSS = `
.song-card{
  background:var(--panel-soft);border:1px solid var(--border);border-radius:12px;
  display:flex;align-items:center;gap:14px;padding:12px 14px;
  transition:border-color .18s;
}
.song-card:hover{border-color:rgba(29,185,84,0.35)}
.cover-frame{
  width:48px;height:48px;border-radius:8px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-size:1.3rem;
}
.card-body{flex:1;min-width:0}
.track-title{font-size:.84rem;font-weight:600;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.track-artist{font-size:.74rem;color:var(--text-muted);margin:2px 0 6px}
.track-meta{display:flex;gap:5px;margin-bottom:6px}
.confidence-wrap{
  width:100%;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;
}
.confidence-fill{
  height:4px;border-radius:2px;
  background:linear-gradient(90deg,var(--accent),var(--accent-soft));
  box-shadow:0 0 8px rgba(29,185,84,0.4);
}
.confidence-label{font-size:.65rem;color:var(--text-muted);margin-top:3px}
.results-grid{display:flex;flex-direction:column;gap:8px}
`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${COMMON_CSS}
${LAYOUT_CSS}
${SONG_CSS}
.main-scroll{grid-area:main;display:grid;grid-template-columns:minmax(0,1fr) 290px;overflow:hidden}
.main-col{padding:22px 24px;display:flex;flex-direction:column;gap:18px;overflow-y:auto}
.context-rail{padding:22px 16px;border-left:1px solid var(--border);display:flex;flex-direction:column;gap:14px;overflow-y:auto}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.section-title{font-size:.9rem;font-weight:700;color:var(--text-main)}
.results-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px 22px}
.seed-hero{
  display:flex;align-items:center;gap:18px;
  background:linear-gradient(135deg,rgba(29,185,84,0.12),rgba(29,185,84,0.03));
  border:1px solid rgba(29,185,84,0.2);border-radius:14px;
  padding:18px 22px;margin-bottom:18px;
}
.seed-cover{
  width:64px;height:64px;border-radius:10px;flex-shrink:0;
  background:linear-gradient(135deg,rgba(29,185,84,0.35),rgba(29,185,84,0.1));
  display:flex;align-items:center;justify-content:center;font-size:1.8rem;
}
.seed-info .seed-label{font-size:.62rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:4px}
.seed-info h2{font-size:1.2rem;font-weight:700;margin-bottom:3px}
.seed-info p{font-size:.8rem;color:var(--text-muted)}
.seed-badges{display:flex;gap:6px;margin-top:9px}
.context-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px}
.context-title{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-muted);margin-bottom:12px}
.active-mode-badge{
  display:flex;align-items:center;gap:8px;
  background:rgba(29,185,84,0.1);border:1px solid rgba(29,185,84,0.25);
  border-radius:8px;padding:10px 12px;margin-bottom:10px;
}
.amb-icon{font-size:1.1rem}
.amb-name{font-size:.82rem;font-weight:700;color:var(--accent)}
.amb-desc{font-size:.7rem;color:var(--text-muted)}
.stat-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(46,46,46,0.6)}
.stat-row:last-child{border:none;padding-bottom:0}
.stat-label{font-size:.75rem;color:var(--text-muted)}
.stat-val{font-size:.82rem;font-weight:600;color:var(--text-main)}
.stat-val.green{color:var(--accent)}
</style></head><body>
<div class="layout">
  ${topbar()}
  ${sidebar('home')}
  <div class="main-scroll">
    <div class="main-col">
      <div class="seed-hero">
        <div class="seed-cover">♪</div>
        <div class="seed-info">
          <div class="seed-label">Seed Track · Hybrid Mode</div>
          <h2>Blinding Lights</h2>
          <p>The Weeknd · Synth-pop · 2019</p>
          <div class="seed-badges">
            <span class="meta-pill">10 results</span>
            <span class="meta-pill accent">97% avg match</span>
            <span class="meta-pill">0.42s</span>
          </div>
        </div>
      </div>
      <div class="results-card">
        <div class="section-header">
          <div class="section-title">Recommendations</div>
          <span class="meta-pill">10 tracks found</span>
        </div>
        <div class="results-grid">
          ${songs.map(s => songCard(s)).join('')}
        </div>
      </div>
    </div>
    <div class="context-rail">
      <div class="context-card">
        <div class="context-title">Active Mode</div>
        <div class="active-mode-badge">
          <span class="amb-icon">🧩</span>
          <div><div class="amb-name">Hybrid</div><div class="amb-desc">TF-IDF + KNN + Collaborative</div></div>
        </div>
        <div class="stat-row"><span class="stat-label">Lyric weight</span><span class="stat-val">40%</span></div>
        <div class="stat-row"><span class="stat-label">Artist weight</span><span class="stat-val">30%</span></div>
        <div class="stat-row"><span class="stat-label">Vibe weight</span><span class="stat-val">20%</span></div>
        <div class="stat-row"><span class="stat-label">Collab weight</span><span class="stat-val">10%</span></div>
      </div>
      <div class="context-card">
        <div class="context-title">Match Quality</div>
        <div class="stat-row"><span class="stat-label">Top score</span><span class="stat-val green">97%</span></div>
        <div class="stat-row"><span class="stat-label">Average</span><span class="stat-val green">84%</span></div>
        <div class="stat-row"><span class="stat-label">Lowest</span><span class="stat-val">73%</span></div>
        <div class="stat-row"><span class="stat-label">Latency</span><span class="stat-val">0.42s</span></div>
      </div>
      <div class="context-card">
        <div class="context-title">Genres Found</div>
        ${[['Synth-pop','4'],['R&B','3'],['Pop','2'],['Pop-punk','1']].map(([g,c])=>`
        <div class="stat-row"><span class="stat-label">${g}</span><span class="stat-val green">${c} tracks</span></div>`).join('')}
      </div>
    </div>
  </div>
</div>
</body></html>`;
}

function buildVibeMode() {
  const songs = [
    { title:'Midnight Rain',      artist:'Taylor Swift',     genre:'Dreamy',     year:'2022', confidence:96, coverColor:'linear-gradient(135deg,rgba(100,80,220,0.3),rgba(29,185,84,0.08))' },
    { title:'Watermelon Sugar',   artist:'Harry Styles',     genre:'Indie-pop',  year:'2020', confidence:93, coverColor:'linear-gradient(135deg,rgba(220,140,40,0.25),rgba(29,185,84,0.08))' },
    { title:'Heat Waves',         artist:'Glass Animals',    genre:'Indie',      year:'2020', confidence:90, coverColor:'linear-gradient(135deg,rgba(40,180,160,0.25),rgba(29,185,84,0.08))' },
    { title:'golden hour',        artist:'JVKE',             genre:'Soft-pop',   year:'2022', confidence:87, coverColor:'linear-gradient(135deg,rgba(220,180,40,0.25),rgba(29,185,84,0.08))' },
    { title:'STAY',               artist:'The Kid LAROI',    genre:'Pop',        year:'2021', confidence:84, coverColor:'linear-gradient(135deg,rgba(60,120,220,0.25),rgba(29,185,84,0.08))' },
    { title:'Sunroof',            artist:'Nicky Youre',      genre:'Indie-pop',  year:'2022', confidence:81, coverColor:'linear-gradient(135deg,rgba(60,200,220,0.25),rgba(29,185,84,0.08))' },
    { title:'About Damn Time',    artist:'Lizzo',            genre:'Funk-pop',   year:'2022', confidence:78, coverColor:'linear-gradient(135deg,rgba(200,60,180,0.25),rgba(29,185,84,0.08))' },
    { title:'Left and Right',     artist:'Charlie Puth',     genre:'Pop',        year:'2022', confidence:75, coverColor:'linear-gradient(135deg,rgba(40,140,220,0.25),rgba(29,185,84,0.08))' },
  ];

  const SONG_CSS = `
.song-card{
  background:var(--panel-soft);border:1px solid var(--border);border-radius:12px;
  display:flex;align-items:center;gap:14px;padding:12px 14px;
}
.cover-frame{
  width:48px;height:48px;border-radius:8px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-size:1.3rem;
}
.card-body{flex:1;min-width:0}
.track-title{font-size:.84rem;font-weight:600;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.track-artist{font-size:.74rem;color:var(--text-muted);margin:2px 0 6px}
.track-meta{display:flex;gap:5px;margin-bottom:6px}
.confidence-wrap{width:100%;height:4px;background:rgba(255,255,255,0.08);border-radius:2px}
.confidence-fill{height:4px;border-radius:2px;background:linear-gradient(90deg,#a855f7,#ec4899);box-shadow:0 0 8px rgba(168,85,247,0.4)}
.confidence-label{font-size:.65rem;color:var(--text-muted);margin-top:3px}
.results-grid{display:flex;flex-direction:column;gap:8px}
`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${COMMON_CSS}
${LAYOUT_CSS}
${SONG_CSS}
.main-scroll{grid-area:main;display:grid;grid-template-columns:minmax(0,1fr) 290px;overflow:hidden}
.main-col{padding:22px 24px;display:flex;flex-direction:column;gap:18px;overflow-y:auto}
.context-rail{padding:22px 16px;border-left:1px solid var(--border);display:flex;flex-direction:column;gap:14px;overflow-y:auto}
.vibe-hero{
  display:flex;align-items:center;gap:18px;
  background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(236,72,153,0.06));
  border:1px solid rgba(168,85,247,0.3);border-radius:14px;
  padding:18px 22px;margin-bottom:4px;
}
.vibe-icon{
  width:64px;height:64px;border-radius:10px;flex-shrink:0;
  background:linear-gradient(135deg,rgba(168,85,247,0.4),rgba(236,72,153,0.2));
  display:flex;align-items:center;justify-content:center;font-size:1.8rem;
}
.vibe-label{font-size:.62rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#a855f7;margin-bottom:4px}
.results-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px 22px}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.section-title{font-size:.9rem;font-weight:700;color:var(--text-main)}
.context-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px}
.context-title{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-muted);margin-bottom:12px}
.vibe-badge{
  background:linear-gradient(135deg,rgba(168,85,247,0.18),rgba(236,72,153,0.1));
  border:1px solid rgba(168,85,247,0.3);border-radius:8px;padding:10px 12px;
  display:flex;align-items:center;gap:8px;margin-bottom:10px;
}
.stat-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(46,46,46,0.6)}
.stat-row:last-child{border:none;padding-bottom:0}
.stat-label{font-size:.75rem;color:var(--text-muted)}
.stat-val{font-size:.82rem;font-weight:600;color:var(--text-main)}
.stat-val.purple{color:#a855f7}
.mood-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}
.mood-tag{
  font-size:.68rem;font-weight:600;padding:4px 10px;border-radius:20px;
  background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.25);color:#a855f7;
}
</style></head><body>
<div class="layout">
  ${topbar()}
  ${sidebar('home')}
  <div class="main-scroll">
    <div class="main-col">
      <div class="vibe-hero">
        <div class="vibe-icon">🎶</div>
        <div>
          <div class="vibe-label">Vibe Mode · Mood-based Matching</div>
          <h2 style="font-size:1.2rem;font-weight:700;margin-bottom:3px">As It Was</h2>
          <p style="font-size:.8rem;color:var(--text-muted)">Harry Styles · Indie-pop · 2022</p>
          <div class="mood-tags" style="margin-top:8px">
            <span class="mood-tag">Dreamy</span>
            <span class="mood-tag">Melancholic</span>
            <span class="mood-tag">Uplifting</span>
            <span class="mood-tag">Nostalgic</span>
          </div>
        </div>
      </div>
      <div class="results-card">
        <div class="section-header">
          <div class="section-title">Vibe Matches</div>
          <span class="meta-pill" style="background:rgba(168,85,247,0.1);color:#a855f7;border-color:rgba(168,85,247,0.3)">8 tracks · Vibe mode</span>
        </div>
        <div class="results-grid">
          ${songs.map(s => songCard(s)).join('')}
        </div>
      </div>
    </div>
    <div class="context-rail">
      <div class="context-card">
        <div class="context-title">Vibe Analysis</div>
        <div class="vibe-badge">
          <span style="font-size:1.1rem">🌊</span>
          <div><div style="font-size:.82rem;font-weight:700;color:#a855f7">Vibe Mode</div><div style="font-size:.7rem;color:var(--text-muted)">Audio features + mood tags</div></div>
        </div>
        <div class="stat-row"><span class="stat-label">Energy level</span><span class="stat-val purple">Medium-high</span></div>
        <div class="stat-row"><span class="stat-label">Valence</span><span class="stat-val purple">0.72</span></div>
        <div class="stat-row"><span class="stat-label">Danceability</span><span class="stat-val purple">0.68</span></div>
        <div class="stat-row"><span class="stat-label">Acousticness</span><span class="stat-val">0.24</span></div>
      </div>
      <div class="context-card">
        <div class="context-title">Detected Moods</div>
        <div class="mood-tags">
          <span class="mood-tag">Dreamy</span>
          <span class="mood-tag">Melancholic</span>
          <span class="mood-tag">Uplifting</span>
          <span class="mood-tag">Nostalgic</span>
          <span class="mood-tag">Chill</span>
          <span class="mood-tag">Indie</span>
        </div>
      </div>
      <div class="context-card">
        <div class="context-title">Match Stats</div>
        <div class="stat-row"><span class="stat-label">Top match</span><span class="stat-val purple">96%</span></div>
        <div class="stat-row"><span class="stat-label">Average</span><span class="stat-val purple">85%</span></div>
        <div class="stat-row"><span class="stat-label">Latency</span><span class="stat-val">0.31s</span></div>
      </div>
    </div>
  </div>
</div>
</body></html>`;
}

function buildSessionInsights() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${COMMON_CSS}
${LAYOUT_CSS}
.main-scroll{grid-area:main;display:grid;grid-template-columns:minmax(0,1fr) 290px;overflow:hidden}
.main-col{padding:22px 24px;display:flex;flex-direction:column;gap:18px;overflow-y:auto}
.context-rail{padding:22px 16px;border-left:1px solid var(--border);display:flex;flex-direction:column;gap:14px;overflow-y:auto}
.insights-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.insights-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px 22px}
.card-title{font-size:.85rem;font-weight:700;color:var(--text-main);margin-bottom:16px;display:flex;align-items:center;gap:8px}
.card-label{
  font-size:.6rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  background:rgba(29,185,84,0.15);color:var(--accent);
  border:1px solid rgba(29,185,84,0.3);padding:2px 7px;border-radius:10px;
}
.insights-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.insight-item{
  background:var(--panel-soft);border:1px solid var(--border);border-radius:10px;
  padding:13px;text-align:center;
}
.insight-val{font-size:1.5rem;font-weight:700;color:var(--accent);margin-bottom:3px}
.insight-label{font-size:.68rem;color:var(--text-muted)}
.queue-list{display:flex;flex-direction:column;gap:8px}
.queue-item{
  background:var(--panel-soft);border:1px solid var(--border);border-radius:10px;
  padding:12px 14px;display:flex;align-items:center;gap:12px;
}
.q-icon{
  width:38px;height:38px;border-radius:8px;flex-shrink:0;
  background:linear-gradient(135deg,rgba(29,185,84,0.2),rgba(29,185,84,0.05));
  display:flex;align-items:center;justify-content:center;font-size:1rem;
}
.q-title{font-size:.82rem;font-weight:600;color:var(--text-main)}
.q-meta{font-size:.72rem;color:var(--text-muted)}
.context-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px}
.context-title{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-muted);margin-bottom:12px}
.stat-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(46,46,46,0.6)}
.stat-row:last-child{border:none;padding-bottom:0}
.stat-label{font-size:.75rem;color:var(--text-muted)}
.stat-val{font-size:.82rem;font-weight:600;color:var(--text-main)}
.stat-val.green{color:var(--accent)}
.genre-bar-row{display:flex;flex-direction:column;gap:8px}
.g-label{display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-muted)}
.g-track{height:5px;background:var(--border);border-radius:3px;margin-top:3px}
.g-fill{height:5px;border-radius:3px;background:linear-gradient(90deg,var(--accent),var(--accent-soft))}
.recent-queues{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px 22px}
</style></head><body>
<div class="layout">
  ${topbar()}
  ${sidebar('home')}
  <div class="main-scroll">
    <div class="main-col">
      <div class="insights-row">
        <div class="insights-card">
          <div class="card-title">Session Insights <span class="card-label">This Session</span></div>
          <div class="insights-grid">
            <div class="insight-item"><div class="insight-val">8</div><div class="insight-label">Queries Run</div></div>
            <div class="insight-item"><div class="insight-val">74</div><div class="insight-label">Tracks Discovered</div></div>
            <div class="insight-item"><div class="insight-val">5</div><div class="insight-label">Modes Used</div></div>
            <div class="insight-item"><div class="insight-val">89%</div><div class="insight-label">Avg Match Score</div></div>
          </div>
        </div>
        <div class="insights-card">
          <div class="card-title">Top Genres Explored</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${[['Synth-pop',82],['R&B',67],['Indie-pop',54],['Hip-Hop',41],['Electropop',29]].map(([g,p])=>`
            <div>
              <div class="g-label"><span>${g}</span><span>${p}%</span></div>
              <div class="g-track"><div class="g-fill" style="width:${p}%"></div></div>
            </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="recent-queues">
        <div class="card-title">Recent Queues <span class="card-label">4 saved</span></div>
        <div class="queue-list">
          ${[
            ['Blinding Lights queue','10 tracks · Hybrid · 2 min ago'],
            ['As It Was — vibe match','8 tracks · Vibe · 14 min ago'],
            ['Shape of You similar','10 tracks · Artist · 1 hr ago'],
            ['Late night chill set','15 tracks · Hybrid · Yesterday'],
          ].map(([t,m])=>`
          <div class="queue-item">
            <div class="q-icon">♪</div>
            <div><div class="q-title">${t}</div><div class="q-meta">${m}</div></div>
            <span style="margin-left:auto;font-size:.74rem;color:var(--accent);cursor:pointer">Load →</span>
          </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="context-rail">
      <div class="context-card">
        <div class="context-title">Session Stats</div>
        <div class="stat-row"><span class="stat-label">Duration</span><span class="stat-val">22 min</span></div>
        <div class="stat-row"><span class="stat-label">Unique artists</span><span class="stat-val green">31</span></div>
        <div class="stat-row"><span class="stat-label">Seeds tried</span><span class="stat-val">8</span></div>
        <div class="stat-row"><span class="stat-label">Best match</span><span class="stat-val green">97%</span></div>
      </div>
      <div class="context-card">
        <div class="context-title">Mode Usage</div>
        <div class="genre-bar-row">
          ${[['Hybrid',60],['Vibe',20],['Artist',12],['Lyrics',5],['Collab',3]].map(([m,p])=>`
          <div>
            <div class="g-label"><span>${m}</span><span>${p}%</span></div>
            <div class="g-track"><div class="g-fill" style="width:${p}%"></div></div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`;
}

function buildLibrary() {
  const modes = [
    { id:'hybrid',  icon:'🧩', name:'Hybrid',        desc:'Combines TF-IDF lyric similarity, artist-based KNN, genre vibe matching, and collaborative patterns for the most accurate recommendations.',       tags:['TF-IDF','KNN','Collab'] },
    { id:'artist',  icon:'🎤', name:'Artist Similarity', desc:'Finds tracks by artists with similar styles, instrumentation, and genre placement. Best when you love an artist\'s overall catalogue.',         tags:['Artist KNN','Genre'] },
    { id:'lyrics',  icon:'📝', name:'Lyric Mode',    desc:'Pure TF-IDF cosine similarity on lyric content. Ideal for finding songs with thematically similar storytelling or vocabulary.',                   tags:['TF-IDF','Cosine'] },
    { id:'vibe',    icon:'🌊', name:'Vibe Mode',      desc:'Uses audio features + mood embeddings to match energy level, danceability, valence, and acoustic profile. Great for playlist building.',          tags:['NLP','Mood','Audio'] },
    { id:'collab',  icon:'👥', name:'Collaborative', desc:'Mines listening co-occurrence patterns to surface tracks frequently enjoyed together. Dataset-driven social discovery.',                           tags:['Co-occurrence','Implicit'] },
  ];

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${COMMON_CSS}
${LAYOUT_CSS}
.main-scroll{grid-area:main;overflow-y:auto;padding:22px 28px}
.page-header{margin-bottom:24px}
.page-kicker{font-size:.65rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--accent);margin-bottom:7px}
.page-title{font-size:1.8rem;font-weight:700;margin-bottom:6px}
.page-desc{font-size:.83rem;color:var(--text-muted);max-width:540px;line-height:1.5}
.modes-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}
.mode-card{
  background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:22px;
  transition:border-color .18s;
}
.mode-card:hover{border-color:rgba(29,185,84,0.3)}
.mode-card.featured{
  grid-column:1/-1;
  background:linear-gradient(135deg,rgba(29,185,84,0.1),rgba(29,185,84,0.03));
  border-color:rgba(29,185,84,0.25);
}
.mode-icon{font-size:1.6rem;margin-bottom:10px}
.mode-name{font-size:.95rem;font-weight:700;margin-bottom:5px;color:var(--text-main)}
.mode-desc{font-size:.77rem;color:var(--text-muted);line-height:1.5;margin-bottom:10px}
.mode-tags{display:flex;gap:6px;flex-wrap:wrap}
.mode-tag{
  font-size:.65rem;font-weight:600;padding:3px 9px;border-radius:20px;
  background:rgba(29,185,84,0.1);border:1px solid rgba(29,185,84,0.2);color:var(--accent);
}
.dataset-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:14px}
.section-title{font-size:.85rem;font-weight:700;color:var(--text-main);margin-bottom:16px}
.dataset-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.ds-item{background:var(--panel-soft);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center}
.ds-val{font-size:1.4rem;font-weight:700;color:var(--accent);margin-bottom:3px}
.ds-label{font-size:.68rem;color:var(--text-muted)}
</style></head><body>
<div class="layout">
  ${topbar()}
  ${sidebar('library')}
  <div class="main-scroll">
    <div class="page-header">
      <div class="page-kicker">Knowledge Base</div>
      <h1 class="page-title">Library</h1>
      <p class="page-desc">Explore the 19,000+ song catalogue and understand how each similarity mode processes your listening preferences to surface the best recommendations.</p>
    </div>
    <div class="dataset-card">
      <div class="section-title">Dataset Overview</div>
      <div class="dataset-stats">
        <div class="ds-item"><div class="ds-val">19,482</div><div class="ds-label">Total Tracks</div></div>
        <div class="ds-item"><div class="ds-val">4,210</div><div class="ds-label">Unique Artists</div></div>
        <div class="ds-item"><div class="ds-val">87</div><div class="ds-label">Genres</div></div>
        <div class="ds-item"><div class="ds-val">60yr</div><div class="ds-label">Time Span</div></div>
      </div>
    </div>
    <div class="section-title">Similarity Modes</div>
    <div class="modes-grid">
      ${modes.map((m,i) => `
      <div class="mode-card${i===0?' featured':''}">
        <div class="mode-icon">${m.icon}</div>
        <div class="mode-name">${m.name}</div>
        <div class="mode-desc">${m.desc}</div>
        <div class="mode-tags">${m.tags.map(t=>`<span class="mode-tag">${t}</span>`).join('')}</div>
      </div>`).join('')}
    </div>
  </div>
</div>
</body></html>`;
}

function buildHistory() {
  const queues = [
    { seed:'Blinding Lights',   artist:'The Weeknd',   mode:'Hybrid',  count:10, score:97, time:'2 min ago',    tags:['Synth-pop','R&B','Pop'] },
    { seed:'As It Was',         artist:'Harry Styles', mode:'Vibe',    count:8,  score:93, time:'14 min ago',   tags:['Dreamy','Indie-pop','Melancholic'] },
    { seed:'Shape of You',      artist:'Ed Sheeran',   mode:'Artist',  count:10, score:88, time:'1 hr ago',     tags:['Pop','Acoustic','Folk-pop'] },
    { seed:'HUMBLE.',           artist:'Kendrick Lamar', mode:'Lyrics', count:10, score:85, time:'3 hr ago',   tags:['Hip-Hop','Rap','Conscious'] },
    { seed:'Levitating',        artist:'Dua Lipa',     mode:'Hybrid',  count:15, score:89, time:'Yesterday',   tags:['Disco-pop','Dance','Electropop'] },
    { seed:'Bad Guy',           artist:'Billie Eilish', mode:'Vibe',   count:8,  score:91, time:'2 days ago',  tags:['Dark-pop','Electropop','Moody'] },
    { seed:'Industry Baby',     artist:'Lil Nas X',    mode:'Collaborative', count:12, score:83, time:'3 days ago', tags:['Hip-Hop','Pop-rap'] },
  ];

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${COMMON_CSS}
${LAYOUT_CSS}
.main-scroll{grid-area:main;display:grid;grid-template-columns:minmax(0,1fr) 290px;overflow:hidden}
.main-col{padding:22px 24px;display:flex;flex-direction:column;gap:14px;overflow-y:auto}
.context-rail{padding:22px 16px;border-left:1px solid var(--border);display:flex;flex-direction:column;gap:14px;overflow-y:auto}
.page-header{margin-bottom:8px}
.page-kicker{font-size:.65rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--accent);margin-bottom:7px}
.page-title{font-size:1.8rem;font-weight:700;margin-bottom:5px}
.page-desc{font-size:.82rem;color:var(--text-muted)}
.queue-card{
  background:var(--panel);border:1px solid var(--border);border-radius:14px;
  padding:18px 20px;
}
.queue-header{display:flex;align-items:center;gap:14px;margin-bottom:12px}
.q-cover{
  width:52px;height:52px;border-radius:9px;flex-shrink:0;
  background:linear-gradient(135deg,rgba(29,185,84,0.2),rgba(29,185,84,0.05));
  display:flex;align-items:center;justify-content:center;font-size:1.4rem;
}
.q-seed{font-size:.9rem;font-weight:700;color:var(--text-main)}
.q-artist{font-size:.76rem;color:var(--text-muted);margin-top:2px}
.q-stats{margin-left:auto;text-align:right}
.q-score{font-size:1.1rem;font-weight:700;color:var(--accent)}
.q-time{font-size:.7rem;color:var(--text-muted);margin-top:2px}
.tag-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.meta-pill{
  font-size:.68rem;font-weight:500;color:var(--text-muted);
  background:var(--panel-soft);border:1px solid var(--border);
  padding:3px 9px;border-radius:20px;
}
.meta-pill.mode{background:rgba(29,185,84,0.1);color:var(--accent);border-color:rgba(29,185,84,0.25)}
.q-actions{display:flex;gap:7px;margin-top:12px}
.btn-sm{
  font-size:.72rem;font-weight:600;padding:6px 14px;border-radius:7px;
  background:var(--panel-soft);border:1px solid var(--border);color:var(--text-muted);cursor:pointer;
}
.btn-sm.primary{background:rgba(29,185,84,0.15);color:var(--accent);border-color:rgba(29,185,84,0.3)}
.context-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px}
.context-title{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-muted);margin-bottom:12px}
.stat-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(46,46,46,0.6)}
.stat-row:last-child{border:none;padding-bottom:0}
.stat-label{font-size:.75rem;color:var(--text-muted)}
.stat-val{font-size:.82rem;font-weight:600;color:var(--text-main)}
.stat-val.green{color:var(--accent)}
.g-label{display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-muted)}
.g-track{height:5px;background:var(--border);border-radius:3px;margin-top:3px}
.g-fill{height:5px;border-radius:3px;background:linear-gradient(90deg,var(--accent),var(--accent-soft))}
</style></head><body>
<div class="layout">
  ${topbar()}
  ${sidebar('history')}
  <div class="main-scroll">
    <div class="main-col">
      <div class="page-header">
        <div class="page-kicker">Saved Queues</div>
        <h1 class="page-title">History</h1>
        <p class="page-desc">All your previous recommendation sessions — reload any queue or use it as a starting point.</p>
      </div>
      ${queues.map(q=>`
      <div class="queue-card">
        <div class="queue-header">
          <div class="q-cover">♪</div>
          <div><div class="q-seed">${q.seed}</div><div class="q-artist">${q.artist}</div></div>
          <div class="q-stats"><div class="q-score">${q.score}%</div><div class="q-time">${q.time}</div></div>
        </div>
        <div class="tag-row">
          <span class="meta-pill mode">${q.mode}</span>
          <span class="meta-pill">${q.count} tracks</span>
          ${q.tags.map(t=>`<span class="meta-pill">${t}</span>`).join('')}
        </div>
        <div class="q-actions">
          <button class="btn-sm primary">Load Queue</button>
          <button class="btn-sm">Export</button>
          <button class="btn-sm">Delete</button>
        </div>
      </div>`).join('')}
    </div>
    <div class="context-rail">
      <div class="context-card">
        <div class="context-title">History Stats</div>
        <div class="stat-row"><span class="stat-label">Total queues</span><span class="stat-val green">7</span></div>
        <div class="stat-row"><span class="stat-label">Tracks saved</span><span class="stat-val green">73</span></div>
        <div class="stat-row"><span class="stat-label">Avg match</span><span class="stat-val green">89%</span></div>
        <div class="stat-row"><span class="stat-label">Sessions</span><span class="stat-val">12</span></div>
      </div>
      <div class="context-card">
        <div class="context-title">Modes Used</div>
        ${[['Hybrid',4],['Vibe',2],['Artist',1],['Lyrics',1],['Collab',1]].map(([m,c])=>`
        <div class="stat-row"><span class="stat-label">${m}</span><span class="stat-val">${c} queues</span></div>`).join('')}
      </div>
      <div class="context-card">
        <div class="context-title">Top Genres</div>
        ${[['Pop',42],['Hip-Hop',26],['Indie',18],['R&B',14]].map(([g,p])=>`
        <div>
          <div class="g-label"><span>${g}</span><span>${p}%</span></div>
          <div class="g-track"><div class="g-fill" style="width:${p}%"></div></div>
        </div>`).join('')}
      </div>
    </div>
  </div>
</div>
</body></html>`;
}

function buildAdmin() {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${COMMON_CSS}
${LAYOUT_CSS}
.main-scroll{grid-area:main;display:grid;grid-template-columns:minmax(0,1fr) 290px;overflow:hidden}
.main-col{padding:22px 24px;display:flex;flex-direction:column;gap:18px;overflow-y:auto}
.context-rail{padding:22px 16px;border-left:1px solid var(--border);display:flex;flex-direction:column;gap:14px;overflow-y:auto}
.admin-hero{
  background:linear-gradient(135deg,rgba(239,68,68,0.1),rgba(239,68,68,0.03));
  border:1px solid rgba(239,68,68,0.2);border-radius:14px;
  padding:22px 26px;
}
.hero-kicker{font-size:.65rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#ef4444;margin-bottom:7px}
.hero-title{font-size:1.5rem;font-weight:700;margin-bottom:5px}
.hero-desc{font-size:.82rem;color:var(--text-muted)}
.insights-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.insights-card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px 22px}
.card-title{font-size:.85rem;font-weight:700;color:var(--text-main);margin-bottom:16px;display:flex;align-items:center;gap:8px}
.card-label{
  font-size:.6rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  background:rgba(239,68,68,0.12);color:#ef4444;
  border:1px solid rgba(239,68,68,0.25);padding:2px 7px;border-radius:10px;
}
.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.stat-item{background:var(--panel-soft);border:1px solid var(--border);border-radius:9px;padding:12px;text-align:center}
.stat-val{font-size:1.3rem;font-weight:700;color:var(--accent);margin-bottom:3px}
.stat-label{font-size:.66rem;color:var(--text-muted)}
.maintenance-list{display:flex;flex-direction:column;gap:10px}
.maint-item{
  background:var(--panel-soft);border:1px solid var(--border);border-radius:10px;padding:14px;
  display:flex;align-items:center;gap:12px;
}
.maint-icon{
  width:36px;height:36px;border-radius:8px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;font-size:1rem;
}
.maint-icon.green{background:rgba(29,185,84,0.15)}
.maint-icon.red{background:rgba(239,68,68,0.12)}
.maint-icon.blue{background:rgba(59,130,246,0.12)}
.maint-name{font-size:.82rem;font-weight:600;color:var(--text-main);margin-bottom:2px}
.maint-desc{font-size:.7rem;color:var(--text-muted)}
.maint-btn{
  margin-left:auto;font-size:.72rem;font-weight:600;padding:7px 14px;border-radius:7px;
  background:rgba(29,185,84,0.15);border:1px solid rgba(29,185,84,0.3);color:var(--accent);cursor:pointer;
}
.maint-btn.red{background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.25);color:#ef4444}
.form-group{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.form-group label{font-size:.72rem;font-weight:600;color:var(--text-muted);letter-spacing:.03em}
.form-group input{
  background:var(--panel-soft);border:1px solid var(--border);border-radius:9px;
  padding:9px 14px;color:var(--text-main);font-size:.82rem;font-family:inherit;
}
.context-card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px}
.context-title{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--text-muted);margin-bottom:12px}
.stat-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(46,46,46,0.6)}
.stat-row:last-child{border:none;padding-bottom:0}
.stat-label-sm{font-size:.75rem;color:var(--text-muted)}
.stat-val-sm{font-size:.82rem;font-weight:600;color:var(--text-main)}
.stat-val-sm.green{color:var(--accent)}
.stat-val-sm.red{color:#ef4444}
.log-item{font-size:.7rem;color:var(--text-muted);padding:5px 0;border-bottom:1px solid rgba(46,46,46,0.5);font-family:monospace}
.log-item:last-child{border:none;padding-bottom:0}
.log-item .ok{color:var(--accent)}
.log-item .warn{color:#f59e0b}
</style></head><body>
<div class="layout">
  ${topbar('Admin Tools')}
  ${sidebar('admin')}
  <div class="main-scroll">
    <div class="main-col">
      <div class="admin-hero">
        <div class="hero-kicker">Admin Panel · Restricted</div>
        <h1 class="hero-title">Dataset Management</h1>
        <p class="hero-desc">Monitor dataset health, reload the ML model, expand training data, and view system-wide performance metrics.</p>
      </div>
      <div class="insights-row">
        <div class="insights-card">
          <div class="card-title">Dataset Stats <span class="card-label">Live</span></div>
          <div class="stat-grid">
            <div class="stat-item"><div class="stat-val">19,482</div><div class="stat-label">Total Tracks</div></div>
            <div class="stat-item"><div class="stat-val">4,210</div><div class="stat-label">Artists</div></div>
            <div class="stat-item"><div class="stat-val">87</div><div class="stat-label">Genres</div></div>
            <div class="stat-item"><div class="stat-val">100%</div><div class="stat-label">Coverage</div></div>
            <div class="stat-item"><div class="stat-val">18,941</div><div class="stat-label">With Lyrics</div></div>
            <div class="stat-item"><div class="stat-val">512</div><div class="stat-label">Vectorized</div></div>
          </div>
        </div>
        <div class="insights-card">
          <div class="card-title">Maintenance</div>
          <div class="maintenance-list">
            <div class="maint-item">
              <div class="maint-icon green">🔄</div>
              <div><div class="maint-name">Reload Model</div><div class="maint-desc">Re-train recommendation engine</div></div>
              <button class="maint-btn">Reload</button>
            </div>
            <div class="maint-item">
              <div class="maint-icon blue">⬇</div>
              <div>
                <div class="maint-name">Expand Dataset</div>
                <div class="maint-desc">Add more tracks via Last.fm API</div>
              </div>
            </div>
            <div class="form-group" style="margin-top:0">
              <label>Artist to expand</label>
              <input type="text" value="Taylor Swift" placeholder="Artist name">
            </div>
            <button class="maint-btn" style="align-self:flex-start">Fetch Tracks →</button>
            <div class="maint-item">
              <div class="maint-icon red">🗑</div>
              <div><div class="maint-name">Clear Cache</div><div class="maint-desc">Flush recommendation cache</div></div>
              <button class="maint-btn red">Clear</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="context-rail">
      <div class="context-card">
        <div class="context-title">System Health</div>
        <div class="stat-row"><span class="stat-label-sm">Model status</span><span class="stat-val-sm green">● Loaded</span></div>
        <div class="stat-row"><span class="stat-label-sm">Cache hits</span><span class="stat-val-sm green">94%</span></div>
        <div class="stat-row"><span class="stat-label-sm">Avg latency</span><span class="stat-val-sm">0.38s</span></div>
        <div class="stat-row"><span class="stat-label-sm">Error rate</span><span class="stat-val-sm green">0.1%</span></div>
        <div class="stat-row"><span class="stat-label-sm">Last reload</span><span class="stat-val-sm">4 hr ago</span></div>
      </div>
      <div class="context-card">
        <div class="context-title">Activity Log</div>
        <div class="log-item"><span class="ok">[OK]</span> Model loaded 4h ago</div>
        <div class="log-item"><span class="ok">[OK]</span> 73 queries served</div>
        <div class="log-item"><span class="warn">[INFO]</span> Cache updated 2h ago</div>
        <div class="log-item"><span class="ok">[OK]</span> Dataset: 19482 tracks</div>
        <div class="log-item"><span class="ok">[OK]</span> API rate limit: OK</div>
      </div>
    </div>
  </div>
</div>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
(async () => {
  const { chromium } = require('../moodeats/node_modules/playwright');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1380, height: 860 } });

  const pages = [
    { file: '01_login.png',           html: buildLogin() },
    { file: '02_signup.png',          html: buildSignup() },
    { file: '03_home.png',            html: buildHomeEmpty() },
    { file: '04_recommendations.png', html: buildHomeResults() },
    { file: '05_vibe_mode.png',       html: buildVibeMode() },
    { file: '06_session_insights.png',html: buildSessionInsights() },
    { file: '07_library.png',         html: buildLibrary() },
    { file: '08_history.png',         html: buildHistory() },
    { file: '09_admin.png',           html: buildAdmin() },
  ];

  for (const { file, html } of pages) {
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const fp = path.join(OUT, file);
    await page.screenshot({ path: fp, fullPage: false });
    console.log('✓', file);
    await page.close();
  }

  await browser.close();
  console.log('\nAll screenshots saved to screenshots/');
})();
