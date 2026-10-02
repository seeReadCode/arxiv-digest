# arXiv CS Digest — Nightly Build

A nightly-generated editorial digest of arXiv Computer Science submissions.
Every night at 11:10 PM UTC, GitHub Actions fetches the day's papers,
summarises them with Claude, and deploys a fresh static site to Cloudflare Pages.

**Cost:** ~$0.07/night (Haiku 4.5 via Batch API) · Hosting: free

---

## Setup — from zero to live in ~30 minutes

### 1. Fork or clone this repo

```bash
git clone https://github.com/YOUR_USERNAME/arxiv-digest.git
cd arxiv-digest
```

Make the repo **public** — this gives you unlimited free GitHub Actions minutes.

---

### 2. Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create a new API key
3. Recommended: set a **monthly spend cap of $5** under Billing → Limits

---

### 3. Add the secret to GitHub

1. In your repo: **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `ANTHROPIC_API_KEY`
3. Value: your key from step 2

---

### 4. Connect Cloudflare Pages

1. Sign up at [pages.cloudflare.com](https://pages.cloudflare.com) (free)
2. **Create a project → Connect to Git → select this repo**
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave blank)*
   - **Build output directory:** `dist`
4. Click **Save and Deploy**

Cloudflare Pages will now redeploy automatically whenever a new
`dist/index.html` is committed to the repo.

---

### 5. Test the build locally

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...
node src/build.js --dev     # synchronous API, faster for testing
open dist/index.html
```

---

### 6. Trigger the first nightly build

In GitHub: **Actions → Nightly arXiv Digest → Run workflow**

The workflow will:
1. Fetch today's arXiv CS submissions
2. Send them to Claude (Batch API, ~10–20 min)
3. Render the HTML
4. Commit `dist/index.html` → Cloudflare auto-deploys within 30 s

---

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required. Set as GitHub secret. |
| `CLAUDE_MODEL` | `claude-haiku-4-5-20251001` | Swap to `claude-sonnet-4-6` for better quality (~6× cost) |
| `USE_BATCH` | `true` | Set `false` for synchronous API (faster, 2× price) |
| `OUTPUT_DIR` | `dist` | Where `index.html` is written |

All set in `.github/workflows/nightly.yml`.

---

## Cost

| Model | Mode | Per night | 6 months |
|---|---|---|---|
| Haiku 4.5 | Batch | ~$0.07 | ~$13 |
| Sonnet 4.6 | Batch | ~$0.42 | ~$76 |

Hosting (Cloudflare Pages) and automation (GitHub Actions) are free.

---

## Project structure

```
arxiv-digest/
├── .github/
│   └── workflows/
│       └── nightly.yml      # GitHub Actions cron + deploy
├── src/
│   ├── build.js             # main entry point
│   ├── fetch-papers.js      # arXiv API fetcher
│   ├── summarise.js         # Claude API (batch + sync)
│   └── template.js          # HTML renderer
├── dist/
│   └── index.html           # built output (committed by CI)
├── package.json
└── README.md
```

---

## Custom domain (optional, ~$1/mo)

1. Buy a domain at [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) (at-cost, ~$10/yr for .com)
2. In Cloudflare Pages: **Custom domains → Add domain**
3. Done — no DNS config needed when domain is also on Cloudflare

---

## Weekends

arXiv does not publish new submissions on weekends. The cron still runs
but the fetcher will return Friday's papers again — the build script
commits only when `dist/index.html` actually changes, so no spurious commits.
