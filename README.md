# TenDo (TenderXpo)

Tender intelligence for Indian and EU public procurement: find notices, estimate BOQ costs, check bid feasibility, draft proposals, and track bids.

## Data sources

Every tender is labelled with where it came from.

| Source | How it is used |
| --- | --- |
| TED (EU Tenders Electronic Daily) | Live. Polled every 5 minutes through its public API. New notices are pushed to open browsers. |
| GeM, CPPP, SAM.gov | Link-only. They have no open API and require login or CAPTCHA, so they are not scraped. |
| Sample tenders | Illustrative demo data. Labelled "Sample" everywhere. Not real notices. |
| Commodity prices | Static base values. Not a live market feed. |

Always verify a notice on the official portal before bidding.

## Run locally

```bash
npm install
cp .env.example .env     # set GEMINI_API_KEY
npm run dev              # http://localhost:3000
```

See `SETUP.md` for Firebase sign-in and Firestore setup.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Express server with Vite middleware |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | TypeScript type check |
| `npm test` | Unit and API tests (Node test runner) |

## Deploy (Vercel)

`vercel.json` builds the SPA into `dist/` and runs the API from `api/index.ts`, which wraps `server.ts`. Set `GEMINI_API_KEY` in the project's environment variables.

## Known limits

- No Content-Security-Policy yet. Baseline headers are set (`nosniff`, `X-Frame-Options: DENY`, referrer and permissions policies).
- Alert delivery (email and Google Chat) is not implemented. The scraper trigger returns a "not configured" status and creates no alerts.
- The AI assistant and proposal generator depend on the Gemini API. When it is unavailable, the app says so and uses deterministic fallbacks.
