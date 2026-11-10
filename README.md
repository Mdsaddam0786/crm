# JV CRM

A private CRM for the company's **JV Listing Google Sheet**
(its ID is set in the `GOOGLE_SPREADSHEET_ID` environment variable and is deliberately kept out of this repository). Employees sign in, then search, filter and open any joint-venture listing without working through the spreadsheet itself.

- **Source of truth:** the Google Sheet. The CRM is **strictly read-only**: it never edits, deletes or overwrites anything there. To change a record, edit the sheet, then click **Refresh data** (or wait for the cache to expire, 5 minutes by default).
- **Stack:** React 18 + Vite + Tailwind CSS + React Router + Axios + Lucide (frontend); Node.js + Express (backend); Google Sheets API v4 or the sheet's link-sharing CSV export (data). No database is needed.

## Features

| Area | What it does |
|---|---|
| Dashboard | Total listings, total land area (interpreted from Area), average rating, unique contacts, listings by month (from the JV ID), breakdowns by Feasibility owner / UPDATED BY / rating / sharing ratio, deal progress (LOI / MOU / JDA / Status), and latest listings. Click any bar to open the matching listings. |
| JV Listings | Shows every sheet column. Debounced global search across all fields (including partial phone numbers), an advanced filter panel that combines filters (multi-select, contains, has value/blank, month, acre range), sorting on every column, pagination with 10/25/50/100 rows per page, a sticky JV ID column, horizontal scrolling, a column chooser, and CSV export of the current view. Search and filter state lives in the URL, so a view can be shared. |
| Listing detail | Every field of the row, grouped into Overview / Source & Contact / Property / Commercials / Deal Documents, plus *Other details* for unrecognised columns. Call, WhatsApp, Google Maps and **Open in Sheet** (jumps to the exact row) actions, copy buttons, data notes, and previous/next navigation. |
| Contacts | Groups listings by REA NO, using names from UPDATED BY, with call and WhatsApp actions. |
| Reports | Breakdowns, a land-area summary, and a **data-quality report**: completeness per column, blank rows, empty or headerless columns, inconsistent spelling, placeholder values, and per-record notes. |
| Settings | Connection health, access method, tabs and record counts, last sync, manual refresh (admins only), and the current account. |

### How the sheet is interpreted
- **Headers are mapped dynamically.** Columns are recognised by header text (e.g. "JV ID", "REA NO", "GOOGLE PIN"). New or renamed columns still appear, under *Other details*. Every worksheet tab is loaded; when there is more than one, a tab picker appears in the top bar.
- **Original values are preserved exactly.** Derived values are labelled as such and never replace the original text:
  - *Area → acres* (1 acre = 40 guntas; "(Net Area …)" notes are ignored).
  - *Month* from the JV ID (`YYYY.MON.NNN`, e.g. `2025.JAN.001` → Jan 2025).
  - *Sharing:* Google Sheets auto-formats `60:40` as the time `60:40:00`. The CRM shows `60:40` and keeps the stored value in a tooltip.
- **Nothing is silently dropped.** Blank rows are skipped but listed in Reports. Duplicate JV IDs or duplicate rows are kept and flagged. Name casing (e.g. "Ravi"/"ravi") is grouped together for filters, while the original spelling is still displayed.

## Quick start (local)

Requirements: Node.js 18.18+ (tested on Node 24).

```bash
npm install
cp .env.example .env              # then fill in the values below
npm run hash-password -- admin admin "a-strong-password"   # paste the output into APP_USERS
npm run test:connection           # verifies Google access and prints tabs/columns/record counts
npm run build && npm start        # http://localhost:4000
```

