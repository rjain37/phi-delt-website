# Phi Delta Theta — Pennsylvania Rho (CMU)

Official chapter website for **Phi Delta Theta at Carnegie Mellon University**. The public site covers rush, philanthropy, chapter info, and events. Signed-in brothers get a **Brotherhood Hub** with internal tools backed by Google Sheets and chapter data.

Built with [Next.js 15](https://nextjs.org/) (App Router), React 19, Tailwind CSS 4, and [NextAuth.js](https://next-auth.js.org/) for Google sign-in.

---

## Quick start

```bash
git clone <repo-url>
cd phi-delt-website
npm install
```

Create a `.env.local` file in the **project root** (same folder as `package.json`):

```env
GOOGLE_API_KEY=
CONFIG_SHEET_ID=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
```

Generate `NEXTAUTH_SECRET` with:

```bash
openssl rand -base64 32
```

Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

| Command        | Description              |
|----------------|--------------------------|
| `npm run build`| Production build         |
| `npm run start`| Serve production build   |
| `npm run lint` | ESLint                   |

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_API_KEY` | Google Sheets API (read-only) for public content and config |
| `CONFIG_SHEET_ID` | Main chapter config spreadsheet (see [Spreadsheets](#spreadsheets)) |
| `GOOGLE_CLIENT_ID` | OAuth client ID for brotherhood login |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `NEXTAUTH_SECRET` | Session encryption (required in production) |
| `NEXTAUTH_URL` | Canonical site URL (`http://localhost:3000` locally; your Vercel domain in prod) |

`.env.local` is gitignored. Never commit secrets.

For local Google OAuth, add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI in [Google Cloud Console](https://console.cloud.google.com/).

---

## Site map

### Public (no login)

| Route | Description |
|-------|-------------|
| `/` | Home, upcoming events |
| `/about` | Chapter info and exec board |
| `/rush` | Rush schedule and events |
| `/philanthropy` | LiveLikeLou fundraising progress |
| `/photos` | Photo galleries |
| `/donation` | Donation info |
| `/login` | Brotherhood sign-in |

Public data (rush, events, exec, philanthropy, family lines API) is loaded from the config spreadsheet via `GOOGLE_API_KEY`.

### Brotherhood (login required)

All routes under `/brotherhood` are protected by NextAuth middleware. Unauthenticated visitors are redirected to `/login`.

| Route | Description |
|-------|-------------|
| `/brotherhood` | **Brotherhood Hub** — links to internal tools |
| `/brotherhood/classes` | **Course Catalog** — searchable peer reviews from the chapter form |
| `/brotherhood/messenger-likes` | **Messenger Likes** — semester engagement stats and awards |
| `/brotherhood/bpl` | **Brotherhood Pong League** — standings, bracket, featured matches |
| `/brotherhood/bpl/schedule` | Weekly BPL schedule |
| `/brotherhood/bpl/teams` | Team rosters (`?team=` deep-links to a team) |
| `/brotherhood/family-lines` | Big/little family tree and search |

After sign-in, **Brotherhood Hub** appears in the navbar.

---

## Brotherhood login

### How it works

1. A brother clicks **Brother Login** in the nav (or visits `/login`).
2. They sign in with **Google** (NextAuth + Google OAuth).
3. On sign-in, `isAllowedEmail()` checks their email against the **Access** tab in the config spreadsheet.
4. If allowed, a session is created and they can use `/brotherhood/*`.
5. If denied, they see an access-denied message on `/login` (`AccessDenied`).

Relevant code:

- `src/lib/auth.js` — NextAuth options and `signIn` callback
- `src/helpers/auth/access.js` — allowlist from Sheets
- `src/middleware.ts` — protects `/brotherhood(.*)`
- `src/app/login/page.tsx` — custom sign-in UI and error copy

### Managing who can log in

Edit the **Access** sheet in the config spreadsheet (`CONFIG_SHEET_ID`):

| Column A | Column B (optional) |
|----------|---------------------|
| Andrew ID (e.g. `jdoe`) | Custom email (alumni, non-CMU, etc.) |

- Column A is treated as `{andrewId}@andrew.cmu.edu`.
- Column B is added as-is (use full addresses for alumni or personal Gmail).

Rows start at **row 2** (row 1 is headers). Changes take effect on the next sign-in attempt (no redeploy needed).

### Production OAuth

In Google Cloud Console, for the OAuth client used by this site:

1. **Authorized JavaScript origins**: `https://your-domain.com`
2. **Authorized redirect URIs**: `https://your-domain.com/api/auth/callback/google`
3. Set `NEXTAUTH_URL=https://your-domain.com` in your hosting env (e.g. Vercel).

---

## Spreadsheets

Most content is driven by a single **config spreadsheet** (`CONFIG_SHEET_ID`). The Google Sheets API key must have access to that file (share the sheet with the service account or use a key tied to a Google account that can view it).

| Tab | Used for |
|-----|----------|
| `Config` | Key–value settings (e.g. `BPL_SHEET_ID`) |
| `Access` | Brotherhood login allowlist |
| `Rush` | Rush events on `/rush` |
| `Upcoming Events` | Homepage event cards |
| `Exec` | Exec board on `/about` |
| `Philanthropy` | Fundraising totals on `/philanthropy` |
| `Fam Lines` | Family-line relationships |
| `Course Catalog` | Brotherhood course reviews (`/brotherhood/classes`) |

**BPL** uses a separate spreadsheet. Its ID is stored in the config tab as `BPL_SHEET_ID`. That workbook includes tabs like `Teams`, `Week 1`, `Week 2`, …, `Play-in`, and `Bracket` (see `src/helpers/bpl/`).

Config values are cached in memory for ~60 seconds (`src/helpers/config.js`).

---

## Brotherhood features (detail)

### Course Catalog (`/brotherhood/classes`)

- Reads the **Course Catalog** tab; row 1 = form question headers, each following row = one submission.
- Search filters across visible fields; semester filter when a semester column exists.
- Timestamp/email-style columns are hidden in the UI.
- Navbar uses a navy theme on this route for readability.

To update content: edit the Google Sheet (or point form responses at it). No code change required unless columns change meaningfully.

### Messenger Likes (`/brotherhood/messenger-likes`)

- Data comes from a **TSV file**, not Sheets:  
  `src/data/brotherhood/brotherhood_like_data_S26.tsv`
- Columns: semester, rank, author, likes, messages, likesPerMessage
- To refresh for a new semester: replace/update that TSV and redeploy.

### Brotherhood Pong League (`/brotherhood/bpl`)

- Standings, recent results, featured matches, bracket, schedule, and teams are computed from the BPL spreadsheet.
- Week tabs follow the naming pattern `Week 1`, `Week 2`, etc.
- Ensure `BPL_SHEET_ID` is set in the **Config** tab of the main spreadsheet.

### Family Lines (`/brotherhood/family-lines`)

- Tree and search use the **Fam Lines** tab in the config spreadsheet.
- Public API route `/api/family` also serves this data (used by the UI).

---

## Project structure (high level)

```
src/
├── app/                    # Pages and API routes (App Router)
│   ├── api/                # REST endpoints (Sheets-backed)
│   ├── brotherhood/        # Authenticated brother tools
│   └── login/              # Sign-in page
├── components/             # NavBar, loaders, SWR provider, etc.
├── helpers/                # Sheets data fetchers, BPL logic, auth
├── lib/                    # Google client, NextAuth config
├── middleware.ts           # Protects /brotherhood routes
└── data/brotherhood/       # Static TSV (messenger likes)
```

---

## Deployment

Typical flow: connect the repo to **Vercel** (or similar), set all env vars in the dashboard, and deploy.

Checklist:

- [ ] All env vars set (especially `NEXTAUTH_URL` and `NEXTAUTH_SECRET`)
- [ ] Google OAuth redirect URI matches production domain
- [ ] Config spreadsheet (and BPL spreadsheet) shared with the API key’s Google account
- [ ] `npm run build` passes locally before merging to `main`

---

## Contributing

- Keep `.env.local` out of git.
- When adding brothers, update the **Access** sheet rather than hardcoding emails.
- For new Sheet-driven pages, follow existing patterns in `src/helpers/` and `src/app/api/`.

Questions about access or data sources: contact the chapter’s memdev.
