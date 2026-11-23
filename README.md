# Channel Studio

Partner marketing portal for a vendor's channel programme. Partners request **MDF (market development funds)**, run approved campaigns, upload proof of execution and claim the money back. The programme team reviews and approves each step.

```
Request funding → Funding approval → Run campaign → Performance & POE → Claim → Payment
```

## Folders

```
client/    React + Vite + TypeScript frontend (port 5173), own node_modules
backend/   Express + Prisma + SQLite API (port 4000), own node_modules
```

The root `package.json` has no dependencies. Its scripts only call into `backend/` and `client/`.

| Where | What to change |
|---|---|
| `client/src/config/brand.ts` | Brand name, login headline, demo-login box on/off |
| `client/src/styles/theme.css` | Colours, fonts, radius (design tokens) |
| `client/src/styles/app.css` | Layout and component styles |
| `client/src/pages/` | One file per screen |
| `backend/src/services/rules.ts` | Every business rule (50% cap, £15,000 limit, funnel checks, claim limit) |
| `backend/prisma/schema.prisma` | Database tables |
| `backend/prisma/seed.ts` | Sample partners, kits, users and funding |

## Run it

Requires Node 20+ (tested on Node 24).

```bash
cd backend && npm install && cd ..     # backend dependencies
cd client && npm install && cd ..      # client dependencies
#   or, from the root: npm run install:all

cp backend/.env.example backend/.env   # first time only; set JWT_SECRET
npm run db:migrate                     # creates backend/prisma/dev.db
npm run db:seed                        # loads sample data
npm run dev                            # API on :4000 + site on http://localhost:5173
```

Or run each one in its own terminal:

```bash
cd backend && npm run dev
cd client && npm run dev
```

Sample logins (passwords are stored hashed in the database):

| Role | Email | Password |
|---|---|---|
| Partner marketer | partner@demo.example | PartnerDemo26! |
| Programme reviewer | reviewer@demo.example | ReviewerDemo26! |

`npm run db:seed` resets the data at any time.

## Production build

```bash
npm run build     # type-checks both, builds client/dist and backend/dist
npm start         # backend serves the API and the built client on :4000
```

Set `NODE_ENV=production`, a long random `JWT_SECRET`, and `CLIENT_ORIGIN`. Turn off `showDemoLogins` in `brand.ts`.

## Moving to PostgreSQL

1. In `backend/prisma/schema.prisma` set `provider = "postgresql"`.
2. Set `DATABASE_URL` to the Postgres connection string.
3. Delete `backend/prisma/migrations`, then run `npm run db:migrate` and `npm run db:seed`.

## Security model

- Login is checked on the backend; passwords are bcrypt hashes; the session is an httpOnly cookie (8 hours).
- Every API route checks the user's role and that partners only reach their own organisation's data.
- A reviewer cannot decide something they submitted. Submitted items are locked.
- Uploads: 25 MB per file, 100 MB per campaign, stored in `backend/uploads/` (not in git).

## Pages

**Partner:**
- Overview
- Funding & claims
- My campaigns (5-step journey)
- Campaign library, with customise and live preview
- Enablement
- Reports
- Profile, Benefits and Rewards

**Reviewer:**
- Programme overview
- Review queue
- Funding & claims
- Reports
- Partner network
- Administration (benefit and points approvals)