Development with hot reload: `npm run dev` (UI at http://localhost:5173, API at :4000).

### Users and roles
`APP_USERS` in `.env` holds `username:role:bcryptHash` entries, separated by `;`.
- `admin`: everything, including **Refresh data**.
- `viewer`: search, view and export listings.

Generate each entry with `npm run hash-password -- <username> <admin|viewer> <password>`. Removing a user from `APP_USERS` and restarting the server revokes their access immediately.

## Google access

`GOOGLE_AUTH_MODE=auto` picks the first available method:

1. **Service account (recommended for private data)**
   1. Google Cloud Console → create or select a project → enable the **Google Sheets API**.
   2. IAM & Admin → Service Accounts → create one (no roles needed) → Keys → *Add key* → JSON.
   3. Open the JV spreadsheet → **Share** → add the service-account email (`…@….iam.gserviceaccount.com`) as **Viewer**.
   4. Save the key outside the web root (e.g. `credentials/service-account.json`, which is git-ignored) and set `GOOGLE_SERVICE_ACCOUNT_FILE`, or paste the JSON into `GOOGLE_SERVICE_ACCOUNT_JSON`.
   5. Run `npm run test:connection`.

   Only the read-only scope `spreadsheets.readonly` is requested. No Drive-wide access is needed.
2. **API key** (`GOOGLE_API_KEY`): Sheets API with an API key. This works only while the sheet is link-shared.
3. **Public CSV** (no credentials): works while the sheet's sharing is *Anyone with the link can view*. **This is what the CRM uses today.**

> ⚠️ **Security recommendation:** the JV sheet is currently readable by anyone who has its link, and it contains phone numbers and commercial terms. Set up a service account (option 1), then change the sheet's sharing to *Restricted*. The CRM keeps working without code changes.

If access fails (sharing revoked, key expired, quota exceeded), the CRM shows a banner with the reason and a fix, and keeps serving the last successfully synced data.

## Deployment

It is a single Node app: Express serves the API and the built React app on one port.

```bash
npm ci
npm run build
NODE_ENV=production TRUST_PROXY=true npm start
```

Production checklist:
- Serve over **HTTPS** only. With `NODE_ENV=production`, session cookies are `Secure`, `HttpOnly` and `SameSite=Strict`.
- Set environment variables in the host's dashboard (never commit `.env` or key files). On platforms without a file system for secrets, use `GOOGLE_SERVICE_ACCOUNT_JSON`.
- Set `TRUST_PROXY=true` behind a reverse proxy or load balancer, so login rate-limiting sees real client IPs.
- Use a fresh, random `SESSION_SECRET` (at least 32 characters).
- Pages carry `noindex`. All data endpoints require sign-in, and API responses are `Cache-Control: no-store`.

Works on any Node host: Hostinger Node.js hosting / VPS, Render, Railway, a company VM behind Nginx, etc. (start command `npm start`, build command `npm run build`).

### Vercel
The repo is Vercel-ready: `vercel.json` builds the React app into `client/dist` and routes `/api/*` to the Express app (`api/index.js`). In the Vercel project, open **Settings → Environment Variables** and set: `NODE_ENV=production`, `TRUST_PROXY=true`, `SESSION_SECRET`, `APP_USERS`, `GOOGLE_SPREADSHEET_ID` and, for a service account, `GOOGLE_SERVICE_ACCOUNT_JSON` (the whole key on one line). Redeploy after changing variables.

## API

All endpoints except `/api/health` and `/api/auth/login` require a session cookie.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` · `/api/auth/logout` | Sign in / out (login is rate-limited) |
| GET | `/api/auth/me` | Current user |
| GET | `/api/jv` | Listings. `q`, `filters` (JSON), `sort`, `dir`, `page`, `pageSize` (≤500), `sheet` |
| GET | `/api/jv/:id` | One listing (by JV ID, or `row-N` when the JV ID is missing or duplicated), with prev/next and a link to the sheet row |
| GET | `/api/jv/metadata` | Columns, detected roles, filter options, tabs |
| GET | `/api/jv/stats` | Dashboard statistics |
| GET | `/api/jv/quality` · `/api/jv/contacts` | Data-quality report · contacts |
| GET | `/api/jv/export` | CSV of the current filtered view (raw sheet values) |
| POST | `/api/jv/refresh` | Re-read the sheet now (admin) |
| GET | `/api/source/status` | Connection / sync status |

`filters` example: `{"feasibility_made_by":{"op":"in","values":["ravi"]},"_areaAcres":{"op":"range","min":4}}`. The operations are `in`, `contains`, `filled`, `blank` and `range`.

## Testing

1. `npm run test:connection`: confirms Google access and prints each tab's headers and record count. Compare the counts with the sheet.
2. Sign in → Dashboard totals should match the sheet. Click a bar → the listings are filtered to match.
3. JV Listings: search for part of a phone number or a village name; combine filters; sort by Area (sorts by interpreted acres); change rows per page; export CSV and compare it with the sheet.
4. Open a listing → check every column against the sheet row (use **Open in Sheet**).
5. Edit a cell in the sheet → **Refresh data** → the change appears.
6. Security: open `/api/jv` in a private window → `401`. Sign in as a `viewer` → there is no Refresh button, and `POST /api/jv/refresh` returns `403`.
