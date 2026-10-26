# Social Sentiment

A web app that watches a business's social pages, drops the business's own comments, and uses Claude to score every public comment for sentiment, topic and risk. Each business gets a dashboard with three views:

- **Overview**: Net Sentiment (positive minus negative, -100 to +100) with change from the previous period, weekly trend by platform, sentiment mix, open high-risk count and reply rate.
- **Topics**: Net Sentiment per topic, with the comments behind each topic one click away.
- **Risk**: high and medium risk comments with the reason and category, and a "Mark handled" button.

## Run it locally

```bash
npm install
cp .env.example .env        # add ANTHROPIC_API_KEY to score real comments
npm run seed:demo           # sample AAA WCNY account with invented comments and sample scores
npm run dev                 # http://localhost:3000
```

With no `DATABASE_URL`, data lives in an embedded Postgres (PGlite) under `.data/`. Delete that folder to start fresh.

Without the Supabase variables, local development skips login and runs as a single dev user who owns the demo account. Production refuses to serve until Supabase is configured.

`npm run seed:demo -- --score-with-claude` scores the sample comments with Claude instead of the hand-written sample scores.

## How it works

1. `npm run sync` (or the hourly `GET /api/cron/sync`) asks each connection's connector for comments since its last sync.
2. Each comment is checked against the page's own id, handle and any staff or agency ids on the account (`src/lib/filter.ts`). The business's own comments are stored with `is_owned = true`, excluded from sentiment, and used for the reply rate.
3. Unscored public comments go to Claude in batches of 25 with the account's own topic list (`src/lib/analysis`). Results are stored per prompt version, so changing the prompt never mixes old and new scores.
4. The dashboard reads from Postgres and filters by date range and platform.

| Platform | Status |
| --- | --- |
| Facebook Pages | Connector written (`src/connectors/meta.ts`), needs a Meta app and Page token |
| Instagram professional accounts | Connector written, same Meta app |
| LinkedIn Company Pages | Waiting on Community Management API approval |
| TikTok business accounts | Waiting on TikTok API for Business approval |

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (Supabase or any Postgres). Empty = local PGlite. |
| `ANTHROPIC_API_KEY` | Claude API key for scoring. Without it, sync stores comments but does not score them. |
| `ANALYSIS_MODEL` | Model used for scoring, default `claude-opus-5-5`. `claude-haiku-5-5` costs much less. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project used for login. Required in production. |
| `TOKEN_ENCRYPTION_KEY` | 32 random bytes, base64. Encrypts platform access tokens at rest. |
| `CRON_SECRET` | Bearer token the hourly cron must send. |
| `META_GRAPH_VERSION` | Graph API version for the Meta connectors. |

Owners edit each business's topics, the staff or agency accounts that speak for it, and its team on the Settings tab, so every business can describe itself without code changes.

## Login and teams

- Sign in with email and password or Google, through Supabase Auth. Password reset links and email confirmation go through Supabase too. Only confirmed email addresses get access.
- A user can belong to several businesses and switch between them. Anyone signed in can create a new business and becomes its owner.
- Owners invite teammates by email as owner or member. The invite turns into access the first time that person signs in with that email. The app does not send the invite email yet, so tell them to sign up.
- Members see the dashboards and can mark risk items handled. Owners also edit settings and the team. A business can never lose its last owner.

### Supabase setup

1. Create a project at supabase.com.
2. In Project Settings → API, copy the Project URL and the anon public key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. In Project Settings → Database, copy the connection string (the pooler, port 6543) into `DATABASE_URL`. This one includes the database password, so keep it in the host's environment settings only.
4. In Authentication → URL Configuration, set the Site URL to the app's address and add `<app address>/auth/callback` to the redirect URLs.
5. For Google sign-in, turn on the Google provider under Authentication → Providers and follow its steps.
6. Migrations run automatically on each Vercel deploy (see below). To load the AAA demo data into this database and make yourself its owner, run `npm run seed:demo -- --owner you@example.com` with `DATABASE_URL` set.

## Deploy to Vercel

1. At vercel.com, choose **Add New → Project**, import this GitHub repo, and keep the Next.js defaults.
2. Before the first deploy, add these under **Environment Variables**:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable (or anon) key |
| `DATABASE_URL` | Supabase → Connect → Transaction pooler string, with your database password filled in |
| `TOKEN_ENCRYPTION_KEY` | Any random string of 32+ characters (a password generator works) |
| `CRON_SECRET` | Another random string of 32+ characters |
| `ANTHROPIC_API_KEY` | Claude API key, from console.anthropic.com |

3. Deploy. The build applies database migrations, and Vercel Cron calls `/api/cron/sync` every hour (on the Hobby plan, Vercel limits crons to once a day).
4. In Supabase → Authentication → URL Configuration, set the Site URL to the Vercel address and add `https://<your-app>.vercel.app/auth/callback` to the redirect URLs.
5. Open the app, create an account, confirm your email, and add your business.

## Security notes

- Every table carries `account_id`. Every page and action loads the signed-in user's membership first and scopes each query and update to that account; a business id in a cookie or form is only honoured when the user belongs to it.
- Middleware refreshes the Supabase session and sends signed-out visitors to `/login`; only the login page, auth links and the cron route (which checks `CRON_SECRET`) are public.
- Row level security is on for every table with no policies, so the Supabase REST API cannot read or write app data with the public anon key. The app reaches the database through its own server-side connection.
- Login redirects only go to paths on this site.
- Comment text is sent to Claude as data with an instruction never to follow it, and model output is validated against a schema before it is stored.
- Platform access tokens are stored encrypted with AES-256-GCM (`src/lib/crypto.ts`) and decrypted only inside the connectors.

## Next

1. Connect Facebook and Instagram with one click (Meta login), storing encrypted tokens and refreshing them.
2. Email or Slack alert for each new high-risk comment, a weekly summary email, and invite emails.
3. Meta App Review, then LinkedIn and TikTok connectors as access is approved.
4. Billing once pricing is settled.
