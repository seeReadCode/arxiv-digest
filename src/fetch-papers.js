/**
 * fetch-papers.js
 * Fetches ALL of today's arXiv CS submissions via the public Atom API,
 * then applies a local heuristic pre-filter to select the most compelling
 * papers to send to Claude.
 *
 * No API key needed. Rate-limit politely (one request at a time, 3 s delays).
 */

const ARXIV_BASE = 'https://export.arxiv.org/api/query';
const PAGE_SIZE  = 200;   // Max arXiv allows in one request
const MAX_PAGES  = 8;     // Safety cap: 8 × 200 = 1600 papers max
const DELAY_MS   = 3000;  // Be polite between paginated requests

// ── Heuristic scoring weights ──────────────────────────────────────────────

// Top-tier venues that indicate peer-reviewed quality
const TOP_VENUES = [
  'neurips', 'nips', 'icml', 'iclr', 'cvpr', 'iccv', 'eccv',
  'acl', 'emnlp', 'naacl', 'icra', 'iros', 'rss',
  'aaai', 'ijcai', 'uai', 'aistats', 'colt',
  'siggraph', 'chi', 'sigmod', 'vldb', 'osdi', 'sosp', 'nsdi',
  'www', 'kdd', 'wsdm', 'recsys'
];

// High-signal keywords indicating concrete, impactful results
const SIGNAL_KEYWORDS = [
  'state-of-the-art', 'state of the art', 'outperforms', 'surpasses',
  'benchmark', 'sota', 'novel', 'first', 'scalable',
  'real-world', 'open-source', 'open source', 'code available',
  'gpt', 'llm', 'large language model', 'foundation model',
  'diffusion', 'transformer', 'attention', 'reinforcement learning',
  'multimodal', 'robot', 'autonomous', 'safety', 'alignment',
  '3d', 'video', 'medical', 'clinical', 'drug', 'protein'
];

// Category base weights (primary submission gets these; cross-lists get -1)
const CAT_WEIGHTS = {
  'cs.ai': 3, 'cs.lg': 3, 'cs.cv': 3, 'cs.cl': 3,
  'cs.ro': 2, 'cs.cr': 2, 'cs.hc': 2, 'cs.ir': 2, 'cs.ne': 2,
  'cs.gt': 1, 'cs.se': 1, 'cs.dc': 1, 'cs.db': 1,
  'cs.ar': 1, 'cs.it': 1, 'cs.na': 1, 'cs.sy': 1
};

/**
 * Score a single paper on a 0–20 scale using free signals only.
 */
function scorePaper(paper) {
  let score = 0;
  const titleLower = paper.title.toLowerCase();
  const abstractLower = paper.abstract.toLowerCase();
  const combined = titleLower + ' ' + abstractLower;

  // ── Venue mentions in title or abstract ────────────────────────────────
  const topVenueMatch = TOP_VENUES.filter(v => combined.includes(v));
  score += Math.min(topVenueMatch.length * 3, 6); // cap at 6 pts

  // ── High-signal keywords ───────────────────────────────────────────────
  const kwMatches = SIGNAL_KEYWORDS.filter(kw => combined.includes(kw));
  score += Math.min(kwMatches.length, 4); // cap at 4 pts

  // ── Category weight (use primary / first category) ─────────────────────
  const cats = paper.cats.toLowerCase().split(/\s+/);
  const primaryCat = cats[0] || '';
  score += CAT_WEIGHTS[primaryCat] || 0;

  // Bonus: cross-listed in multiple high-value categories
  const highValueCats = cats.filter(c => (CAT_WEIGHTS[c] || 0) >= 2);
  if (highValueCats.length >= 2) score += 1;

  // ── Author count signal ────────────────────────────────────────────────
  const authorCount = paper.authors.split(',').length;
  if (authorCount >= 3 && authorCount <= 10) score += 1; // collaborative work
  if (authorCount > 20) score -= 1;                       // possible survey/report

  // ── Abstract length signal (ideal: 200–600 words) ─────────────────────
  const wordCount = paper.abstract.split(/\s+/).length;
  if (wordCount >= 100 && wordCount <= 300) score += 1;  // informative but concise

  // ── Title specificity signal ───────────────────────────────────────────
  // Titles with numbers/metrics tend to report concrete results
  if (/\d+(\.\d+)?[x%]|\d+[bBmMkK]/.test(paper.title)) score += 1;

  return Math.max(0, score);
}

// ── arXiv XML parser ───────────────────────────────────────────────────────

