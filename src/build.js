#!/usr/bin/env node
/**
 * build.js — main entry point
 *
 * Usage:
 *   node src/build.js           # full build (batch API)
 *   node src/build.js --dev     # synchronous API, faster for testing
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY   required
 *   CLAUDE_MODEL        optional, default: claude-haiku-4-5-20251001
 *   USE_BATCH           optional, default: true (set 'false' for sync)
 *   OUTPUT_DIR          optional, default: dist
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join }                     from 'path';
import { fetchPapers }              from './fetch-papers.js';
import { summarisePapers }          from './summarise.js';
import { buildHTML }                from './template.js';

const isDev     = process.argv.includes('--dev');
const outputDir = process.env.OUTPUT_DIR || 'dist';

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

  // 1. Fetch papers
  const papers = await fetchPapers(20);

  // 2. Summarise with Claude
  const digest = await summarisePapers(papers);

  // 3. Render HTML
  console.log('🎨  Rendering HTML…');
  const html = buildHTML(digest);

  // 4. Write output
  mkdirSync(outputDir, { recursive: true });
  const outPath = join(outputDir, 'index.html');
  writeFileSync(outPath, html, 'utf8');

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`\n✅  Done in ${elapsed}s → ${outPath}`);
  console.log(`    ${html.length.toLocaleString()} bytes`);
  // fix should not hang on exit
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌  Build failed:', err.message);
  process.exit(1);
});
