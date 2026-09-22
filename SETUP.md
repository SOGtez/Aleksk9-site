# Backend setup

The site is static HTML plus a few serverless functions in `api/`. They need
five environment variables and an Upstash Redis database, all set in the
Vercel project that deploys this repo.

## 1. Twitch app

1. Go to https://dev.twitch.tv/console/apps and click **Register Your Application**.
2. Name: `AleksK9 Site`. Category: **Website Integration**. Client type: **Confidential**.
3. OAuth Redirect URLs, add one per domain the site is served from:
   - `https://<your-project>.vercel.app/api/auth/callback`
   - `https://aleksk9.com/api/auth/callback` (once the domain exists)
4. Save, then copy the **Client ID** and generate a **Client Secret**.

## 2. Vercel environment variables

Project → Settings → Environment Variables. Add for Production and Preview:

| Name | Value |
|---|---|
| `TWITCH_CLIENT_ID` | from step 1 |
| `TWITCH_CLIENT_SECRET` | from step 1 |
| `SESSION_SECRET` | any long random string, e.g. output of `openssl rand -hex 32` |
| `ADMIN_LOGINS` | Twitch usernames that are always admin, comma separated, e.g. `aleksk9_` |
| `TWITCH_CHANNEL` | channel for the homepage live badge, `aleksk9_` |
| `OPENROUTER_API_KEY` | from https://openrouter.ai/keys, for the tournament assistant on the admin page |
| `OPENROUTER_MODELS` | optional, comma separated model ids tried in order. Default `z-ai/glm-5.2:free` |
| `OPENROUTER_FALLBACK` | optional, `1` to also try every free model with tool support after the list above. Off by default |
| `AI_MONTHLY_CAP` | optional, admin messages to the assistant per month, shared by all admins. Default `200` |

## 3. Database

Project → **Storage** → **Create Database** → **Upstash Redis** (free tier) → connect to this project.
That adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.

## 4. Redeploy

Deployments → latest → **Redeploy**, so the new variables are picked up.

## 5. Check

- `https://<site>/api/tournament` returns JSON.
- `https://<site>/api/auth/login` sends you to Twitch and back to `/tournament?login=ok`.
- `https://<site>/api/me` shows your Twitch login and role `admin` if you are in `ADMIN_LOGINS`.

## Endpoints

| Route | Who | What |
|---|---|---|
| `GET /api/tournament` | anyone | full state + whose pick is next |
| `GET /api/me` | anyone | current user and role |
| `GET /api/auth/login` `/callback` `/logout` | anyone | Twitch login flow |
| `POST /api/draft` `{player}` | captain on the clock, admin | make a pick; admin can `{action:'undo'|'reset'}` |
| `POST /api/matches` `{index, score, status}` | helper, admin | update a map |
| `POST /api/stats` `{player, kills, deaths, assists}` or `{bulk}` | helper, admin | update player stats |
| `GET/POST /api/admin/roles` `{login, role}` | admin | manage who is captain / helper / admin |
| `POST /api/admin/reset` | admin | clear picks, matches, stats (config lives in `api/_lib/defaults.js`) |
| `GET /api/live` | anyone | is the Twitch channel live (cached 60s) |
| `GET/POST /api/apply` | logged in + following | read/submit your tournament application |
| `GET/POST /api/admin/applications` | admin | list, review, settings, build tournament from accepted, revert |
| `GET/POST /api/admin/chat` | admin | tournament assistant: `GET` usage, `POST {history, message}` one turn, `POST {history, action:'confirm'|'cancel', pending}` answer a build |

Pages: `/` home · `/tournament` draft, matches, stats · `/tournament-test` the same page on the test tournament · `/apply` application form (Twitch login with follow check) · `/admin` control panel · `/overlay` (add `?space=test` for the test tournament).

## Test tournament (sandbox)

There are two tournaments in the database: **live** (what everyone sees on `/tournament`) and **test** (a sandbox shown on `/tournament-test`, marked with a yellow banner and not indexed). Any tournament API call with `?space=test` reads and writes the sandbox instead: state (teams, pool, picks, matches, stats, draft, event), the roster built from applications, applications and application settings. Roles, Twitch logins, player links and caches are shared, so captains and admins are the same people in both. Redis keys for the sandbox are the live ones prefixed with `test:`.

On `/admin` the Live / Test switch at the top puts the whole panel, including the assistant, on one or the other. Test mode shows a yellow bar so nobody edits the sandbox thinking it is live, or the other way round. The assistant switches on its own when an admin says test, preview, rehearse or dry run, and it can copy the live tournament into the sandbox, wipe the sandbox, or, after a confirm, promote the sandbox over the live tournament.

## Tournament assistant

The Tournament tab on `/admin` has an AI chat through OpenRouter, using the free GLM 5.2 by default. It can review and tier applicants, tick captains, change application settings, build the tournament from accepted applicants, set the round-1 draft order, the event date and the pick clock. Every change runs through `api/_lib/actions.js`, the same code the buttons use. Building always shows a confirm card first. It cannot reset, revert, undo picks or delete applications.

Models that support OpenAI-style tool calls are used natively. The free GLM 5.2 does not, so for it (and any model OpenRouter rejects with a "tool use" error) the tools are described in the prompt and the model writes each call as a fenced ` ```tool ` JSON block that the server parses. The chat shows "(text tools)" after the model name when that path is in use. OpenRouter free models are also rate limited per account (20 requests a minute, and 50 a day unless the account has bought at least $10 of credits, then 1000 a day); one admin message can take two to six requests.

Usage is one shared counter for all admins, `AI_MONTHLY_CAP` messages per calendar month (Redis key `ai:usage:YYYY-MM`). Confirm and cancel clicks are free. When the cap is hit the chat says so and the box is disabled until the 1st. To reset it early, delete that key in the Upstash console.
The Twitch app must allow the `user:read:follows` scope (all apps do by default); applicants grant it on login.
