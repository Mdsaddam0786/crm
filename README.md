# JV CRM

A private CRM for managing **Joint Venture (JV) land listings**. Employees sign in to add, edit, search, filter and open any listing. All data lives in the CRM's own database, and there is no dependency on Google Sheets or any other external data source.

- **Stack:** React 18 + Vite + Tailwind CSS + React Router + Axios + Lucide (frontend); Node.js + Express (backend).
- **Storage:** **MongoDB** (required on Vercel or any serverless host). For local use, a JSON file (`data/listings.json`) works without any setup.

## Features

| Area | What it does |
|---|---|
| Dashboard | Total listings, total land area (interpreted from Area), average rating, unique contacts, listings by month (from the JV ID), breakdowns by Feasibility owner / Updated By / rating / sharing ratio, and deal progress (LOI / MOU / JDA / Status). Click any bar to open the matching listings. |
| JV Listings | Debounced global search across all fields (including partial phone numbers), an advanced filter panel that combines filters, sorting on every column, pagination (10/25/50/100), a sticky JV ID column, a column chooser, and CSV export of the current view. Search and filter state lives in the URL, so a view can be shared. |
| Add / edit | A form grouped into sections. The next JV ID is suggested automatically (`YYYY.MON.NNN`), and existing values are offered as suggestions. Duplicate JV IDs and unsafe links are rejected. Edits are conflict-safe: if someone else saved first, you are asked to reload. |
| Listing detail | All fields in sections; Call, WhatsApp and Google Maps actions; copy buttons; data notes; who created or last changed the listing and when; previous/next navigation. |
| Contacts | Listings grouped by REA No, with call and WhatsApp actions. |
| Reports | Breakdowns, a land-area summary, and a data-quality report (completeness, inconsistent spellings, placeholder values, per-listing notes). |
| Settings | Database status, CSV export, **CSV import** (preview first; existing JV IDs are skipped or updated, never duplicated), and account info. |

### Roles
| Role | Can |
|---|---|
| `admin` | everything: add, edit, delete, import |
| `editor` | add and edit listings |
| `viewer` | search, view and export |

## Quick start (local)

Requirements: Node.js 18.18+.

```bash
npm install
cp .env.example .env
npm run hash-password -- admin admin "a-strong-password"   # paste the output into APP_USERS
npm run build && npm start                                  # http://localhost:4000
```

With `MONGODB_URI` left empty, data is saved to `data/listings.json` (git-ignored). Back this file up.

Development with hot reload: `npm run dev` (UI at http://localhost:5173, API at :4000).

### Bringing in existing listings
Export your current list as CSV (in Google Sheets: *File → Download → Comma-separated values*), then either:
- **in the app:** Settings → *Import listings from CSV* → Preview → Import, or
- **from the command line:** `npm run import -- listings.csv` (add `--dry-run` to preview, or `--update` to overwrite existing JV IDs).

Columns are matched by header name (e.g. "JV ID", "REA NO", "GOOGLE PIN", "ROAD WIDTH"). Unrecognised columns are reported and skipped. Ratios that spreadsheets turned into times (`60:40:00`) are restored to `60:40`.

## Deploying to Vercel

1. **Create a MongoDB database.** Use the free tier at [MongoDB Atlas](https://www.mongodb.com/atlas), or *Vercel → Storage / Marketplace → MongoDB Atlas*, which sets `MONGODB_URI` for you.
   - In Atlas, open *Network Access* and allow `0.0.0.0/0`. Vercel has no fixed IP addresses.
   - Copy the connection string (`mongodb+srv://user:password@cluster…/`).
2. **Import the GitHub repo in Vercel** (*Add New → Project*). The build settings come from `vercel.json`.
3. **Set the environment variables** under *Settings → Environment Variables*:

   | Name | Value |
   |---|---|
   | `MONGODB_URI` | your Atlas connection string |
   | `SESSION_SECRET` | random string, at least 32 characters |
   | `APP_USERS` | output of `npm run hash-password` (separate users with `;`) |
   | `NODE_ENV` | `production` |
   | `TRUST_PROXY` | `true` |

4. **Deploy, or redeploy after changing variables.** Then sign in and import your CSV from Settings.
5. Vercel's *Deployment Protection* (Vercel Authentication) is on by default. Disable it under *Settings → Deployment Protection* so employees can reach the CRM's own sign-in page.

How it works: `vercel.json` builds the React app into `client/dist` and routes `/api/*` to the Express app (`api/index.js`). The same code also runs as a normal Node server (`npm start`) on any VPS or Node host.

## Security
- Every page and API call requires sign-in. Sessions use `HttpOnly`, `SameSite=Strict` cookies (`Secure` in production). Login is rate-limited.
- Passwords are stored only as bcrypt hashes. Database credentials stay in server environment variables.
- Input is validated on the server, and links must be `http(s)://`. API responses are `no-store`, and pages are `noindex`.
- Every listing records `createdBy`, `createdAt`, `updatedBy` and `updatedAt`.

## API

All endpoints except `/api/health` and `/api/auth/login` require a session cookie.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/login` · `/api/auth/logout` | Sign in / out |
| GET | `/api/auth/me` | Current user |
| GET | `/api/jv` | Listings. `q`, `filters` (JSON), `sort`, `dir`, `page`, `pageSize` (≤500) |
| GET | `/api/jv/:id` | One listing, with prev/next IDs |
| POST | `/api/jv` | Create (`{ values }`); admin, editor |
| PUT | `/api/jv/:id` | Update (`{ values, expectedUpdatedAt }`); admin, editor |
| DELETE | `/api/jv/:id` | Delete; admin |
| POST | `/api/jv/import` | CSV import (`{ csv, mode: 'skip'\|'update', dryRun }`); admin |
| GET | `/api/jv/metadata` | Fields, filter options, suggested next JV ID |
| GET | `/api/jv/stats` · `/api/jv/quality` · `/api/jv/contacts` | Dashboard, data quality, contacts |
| GET | `/api/jv/export` | CSV of the current filtered view |
| GET | `/api/system/status` | Storage status |

`filters` example: `{"feasibility_made_by":{"op":"in","values":["ravi"]},"_areaAcres":{"op":"range","min":4}}`. The operations are `in`, `contains`, `filled`, `blank` and `range`.

## Testing checklist
1. Sign in → add a listing → it appears on the Dashboard and in JV Listings.
2. Edit it in two browser tabs. Saving the second (older) tab is refused with a conflict message.
3. Try a duplicate JV ID, or a Google Pin that doesn't start with `http` → it is rejected.
4. Import a CSV: Preview shows the counts and column mapping. Re-importing the same file skips every row.
5. Sign in as a `viewer` → there are no New, Edit or Delete buttons, and `POST /api/jv` returns `403`.