function parseFeed(xml) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];

    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].replace(/\s+/g, ' ').trim() : '';
    };

    const id       = get('id').split('/abs/')[1] || get('id');
    const title    = get('title');
    const abstract = get('summary').slice(0, 800); // keep more text for scoring

    const authorMatches = [...block.matchAll(/<name>([^<]+)<\/name>/g)];
    const authors = authorMatches.slice(0, 5).map(m => m[1].trim()).join(', ');

    const catMatches = [...block.matchAll(/term="(cs\.[A-Za-z]+)"/g)];
    const cats = [...new Set(catMatches.map(m => m[1]))].join(' ');

    // Use <updated> for date-filtering — arXiv sets this to the release date
    // when a paper enters the daily listing. <published> is the original
    // submission date and can be months old for revised papers.
    const updatedRaw   = get('updated');   // e.g. 2026-10-09T00:00:00Z
    const publishedRaw = get('published'); // original submission date

    if (!title || !abstract || !id) continue;

    entries.push({ id, title, abstract, authors, cats, updatedRaw, publishedRaw });
  }

  return entries;
}

/**
 * Build the arXiv search URL — simple category query sorted by date.
 * We deliberately avoid submittedDate range filters: arXiv's date index
 * lags and routinely returns 0 results even when papers exist.
 * Instead we fetch the most recent submissions and filter by published date
 * client-side using the <published> field in each entry.
 */
function buildUrl(start) {
  const params = new URLSearchParams({
    search_query: 'cat:cs.*',
    sortBy:       'submittedDate',
    sortOrder:    'descending',
    start:        String(start),
    max_results:  String(PAGE_SIZE)
  });
  return `${ARXIV_BASE}?${params}`;
}

/**
 * Return the UTC date string "YYYY-MM-DD" for a given offset from today.
 * offset=0 → today, offset=-1 → yesterday, etc.
 */
