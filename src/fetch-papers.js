/**
 * fetch-papers.js
 * Fetches today's arXiv CS submissions via the public Atom API.
 * No API key needed. Returns an array of paper objects.
 */

const ARXIV_API =
  'https://export.arxiv.org/api/query' +
  '?search_query=cat:cs.*' +
  '&sortBy=submittedDate' +
  '&sortOrder=descending' +
  '&start=0' +
  '&max_results=50';       // top 50; Claude prompt uses up to 30

/**
 * Parse an arXiv Atom XML string into paper objects.
 * Runs in Node with the built-in DOMParser (Node 21+) or via regex fallback.
 */
function parseFeed(xml) {
  // Simple regex-based parser — no DOM dependency, works on any Node version
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];

    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].replace(/\s+/g, ' ').trim() : '';
    };

    const id    = get('id').split('/abs/')[1] || get('id');
    const title = get('title');
    const abstract = get('summary').slice(0, 600);

    const authorMatches = [...block.matchAll(/<name>([^<]+)<\/name>/g)];
    const authors = authorMatches.slice(0, 4).map(m => m[1].trim()).join(', ');

    const catMatches = [...block.matchAll(/term="(cs\.[A-Z]+)"/g)];
    const cats = [...new Set(catMatches.map(m => m[1]))].join(' ');

    // Skip malformed entries
    if (!title || !abstract || !id) continue;

    entries.push({ id, title, abstract, authors, cats });
  }

  return entries;
}

/**
 * Fetch and return up to `limit` papers from arXiv CS.
 */
export async function fetchPapers(limit = 30) {
  console.log('📡  Fetching arXiv CS submissions…');

  const res = await fetch(ARXIV_API, {
    headers: { 'User-Agent': 'arxiv-cs-digest/1.0 (nightly build; contact via GitHub)' }
  });

  if (!res.ok) {
    throw new Error(`arXiv API returned ${res.status}: ${res.statusText}`);
  }

  const xml     = await res.text();
  const papers  = parseFeed(xml).slice(0, limit);

  console.log(`✅  Fetched ${papers.length} papers`);
  return papers;
}
