# KPIeve

A focused, visually polished dashboard for an **Onboarding Team Lead** to track how the
team is hitting KPIs across the **LT · LV · EE · PL** markets. It's **country‑first** and
**monthly**: the centerpiece is a Country × KPI matrix of **fact vs per‑country target**
(plus a TOTAL row), with per‑member breakdowns, month‑over‑month trends, and a coverage
heatmap. The lead enters each month's numbers in‑app and tunes targets per country/month.

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
   This creates the tables (incl. the `targets` table), Row Level Security policies, and seeds
   markets, the team, the 5 real KPIs, and the current month's per‑country targets.

> **Upgrading an existing v1 database?** Don't re‑run `schema.sql`. Instead run
> [`supabase/migrate-v2.sql`](supabase/migrate-v2.sql) once — it adds the `targets` table,
> swaps the placeholder KPIs for the real ones, and seeds the current month's targets
> (idempotent, safe to re‑run).

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

- **Dashboard** (`/`) — pick the month (◂ ▸). The **Country × KPI matrix** shows each
  country's Fact / Target and attainment, with a TOTAL row; click a country to focus its
  5 KPI cards. Below: month‑over‑month trend (Total / Market / Member split), team
  leaderboard, per‑KPI breakdown, and the member × market heatmap. Light/dark toggle in
  the sidebar.
- **Update** (`/update`) — pick the **day**, type each member's number per country for each
  KPI (column headers show the per‑country monthly target and the month‑to‑date total), then
  **Save all**. A daily **Entry log** lists the days already filled this month — click one to
  view/edit it. Entries are stored per day and roll up to the month on the dashboard.
- **Settings** (`/settings`) — edit the **per‑country / per‑month Targets** grid, add /
  rename KPIs, and manage team members and the markets they cover. No code required.

---

## How metrics roll up

Entries are logged **per day** (`yyyy-MM-dd`) and rolled up to the month: SUM KPIs add up
across days (and members/markets), AVG KPIs take the mean. The authoritative per‑country/month
target lives in the **`targets`** table (falling back to a KPI's `default_target`); a
country's Fact is the monthly aggregate of its members' daily entries.

Each KPI has an **aggregation**:
- **Sum** (e.g. *Sellers with 1st active offer*, *PHH ads*, *FBP*) — facts and targets add
  up across members/markets; the TOTAL row sums the countries.
- **Average** (e.g. *Late rate per portfolio CCD*) — the mean; the TOTAL row averages the
  countries.

A KPI's **direction** (`higher_better` / `lower_better`) decides whether being above or below
target is good — a *lower* late rate scores higher. Status thresholds live in
[`src/lib/status.ts`](src/lib/status.ts) (on‑track ≥ 97% of target, at‑risk ≥ 85%, else off‑track).

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
  pages/       Dashboard (country-first), Update (monthly), Settings, Login
supabase/      schema.sql (fresh install) · migrate-v2.sql (run once on an existing v1 DB)
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type‑check + production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
