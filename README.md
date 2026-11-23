# Channel Studio

Partner marketing portal for a vendor's channel programme. Partners request **MDF (market development funds)**, run approved campaigns, upload proof of execution and claim the money back. Reviewers approve each step; platform admins manage users and settings.

```
Request funding → Funding approval → Run campaign → Performance & POE → Claim → Payment
```

## Stack

| Folder | What | Port |
|---|---|---|
| `client/` | **Next.js 16** (App Router) multi-page app: every page is rendered on the server, links load a new page, forms post to Server Actions | 3000 |
| `backend/` | **Node.js + TypeScript** API on the built-in `http` module (no Express), plain SQL with the **`pg`** driver | 4000 |
| database | **PostgreSQL**: Neon or Supabase (connection string in `backend/.env`) | |

The browser only talks to Next.js. Next.js calls the backend API from its server with the user's session token (an httpOnly cookie), so tokens never reach browser JavaScript.

## Where to change things

| Where | What |
|---|---|
| `client/src/lib/brand.ts` | Brand name, login headline, demo-login box on/off |
| `client/src/styles/theme.css` | Colours, fonts, sizes (design tokens) |
| `client/src/styles/app.css` | Layout and component styles |
| `client/src/app/(portal)/` | One folder per page (e.g. `funding/[id]/page.tsx`) |
| `client/src/lib/actions.ts` | Every form submission (Server Actions) |
| `backend/src/routes/` | API endpoints |
| `backend/src/services/rules.ts` | Business rules (contribution %, limits, funnel checks, claim limit) |
| `backend/src/db/migrations/*.sql` | Database tables (plain SQL) |
| `backend/src/db/seed.ts` | Sample partners, kits, users and funding |

## Setup

Requires Node 20+ (tested on Node 24) and a PostgreSQL database.

1. **Install** (each folder has its own `node_modules`):
   ```bash
   npm run install:all
   ```
2. **Database:** create a database on Neon or Supabase and copy its connection string.
   ```bash
   cp backend/.env.example backend/.env     # then set DATABASE_URL and JWT_SECRET
   cp client/.env.example client/.env.local # API_URL, default http://localhost:4000/api
   ```
   - Neon: Dashboard → Connect → copy the `postgresql://…?sslmode=require` string.
   - Supabase: Project settings → Database → Connection string (URI). Add `?sslmode=require` if it is not there.
3. **Create tables and sample data:**
   ```bash
   npm run db:migrate
   npm run db:seed        # optional: resets all data to the samples
   ```
4. **Run:**
   ```bash
   npm run dev            # backend on :4000 + Next.js on http://localhost:3000
   ```

Sample logins (stored as bcrypt hashes):

| Role | Email | Password |
|---|---|---|
| Partner marketer | partner@demo.example | PartnerDemo26! |
| Programme reviewer | reviewer@demo.example | ReviewerDemo26! |
| Platform admin | admin@lenovo.com | lenovo@2026 |

`npm run admin:create` creates or resets only the admin account, keeping all other data.

## Production

```bash
npm run build                 # backend → backend/dist, client → client/.next
npm start                     # backend API on :4000
npm run start:client          # Next.js on :3000
```

Set `NODE_ENV=production`, a long random `JWT_SECRET`, `CLIENT_ORIGIN`, and `API_URL` for the client. Turn off `showDemoLogins` in `client/src/lib/brand.ts`.

## Security model

- Passwords are bcrypt hashes; sessions are signed JWTs in an httpOnly cookie on the Next.js domain (8 hours).
- Every API route checks the role, and that partners only reach their own organisation's data. Pages check roles too.
- Reviewers cannot decide what they submitted; submitted items are locked; deactivated users are signed out.
- Uploads: 25 MB per file, 100 MB per campaign, stored in `backend/uploads/` (not in git). Downloads go through `/download/...`, which checks the session.
- Sign-in is rate limited (20 attempts per 15 minutes per IP).

## Pages

**Partner:** Overview · Funding & claims · My campaigns (5-step journey, each step its own page) · Campaign library (kit, customise with live preview) · Enablement · Reports · Our profile · Benefits · Rewards

**Reviewer:** Programme overview · Review queue · Funding & claims · Campaign library · Reports · Partner network · Administration

**Platform admin:** Overview · Users (accounts and partner organisations; separate pages to add, edit, reset password, delete) · Settings

Every signed-in page has the notification bell (top right) and sign-out at the bottom of the sidebar.
