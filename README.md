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
| `APP_PASSWORD` | Shared password in front of the whole app until user login lands. Required in production. |
| `CRON_SECRET` | Bearer token the hourly cron must send. |
| `DEFAULT_ACCOUNT_SLUG` | Which account the dashboard shows until login lands. |
| `META_GRAPH_VERSION` | Graph API version for the Meta connectors. |

Topics live per account in the `topics` table, and extra "own" author ids in `accounts.extra_own_author_ids`, so each business can describe itself without code changes.

## Security notes

- Every table carries `account_id`, and every dashboard query and action is scoped to the current account.
- Until real login lands, `APP_PASSWORD` (HTTP Basic auth) protects every page and the app refuses to run in production without it.
- Comment text is sent to Claude as data with an instruction never to follow it, and model output is validated against a schema before it is stored.
- Platform access tokens are stored in `connections.access_token`. Encrypt them at rest before storing real customer tokens (planned with the login work).

## Next

1. User login (Supabase Auth) with one or more businesses per user, replacing `APP_PASSWORD`.
2. Settings screen: connect pages with OAuth, edit topics and staff accounts, alert email.
3. Encrypted token storage and token refresh.
4. Email or Slack alert for each new high-risk comment, and a weekly summary email.
5. Meta App Review, then LinkedIn and TikTok connectors as access is approved.
6. Billing once pricing is settled.
