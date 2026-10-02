/**
 * summarise.js
 * Sends arXiv papers to the Claude API (Batch for cost savings, with a
 * synchronous fallback) and returns a structured digest JSON object.
 *
 * Model: claude-haiku-4-5  (budget option, ~$0.07/night via Batch API)
 * Switch MODEL to 'claude-sonnet-4-6' for higher quality (~$0.42/night)
 */

import Anthropic from '@anthropic-ai/sdk';

const MODEL        = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const USE_BATCH    = process.env.USE_BATCH !== 'false'; // default true
const BATCH_POLL_MS = 10_000; // poll every 10 s

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Prompt ────────────────────────────────────────────────────────────────

function buildPrompt(papers) {
  const list = papers.map((p, i) =>
    `[${i + 1}] ID:${p.id}\nTitle: ${p.title}\nAuthors: ${p.authors}\nCats: ${p.cats}\nAbstract: ${p.abstract}`
  ).join('\n\n');

  return `You are the editor of a beautiful daily digest of arXiv CS papers. Given today's top submissions, produce a JSON object matching this EXACT schema. Return ONLY valid JSON — no markdown fences, no explanation, no preamble.

SCHEMA:
{
  "heroHeadline": "5-8 word punchy headline capturing today's dominant theme. Wrap 1-2 key words in <em> tags for emphasis.",
  "heroSummary": "2-3 sentence editorial summary: what themes dominate, what's surprising, what's consequential. Voice: intelligent science journalist.",
  "stats": [
    { "num": "string", "label": "string" }
  ],
  "callouts": [
    {
      "tag": "one of: Machine Learning | Computer Vision | AI Safety | Robotics | Systems | NLP",
      "tagClass": "one of: tag-ml | tag-cv | tag-ai | tag-ro | tag-se | tag-ml",
      "title": "8-12 word punchy title for this finding",
      "body": "2-sentence plain-English explanation: what it does, why it matters",
      "finding": "The single most surprising/important concrete result — 1 sentence",
      "authors": "surname, surname et al.",
      "id": "arxiv id string"
    }
  ],
  "papers": [
    {
      "index": "zero-padded string e.g. 01",
      "title": "paper title (may shorten slightly)",
      "summary": "1-2 sentence plain-English summary: problem, approach, result",
      "tags": ["cs.XX", "cs.YY"],
      "venue": "conference/journal if detectable, else empty string",
      "authors": "up to 3 author surnames"
    }
  ],
  "researcher": {
    "initials": "2 capital letters",
    "avatarColor": "one of: #F5A623 | #00C8E0 | #7ED8A0 | #C890F0",
    "avatarBg": "rgba version with 0.15 opacity e.g. rgba(245,166,35,0.15)",
    "name": "Full Name",
    "title": "Role · Institution",
    "bio": "3 sentences: research focus, notable contributions, why featured today",
    "citations": "approximate citation count e.g. 4,200+",
    "venue": "most notable recent venue abbreviation e.g. NeurIPS '25",
    "paperTitle": "their paper title shortened to ~8 words",
    "paperVenue": "venue or arXiv ID"
  },
  "trends": [
    {
      "rank": "01",
      "field": "subfield display name",
      "count": "NNN papers this week",
      "heights": [6, 9, 12, 10, 18]
    }
  ]
}

RULES:
- Exactly 4 callouts — choose the most interesting/surprising papers
- All ${papers.length} papers in papers array, in order
- Exactly 5 trend items based on categories present
- Pick the most prolific or interesting author as featured researcher
- stats: 3-4 items (total count, dominant category %, notable venues count, etc.)
- Return ONLY valid JSON

TODAY'S PAPERS:
${list}`;
}

// ── Batch API path (50% cheaper, async) ──────────────────────────────────

