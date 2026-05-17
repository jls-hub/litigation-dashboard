# The Litigation Record

Live dashboard for Democracy Forward's tracking of legal responses to the Trump-Vance administration. Hosted on GitHub Pages; data refreshes from the Airtable bases daily, plus on-demand from the Actions tab.

## How it works

```
   ┌──────────────────────┐
   │  Airtable            │
   │   Response Center    │
   │   DF Actions         │
   └──────────┬───────────┘
              │ HTTPS + token
              ▼
   ┌──────────────────────┐
   │  GitHub Action       │  ← AIRTABLE_TOKEN lives in GitHub Secrets
   │   1. fetch records   │
   │   2. transform JSON  │
   │   3. build React app │
   │   4. deploy to Pages │
   └──────────┬───────────┘
              │
              ▼
   ┌──────────────────────┐
   │  GitHub Pages        │  username.github.io/repo-name
   └──────────────────────┘
```

The Action runs:
- **Daily at 06:00 UTC** (~01:00–02:00 ET) — automatic refresh
- **On manual trigger** — Actions tab → "Build and deploy" → Run workflow
- **On push to main** — when code changes

The Airtable token never leaves GitHub Actions' environment. The built site only contains the transformed JSON.

## Deploy (first time)

### 1. Push this code to a new GitHub repo

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-ORG/litigation-dashboard.git
git push -u origin main
```

### 2. Create an Airtable Personal Access Token

Go to https://airtable.com/create/tokens. Scopes: `data.records:read`. Access: add both bases (`appWYhb4LZn5yS2M0` Response Center, `appPxRYjblt7XYsoE` DF Actions). Copy the `pat_…` token.

### 3. Add the token to GitHub Secrets

In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**. Add these five, one at a time:

| Name | Value |
|---|---|
| `AIRTABLE_TOKEN` | the `pat_…` from step 2 |
| `RESPONSE_CENTER_BASE_ID` | `appWYhb4LZn5yS2M0` |
| `RESPONSE_CENTER_TABLE` | name of the lawsuits table tab in that base |
| `DF_ACTIONS_BASE_ID` | `appPxRYjblt7XYsoE` |
| `DF_ACTIONS_TABLE` | name of the actions table tab |

To find the table names: open each base in the Airtable web UI; the tab name at the top is what you want. Exact spelling.

### 4. Enable GitHub Pages

**Settings → Pages → Build and deployment → Source: GitHub Actions.** That's the only setting; nothing else to configure.

### 5. Trigger the first deploy

The push from step 1 should already have started a workflow run. Watch it under the **Actions** tab. First run takes ~1–2 minutes. When it finishes, your site is live at `https://YOUR-ORG.github.io/litigation-dashboard/`.

If the first run fails with a 404 from Airtable, the table names are wrong. Update the relevant secret (Settings → Secrets), then re-run from the Actions tab.

## Refreshing data

- **Wait for tomorrow's cron** — happens automatically at 06:00 UTC.
- **Force refresh now** — Actions tab → "Build and deploy" (left sidebar) → "Run workflow" button (right side, gray) → Run workflow. About 60 seconds end to end.

## Local development

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173`. It reads `public/data/data.json` — which is committed as an empty stub, so you'll see the dashboard with zero rows. To work with real data locally:

```bash
cp .env.example .env
# edit .env, fill in your Airtable token
# then load it and fetch (one of):
node --env-file=.env scripts/fetch-airtable.mjs
# OR with dotenv-cli installed:
npx dotenv -e .env -- npm run fetch-data
```

Don't commit `.env` (it's in `.gitignore`). Don't commit a real `public/data/data.json` either — let the GitHub Action handle that.

## Customizing

- Partner attribution regexes → `scripts/fetch-airtable.mjs`, `PARTNERS` array
- Action type taxonomy → same file, `ACTION_TYPE_CODES`
- Colors, typography, layout → `src/LitigationDashboard.jsx`, constants near the top
- Cron schedule → `.github/workflows/deploy.yml`, the `cron:` line
- Time-window filter for DF Actions → `scripts/fetch-airtable.mjs`, `TRUMP_2_START` constant

## Known data gaps

Surfaced in the dashboard's colophon, but worth flagging here too:

- **Outcome counts** lag the manual topline doc — the Relief Outcome field in Airtable is undertagged for recent cases.
- **MSPB / OSC cases** (~73 referenced in the topline doc) are tracked outside the DF Actions table and aren't visualized.
- **EO / policy response counts** need the Policies tab of the Response Center, which isn't queried.
