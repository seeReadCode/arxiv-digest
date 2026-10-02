/**
 * template.js
 * Takes the structured digest data from Claude and returns a complete,
 * self-contained HTML string — the same editorial design from the mockup.
 */

function tagColor(cats = '') {
  const c = cats.toLowerCase();
  if (c.includes('cs.cv')) return 'tag-cv';
  if (c.includes('cs.ro')) return 'tag-ro';
  if (c.includes('cs.se') || c.includes('cs.pl')) return 'tag-se';
  if (c.includes('cs.lg') || c.includes('cs.cl')) return 'tag-ml';
  return 'tag-ai';
}

function today() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  });
}

export function buildHTML(data) {
  const calloutCards = (data.callouts || []).slice(0, 4).map(c => `
    <div class="callout-card">
      <span class="callout-tag ${c.tagClass || 'tag-ai'}">${c.tag}</span>
      <div class="callout-title">${c.title}</div>
      <p class="callout-body">${c.body}</p>
      <div class="callout-finding">${c.finding}</div>
      <div class="callout-meta">
        <span class="callout-authors">${c.authors}</span>
        <span class="callout-id">${c.id}</span>
      </div>
    </div>`).join('');

  const feedItems = (data.papers || []).map((p, i) => {
    const tc   = tagColor((p.tags || []).join(' '));
    const tags  = (p.tags || []).slice(0, 2).map(t =>
      `<span class="feed-tag ${tc}">${t}</span>`).join('');
    const venue = p.venue
      ? `<span class="feed-venue">${p.venue}</span>` : '';
    return `
    <div class="feed-item">
      <span class="feed-index">${String(i + 1).padStart(2, '0')}</span>
      <div>
        <div class="feed-title">${p.title}</div>
        <p class="feed-summary">${p.summary}</p>
        <div class="feed-row">${tags}${venue}<span class="feed-authors">${p.authors}</span></div>
      </div>
    </div>`;
  }).join('');

  const statItems = (data.stats || []).map(s =>
    `<div class="stat-item"><span class="stat-num">${s.num}</span><span class="stat-label">${s.label}</span></div>`
  ).join('');

  const r = data.researcher || {};
  const researcherHTML = `
    <div class="researcher-avatar" style="background:${r.avatarBg||'rgba(245,166,35,0.15)'};color:${r.avatarColor||'#F5A623'}">${r.initials||'?'}</div>
    <div class="researcher-name">${r.name||'—'}</div>
    <div class="researcher-role">${r.title||''}</div>
    <p class="researcher-bio">${r.bio||''}</p>
    <div class="researcher-stats">
      <div class="r-stat"><div class="r-stat-num">${r.citations||'—'}</div><div class="r-stat-label">Citations</div></div>
      <div class="r-stat"><div class="r-stat-num" style="font-size:11px;padding-top:2px">${r.venue||'—'}</div><div class="r-stat-label">Latest venue</div></div>
    </div>
    <div class="r-paper">
      <div class="r-paper-title">${r.paperTitle||'—'}</div>
      <div class="r-paper-venue">${r.paperVenue||''}</div>
    </div>`;

  const trendItems = (data.trends || []).slice(0, 5).map(t => {
    const bars = (t.heights || [8,10,12,11,14]).map(h =>
      `<div class="spark-b" style="height:${h}px"></div>`).join('');
    return `
    <div class="trend-item">
      <span class="trend-rank">${t.rank}</span>
      <div class="trend-info">
        <div class="trend-field">${t.field}</div>
        <div class="trend-count">${t.count}</div>
      </div>
      <div class="spark">${bars}</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>arXiv CS — ${today()}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Serif:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --navy:#0C1628;--navy-mid:#162238;--navy-card:#1C2E45;
    --cyan:#00C8E0;--amber:#F5A623;--green:#7ED8A0;--purple:#C890F0;--red:#F87F7F;
    --text-primary:#F0EDE6;--text-muted:#8FA3BC;--text-dim:#5A7290;
    --border:rgba(240,237,230,0.08);--border-strong:rgba(240,237,230,0.15);
    --display:'Space Grotesk',sans-serif;--serif:'IBM Plex Serif',serif;--mono:'JetBrains Mono',monospace;
  }
  body{font-family:var(--display);background:var(--navy);color:var(--text-primary);-webkit-font-smoothing:antialiased;min-height:100vh}
  /* Header */
  .site-header{padding:0 24px;height:52px;display:flex;align-items:center;justify-content:space-between;border-bottom:.5px solid var(--border-strong);position:sticky;top:0;background:var(--navy);z-index:20}
  .site-logo{font-family:var(--mono);font-size:13px;color:var(--cyan);letter-spacing:.1em}
  .site-logo span{color:var(--text-dim)}
  .header-right{display:flex;align-items:center;gap:12px}
  .date-badge{font-family:var(--mono);font-size:11px;color:var(--text-dim);border:.5px solid var(--border-strong);padding:4px 10px;border-radius:4px}
  .build-badge{font-family:var(--mono);font-size:10px;color:var(--green);border:.5px solid rgba(126,216,160,.25);padding:4px 10px;border-radius:4px;background:rgba(126,216,160,.06)}
  /* Hero */
  .hero{padding:36px 24px 28px;border-bottom:.5px solid var(--border-strong)}
  .hero-eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--cyan);margin-bottom:12px}
  .hero-headline{font-size:34px;font-weight:700;line-height:1.1;margin-bottom:14px}
  .hero-headline em{font-style:normal;color:var(--cyan)}
  .hero-summary{font-family:var(--serif);font-size:15px;line-height:1.8;color:var(--text-muted);max-width:620px;margin-bottom:20px}
  .stat-row{display:flex;gap:28px;padding-top:18px;border-top:.5px solid var(--border);flex-wrap:wrap}
  .stat-item{display:flex;flex-direction:column;gap:2px}
  .stat-num{font-family:var(--mono);font-size:20px;font-weight:500;color:var(--text-primary)}
  .stat-label{font-size:10px;color:var(--text-dim);letter-spacing:.08em;text-transform:uppercase}
  /* Grid */
  .main-grid{display:grid;grid-template-columns:1fr 272px}
  /* Section headers */
  .section-header{padding:18px 24px 10px;display:flex;align-items:center;justify-content:space-between;border-bottom:.5px solid var(--border)}
  .section-title{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan)}
  .section-meta{font-family:var(--mono);font-size:10px;color:var(--text-dim)}
  /* Callouts */
  .callout-grid{display:grid;grid-template-columns:1fr 1fr;border-bottom:.5px solid var(--border-strong)}
  .callout-card{padding:18px 20px;border-right:.5px solid var(--border);transition:background .12s}
  .callout-card:last-child{border-right:none}
  .callout-card:hover{background:var(--navy-mid)}
  .callout-tag{display:inline-block;font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:3px;margin-bottom:10px}
  .tag-ai{background:rgba(0,200,224,.12);color:var(--cyan)}
  .tag-cv{background:rgba(245,166,35,.12);color:var(--amber)}
  .tag-ml{background:rgba(126,216,160,.12);color:var(--green)}
  .tag-ro{background:rgba(200,144,240,.12);color:var(--purple)}
  .tag-se{background:rgba(248,127,127,.12);color:var(--red)}
  .callout-title{font-size:14px;font-weight:600;line-height:1.35;color:var(--text-primary);margin-bottom:8px}
  .callout-body{font-family:var(--serif);font-size:12px;line-height:1.65;color:var(--text-muted);margin-bottom:10px}
  .callout-finding{font-family:var(--mono);font-size:11px;color:var(--cyan);line-height:1.45;display:flex;gap:5px}
  .callout-finding::before{content:'→';flex-shrink:0}
  .callout-meta{margin-top:10px;display:flex;justify-content:space-between;align-items:center}
  .callout-authors{font-size:10px;color:var(--text-dim)}
  .callout-id{font-family:var(--mono);font-size:10px;color:var(--text-dim)}
  /* Feed */
  .feed-item{padding:14px 20px;border-bottom:.5px solid var(--border);display:grid;grid-template-columns:36px 1fr;gap:12px;transition:background .12s}
  .feed-item:hover{background:var(--navy-mid)}
  .feed-index{font-family:var(--mono);font-size:10px;color:var(--text-dim);padding-top:2px}
  .feed-title{font-size:13px;font-weight:500;color:var(--text-primary);line-height:1.4;margin-bottom:5px}
  .feed-summary{font-family:var(--serif);font-size:12px;line-height:1.6;color:var(--text-muted);margin-bottom:6px}
  .feed-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
  .feed-tag{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:2px 6px;border-radius:2px}
  .feed-venue{font-size:10px;color:var(--amber);font-style:italic}
  .feed-authors{font-size:10px;color:var(--text-dim)}
  /* Sidebar */
  .sidebar{border-left:.5px solid var(--border-strong)}
  .sidebar-section{padding:18px 16px;border-bottom:.5px solid var(--border)}
  .sidebar-eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:14px}
  .researcher-avatar{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;margin-bottom:10px}
  .researcher-name{font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:2px}
  .researcher-role{font-size:11px;color:var(--text-muted);margin-bottom:10px}
  .researcher-bio{font-family:var(--serif);font-size:12px;line-height:1.65;color:var(--text-muted);margin-bottom:12px}
  .researcher-stats{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px}
  .r-stat{background:var(--navy-card);border-radius:5px;padding:9px 11px}
  .r-stat-num{font-family:var(--mono);font-size:15px;font-weight:500;color:var(--amber)}
  .r-stat-label{font-size:9px;color:var(--text-dim);margin-top:2px;text-transform:uppercase;letter-spacing:.06em}
  .r-paper{background:var(--navy-card);border-radius:5px;padding:9px 11px}
  .r-paper-title{font-size:11px;font-weight:500;color:var(--text-primary);line-height:1.35;margin-bottom:3px}
  .r-paper-venue{font-size:10px;color:var(--amber);font-style:italic}
  .trend-list{display:flex;flex-direction:column;gap:7px}
  .trend-item{display:flex;align-items:center;gap:9px;padding:9px 11px;background:var(--navy-card);border-radius:5px}
  .trend-rank{font-family:var(--mono);font-size:10px;color:var(--text-dim);min-width:14px}
  .trend-info{flex:1}
  .trend-field{font-size:11px;font-weight:500;color:var(--text-primary)}
  .trend-count{font-size:10px;color:var(--text-muted);margin-top:1px}
  .spark{display:flex;align-items:flex-end;gap:2px;height:16px}
  .spark-b{width:3px;border-radius:1px;background:var(--cyan);opacity:.5}
  .field-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
  .field-chip{font-family:var(--mono);font-size:9px;letter-spacing:.06em;padding:4px 9px;border-radius:3px;border:.5px solid var(--border-strong);color:var(--text-muted);text-transform:uppercase;cursor:default}
  .footer{padding:24px;border-top:.5px solid var(--border-strong);font-family:var(--mono);font-size:10px;color:var(--text-dim);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
  @media(max-width:700px){
    .main-grid{grid-template-columns:1fr}
    .sidebar{border-left:none;border-top:.5px solid var(--border-strong)}
    .callout-grid{grid-template-columns:1fr}
    .hero-headline{font-size:24px}
  }
</style>
</head>
<body>
<header class="site-header">
  <div class="site-logo">arXiv<span> / cs</span></div>
  <div class="header-right">
    <div class="date-badge">${today()}</div>
    <div class="build-badge">✦ Nightly build</div>
  </div>
</header>

<section class="hero">
  <p class="hero-eyebrow">Daily Digest · Computer Science</p>
  <h1 class="hero-headline">${data.heroHeadline || 'Today in Computer Science'}</h1>
  <p class="hero-summary">${data.heroSummary || ''}</p>
  <div class="stat-row">${statItems}</div>
</section>

<div class="main-grid">
  <div>
    <div class="section-header">
      <span class="section-title">⚡ Highlighted Findings</span>
      <span class="section-meta">${(data.callouts||[]).length} selected · AI-curated</span>
    </div>
    <div class="callout-grid">${calloutCards}</div>

    <div class="section-header">
      <span class="section-title">📄 Recent Submissions</span>
      <span class="section-meta">Showing ${(data.papers||[]).length} of today's submissions</span>
    </div>
    ${feedItems}
  </div>

  <aside class="sidebar">
    <div class="sidebar-section">
      <div class="sidebar-eyebrow" style="color:var(--amber)">Featured Researcher</div>
      ${researcherHTML}
    </div>
    <div class="sidebar-section">
      <div class="sidebar-eyebrow" style="color:var(--cyan)">Trending Subfields</div>
      <div class="trend-list">${trendItems}</div>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-eyebrow" style="color:var(--text-dim)">Browse by Field</div>
      <div class="field-chips">
        ${['cs.AI','cs.LG','cs.CV','cs.CL','cs.RO','cs.CR','cs.SE','cs.DC','cs.HC','cs.GT','cs.AR','cs.IT']
          .map(f=>`<div class="field-chip">${f}</div>`).join('')}
      </div>
    </div>
  </aside>
</div>

<footer class="footer">
  <span>arXiv CS Digest — generated nightly with Claude ${process?.env?.CLAUDE_MODEL || 'haiku'}</span>
  <span>Built ${new Date().toISOString().slice(0,19).replace('T',' ')} UTC · <a href="https://arxiv.org/list/cs/recent" style="color:var(--cyan);text-decoration:none">arxiv.org</a></span>
</footer>
</body>
</html>`;
}