async function summariseViaBatch(papers) {
  console.log(`🤖  Submitting batch request (model: ${MODEL})…`);

  const batch = await client.messages.batches.create({
    requests: [{
      custom_id: 'digest',
      params: {
        model:      MODEL,
        max_tokens: 8192,
        messages:   [{ role: 'user', content: buildPrompt(papers) }]
      }
    }]
  });

  console.log(`⏳  Batch ${batch.id} submitted — polling every ${BATCH_POLL_MS / 1000}s…`);

  // Poll until ended
  while (true) {
    await new Promise(r => setTimeout(r, BATCH_POLL_MS));
    const status = await client.messages.batches.retrieve(batch.id);
    console.log(`    status: ${status.processing_status} (${status.request_counts?.processing ?? '?'} remaining)`);

    if (status.processing_status === 'ended') {
      // Stream results
      for await (const result of await client.messages.batches.results(batch.id)) {
        if (result.custom_id === 'digest' && result.result.type === 'succeeded') {
          return result.result.message.content[0].text;
        }
        if (result.result.type === 'errored') {
          throw new Error(`Batch request errored: ${JSON.stringify(result.result.error)}`);
        }
      }
      throw new Error('Batch completed but digest result not found');
    }
  }
}

// ── Synchronous API path (fallback / dev) ────────────────────────────────

async function summariseSynchronous(papers) {
  console.log(`🤖  Sending synchronous request (model: ${MODEL})…`);

  const msg = await client.messages.create({
    model:      MODEL,
    max_tokens: 8192,
    messages:   [{ role: 'user', content: buildPrompt(papers) }]
  });

  return msg.content[0].text;
}

// ── Parse + validate ──────────────────────────────────────────────────────

/**
 * Attempt to repair a truncated or slightly malformed JSON string so it
 * can be parsed. Handles the two most common Claude failure modes:
 *   1. Response cut off mid-stream (max_tokens hit) — close open structures
 *   2. Trailing comma before ] or } — strip it
 */
function repairJSON(str) {
  // Remove trailing commas before ] or }
  let s = str.replace(/,\s*([}\]])/g, '$1');

  // Close any unclosed structures by tracking the stack
  const opens = [];
  let inString = false;
  let escape   = false;

  for (const ch of s) {
    if (escape)          { escape = false; continue; }
    if (ch === '\\')     { escape = true;  continue; }
    if (ch === '"')      { inString = !inString; continue; }
    if (inString)        continue;
    if (ch === '{')      opens.push('}');
    else if (ch === '[') opens.push(']');
    else if (ch === '}' || ch === ']') opens.pop();
  }

  // If we're still inside a string, close it
  if (inString) s += '"';

  // Close any open arrays/objects in reverse order
  s += opens.reverse().join('');

  return s;
}

function parseResponse(raw) {
  // 1. Strip markdown fences
  let cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  // 2. Try parsing as-is first (happy path)
  try { return JSON.parse(cleaned); } catch { /* fall through */ }

  // 3. Extract outermost {...} in case there's surrounding text
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objMatch) cleaned = objMatch[0];

  // 4. Try again after extraction
  try { return JSON.parse(cleaned); } catch { /* fall through */ }

  // 5. Attempt structural repair (truncation / trailing commas)
  const repaired = repairJSON(cleaned);
  console.warn('⚠️  JSON needed repair — response may be incomplete');
  try { return JSON.parse(repaired); } catch (e) {
    // Log a snippet to help diagnose future issues
    const snippet = cleaned.slice(-120).replace(/\n/g, '↵');
    console.error(`    Tail of raw response: …${snippet}`);
    throw new Error(`Could not parse Claude response as JSON: ${e.message}`);
  }
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Summarise papers and return a structured digest data object.
 * Uses Batch API by default (50% cheaper); falls back to synchronous if
 * USE_BATCH=false or batch fails.
 */
export async function summarisePapers(papers) {
  let raw;

  if (USE_BATCH) {
    try {
      raw = await summariseViaBatch(papers);
    } catch (err) {
      console.warn(`⚠️  Batch failed (${err.message}), falling back to synchronous`);
      raw = await summariseSynchronous(papers);
    }
  } else {
    raw = await summariseSynchronous(papers);
  }

  console.log('✅  Claude response received — parsing…');
  const data = parseResponse(raw);

  // Light validation
  if (!data.heroHeadline || !Array.isArray(data.papers)) {
    throw new Error('Claude response missing required fields (heroHeadline, papers)');
  }

  return data;
}
