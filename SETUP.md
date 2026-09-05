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
