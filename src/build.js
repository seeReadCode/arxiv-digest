#!/usr/bin/env node
/**
 * build.js — main entry point
 *
 * Usage:
 *   node src/build.js           # full build (batch API, paginated fetch)
 *   node src/build.js --dev     # synchronous API, faster for testing
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY   required
 *   CLAUDE_MODEL        optional, default: claude-haiku-4-5-20251001
 *   USE_BATCH           optional, default: true (set 'false' for sync)
 *   OUTPUT_DIR          optional, default: dist
 *   TOP_N               optional, how many papers to send to Claude (default 25)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join }                     from 'path';
import { fetchPapers }              from './fetch-papers.js';
import { summarisePapers }          from './summarise.js';
import { buildHTML }                from './template.js';

const isDev     = process.argv.includes('--dev');
const outputDir = process.env.OUTPUT_DIR || 'dist';
const topN      = parseInt(process.env.TOP_N || '25', 10);

if (isDev) {
  process.env.USE_BATCH = 'false';
  console.log('🔧  Dev mode — using synchronous API');
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌  ANTHROPIC_API_KEY is not set');
  process.exit(1);
}

async function main() {
  const startMs = Date.now();
  console.log('🚀  arXiv CS Digest — nightly build starting\n');

  // 1. Fetch today's papers (paginated) + compute free metadata aggregates
  const { papers, meta } = await fetchPapers(topN);

  // 2. Summarise the top-scored papers with Claude
  const digest = await summarisePapers(papers);

  // 3. Render HTML (pass meta for the "Today at a Glance" section)
  console.log('🎨  Rendering HTML…');
  const html = buildHTML(digest, meta);

  // 4. Write output
  mkdirSync(outputDir, { recursive: true });
  const outPath = join(outputDir, 'index.html');
  writeFileSync(outPath, html, 'utf8');

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\n✅  Done in ${elapsed}s → ${outPath}`);
  console.log(`    ${html.length.toLocaleString()} bytes`);
  console.log(`    ${papers.length} papers sent to Claude / ${meta.total} total submissions today`);
}

main().catch(err => {
  console.error('\n❌  Build failed:', err.message);
  process.exit(1);
});
