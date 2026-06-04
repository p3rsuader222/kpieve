# KPIeve

A focused, visually polished dashboard for an **Onboarding Team Lead** to track how the
team is hitting KPIs across the **LT · LV · EE · PL** markets. The lead updates numbers
each morning in‑app; the dashboard shows targets, trends, per‑member / per‑market
breakdowns, and a coverage heatmap.

- **Stack:** Vite · React · TypeScript · Tailwind CSS · TanStack Query · Recharts · Framer Motion
- **Data:** Supabase (Postgres + Auth), with a deterministic **mock mode** for zero‑setup previews
- **Hosting:** GitHub → Netlify (static SPA)

---

## Quick start (mock mode — no backend)

```bash
npm install
npm run dev
```

Open the printed URL. With no Supabase credentials, the app runs in **demo mode** with a
built‑in, realistic dataset and **no login** — ideal for trying the UI. Editing/saving is
disabled until Supabase is connected.

---

## Going live with Supabase

### 1. Create the database
1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
   This creates the tables, Row Level Security policies, and seeds markets, the team, and the starter KPIs.

### 2. Create the shared login (the "password gate")
1. **Authentication → Users → Add user** → set an email + password. This single account is
   the dashboard password. Share the password with whoever should have access.
2. (Recommended) **Authentication → Providers → Email**: turn **off** "Confirm email" so the
   account works immediately, and disable public sign‑ups.

### 3. Configure environment
Copy `.env.example` to `.env` and fill in (from **Project Settings → API**):

```ini
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
# Optional: shows a password‑only login (otherwise the form also asks for email)
VITE_AUTH_EMAIL=team@your-company.com
```

> The anon key is **safe** to ship in the client bundle: RLS denies all unauthenticated
> access, so data is only readable/writable after login.

Restart `npm run dev`. You'll now get the login screen and live data.

---

## Deploy to Netlify

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import an existing project** → pick the repo.
   Build settings are read from [`netlify.toml`](netlify.toml) (`npm run build` → `dist`, SPA redirects).
3. **Site settings → Environment variables**: add `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, and optionally `VITE_AUTH_EMAIL`.
4. Deploy. Every push to the default branch redeploys automatically.

---

## Daily use

- **Dashboard** (`/`) — overall adherence, KPI cards (value vs target, trend, Δ vs previous
  period), trend chart (Team / Market / Member split), team leaderboard, per‑KPI breakdown,
  and the member × market heatmap. Toggle the time range (Today / Week / Month) and light/dark.
- **Update** (`/update`) — pick the date, type each member's number per market for each KPI,
  then **Save all**. Re‑opening a date shows what's already saved so you can correct it.
- **Settings** (`/settings`) — add / rename KPIs and set targets, manage team members and the
  markets they cover. No code required.

---

## How metrics roll up

Each KPI has an **aggregation**:
- **Sum** (e.g. *Clients onboarded*) — values and targets add up across members/markets/days.
- **Average** (e.g. *Completion rate*, *CSAT*, *SLA*, *time‑to‑onboard*) — the mean over the period.

A KPI's **direction** (`higher_better` / `lower_better`) decides whether being above or below
target is good. Status thresholds live in [`src/lib/status.ts`](src/lib/status.ts)
(on‑track ≥ 97% of target, at‑risk ≥ 85%, else off‑track).

---

## Roadmap: Google Sheets automation

The schema is automation‑ready: `entries` carries a `source` column (`manual` | `sheet`) and a
unique key on `(kpi_id, member_id, market_id, date)` for clean upserts. A future Supabase Edge
Function (or Netlify scheduled function) can pull a Google Sheet via the Sheets API and upsert
rows with `source='sheet'` — without changing the UI.

---

## Project structure

```
src/
  lib/         types, formatting, status logic, metrics engine, mock data, supabase client
  data/        datasource (mock ⇄ Supabase) + mutations
  context/     AuthContext (password gate)
  hooks/       useDashboard, useTheme, useThemeColors, mutation hooks
  components/  ui/ (primitives) · layout/ · dashboard/ · settings/
  pages/       Dashboard, Update, Settings, Login
supabase/      schema.sql (tables, RLS, seed)
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type‑check + production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