function utcDateStr(offset = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

/**
 * Fetch today's CS papers from arXiv, then apply heuristic scoring
 * and return the top `topN` papers by score.
 *
 * Strategy: query cat:cs.* sorted by submittedDate descending (no date filter —
 * arXiv's date index lags and returns 0 results if used). Filter client-side
 * by the <published> field, accepting papers from the last 2 days to handle
 * arXiv's release schedule (new submissions appear ~20:00-22:00 UTC Sun-Thu,
 * still with yesterday's date stamp).
 *
 * @param {number} topN  - how many papers to return after filtering (default 25)
 * @returns {{ papers: object[], meta: object }}
 */
export async function fetchPapers(topN = 25) {
  console.log('📡  Fetching today\'s arXiv CS submissions (paginated)…');

  const headers = {
    'User-Agent': 'arxiv-cs-digest/1.0 (nightly build; https://github.com/seeread/arxiv-digest)'
  };

  // Accept papers whose <updated> date (= arXiv release date) falls within
  // the last 3 days. The 3-day window handles:
  //   - arXiv's Sun-Thu release schedule (no new papers Fri/Sat)
  //   - timezone edge cases at UTC midnight
  //   - the occasional day where arXiv releases early or late
  const acceptDates = new Set([utcDateStr(0), utcDateStr(-1), utcDateStr(-2)]);
  console.log(`    📅  Accepting papers updated on: ${[...acceptDates].join(', ')}`);

  const allPapers = [];
  let totalFetched = 0;
  let hitOldPapers = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const start = page * PAGE_SIZE;
    const url   = buildUrl(start);

    if (page > 0) {
      console.log(`    ⏳  Waiting ${DELAY_MS / 1000}s before next page…`);
      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    console.log(`    📄  Fetching page ${page + 1} (offset ${start})…`);
    const res = await fetch(url, { headers });

    if (!res.ok) {
      throw new Error(`arXiv API returned ${res.status}: ${res.statusText}`);
    }

    const xml     = await res.text();
    const entries = parseFeed(xml);

    if (entries.length === 0) {
      console.log(`    ✓  No more results — stopping pagination`);
      break;
    }

    // Filter to accepted date window using <updated> (= arXiv release date).
    // Stop paginating once we see entries updated before our window.
    let keptThisPage = 0;
    const oldestAccepted = [...acceptDates].sort()[0];
    for (const entry of entries) {
      const entryDate = (entry.updatedRaw || '').slice(0, 10); // "YYYY-MM-DD"
      if (acceptDates.has(entryDate)) {
        allPapers.push(entry);
        keptThisPage++;
      } else if (entryDate && entryDate < oldestAccepted) {
        // Entry is older than our window — no point fetching more pages
        hitOldPapers = true;
        break;
      }
      // entries with no date or future dates: skip silently
    }

    totalFetched += entries.length;
    console.log(`    ✓  Page ${page + 1}: ${entries.length} fetched, ${keptThisPage} in date window (running total: ${allPapers.length})`);

    if (hitOldPapers) {
      console.log(`    ✓  Reached papers older than window — stopping pagination`);
      break;
    }

    // If we got fewer than PAGE_SIZE, we've hit the end of arXiv results
    if (entries.length < PAGE_SIZE) break;
  }

  // Fallback: if date filtering returned nothing (e.g. weekend, holiday,
  // arXiv outage), widen to 7 days and retry once.
  if (allPapers.length === 0) {
    console.warn('⚠️  Date filter (3 days) returned 0 papers — widening to 7 days');
    const wideDates = new Set([0,-1,-2,-3,-4,-5,-6].map(utcDateStr));
    const res = await fetch(buildUrl(0), { headers });
    if (!res.ok) throw new Error(`arXiv API returned ${res.status}: ${res.statusText}`);
    const xml = await res.text();
    const wide = parseFeed(xml).filter(e => wideDates.has((e.updatedRaw||'').slice(0,10)));
    if (wide.length > 0) {
      allPapers.push(...wide);
      console.log(`    ✓  7-day fallback found ${wide.length} papers`);
    } else {
      // Last resort: take top 200 unfiltered — better than an empty digest
      console.warn('⚠️  7-day fallback also empty — using most-recent 200 unfiltered');
      allPapers.push(...parseFeed(xml));
    }
    if (allPapers.length === 0) {
      throw new Error('No papers fetched from arXiv — possible API issue');
    }
  }

  // ── Compute metadata aggregates (free — no API calls) ─────────────────
  const meta = computeMeta(allPapers);
  console.log(`📊  ${allPapers.length} total papers fetched. Computing metadata…`);
  console.log(`    Categories: ${Object.entries(meta.topCats).slice(0,5).map(([k,v])=>`${k}=${v}`).join(', ')}`);

  // ── Score and select top papers ────────────────────────────────────────
  console.log(`🔍  Scoring papers with heuristic filter…`);
  const scored = allPapers
    .map(p => ({ ...p, _score: scorePaper(p) }))
    .sort((a, b) => b._score - a._score);

  // Show score distribution
  const highScore = scored[0]?._score || 0;
  const medScore  = scored[Math.floor(scored.length / 2)]?._score || 0;
  console.log(`    Score range: top=${highScore}, median=${medScore}`);

  // Take top N, then trim abstract back to 600 chars for Claude prompt
  const selected = scored.slice(0, topN).map(({ _score, ...p }) => ({
    ...p,
    abstract: p.abstract.slice(0, 600)
  }));

  console.log(`✅  Selected ${selected.length} papers from ${allPapers.length} submissions`);

  return { papers: selected, meta };
}

// ── Metadata aggregation (free) ────────────────────────────────────────────

/**
 * Compute metadata aggregates from the full paper set.
 * Completely free — no API calls.
 */
function computeMeta(papers) {
  const total = papers.length;

  // Category breakdown
  const catCounts = {};
  let crossListed = 0;
  let primaryOnly = 0;

  for (const p of papers) {
    const cats = p.cats.split(/\s+/).filter(Boolean);
    if (cats.length > 1) crossListed++;
    else primaryOnly++;

    // Count primary category
    const primary = cats[0];
    if (primary) catCounts[primary] = (catCounts[primary] || 0) + 1;
  }

  // Top categories sorted by count
  const topCats = Object.fromEntries(
    Object.entries(catCounts).sort(([,a],[,b]) => b - a).slice(0, 10)
  );

  // Venue mentions in titles/abstracts
  const VENUES_TO_COUNT = [
    'NeurIPS', 'ICML', 'ICLR', 'CVPR', 'ICCV', 'ECCV',
    'ACL', 'EMNLP', 'NAACL', 'ICRA', 'IROS', 'AAAI', 'IJCAI'
  ];
  const venueCounts = {};
  for (const venue of VENUES_TO_COUNT) {
    const re = new RegExp(`\\b${venue}\\b`, 'i');
    const count = papers.filter(p =>
      re.test(p.title) || re.test(p.abstract)
    ).length;
    if (count > 0) venueCounts[venue] = count;
  }

  // Top venue by mentions
  const topVenuePairs = Object.entries(venueCounts)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 5);
  const topVenues = Object.fromEntries(topVenuePairs);

  // Dominant category percentage
  const topCatName = Object.keys(topCats)[0] || '—';
  const topCatCount = topCats[topCatName] || 0;
  const topCatPct = total ? Math.round(topCatCount / total * 100) : 0;

  // Total venue-mentioned papers
  const venuePaperCount = papers.filter(p => {
    const c = (p.title + ' ' + p.abstract).toLowerCase();
    return TOP_VENUES.some(v => c.includes(v));
  }).length;

  return {
    total,
    crossListed,
    primaryOnly,
    topCats,
    topVenues,
    topCatName,
    topCatPct,
    venuePaperCount
  };
}
