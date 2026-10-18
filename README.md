# FocusStack

A writing studio for **blog ideas**, **mind maps**, **personal essays**, and **personal finances** — with templates, a writing playlist, light/dark appearance, and a small Colab-style code lab.

## Features

| Surface | What it is |
| --- | --- |
| **Studio** | Home for pages, maps, money, and snippets |
| **Write** | Blog ideas, essays, and money stories |
| **Mind maps** | Drag-and-drop idea maps |
| **Finances** | Ledger + written monthly stories |
| **Templates** | Structured starts (story arcs, braided essays, life maps, budgets) |
| **Playlist** | Six original generated rooms (lo-fi, rain, café, forest, piano, train) plus your own YouTube / Spotify / SoundCloud links |
| **Code lab** | Run Python, JavaScript, or Java cells |

Appearance: **Light** and **Dark** in the sidebar.

## Accounts and sign-in

Everyone gets a private workspace: pages, maps, finances and snippets belong to the account that created them. Sign up with **email + password**, or **continue with Google or GitHub**. The playlist rooms work without an account.

- The **first account created adopts all data that existed before accounts were added**, so sign up yourself first.
- Passwords are hashed with scrypt; sessions are random tokens (stored hashed) in an HttpOnly cookie.
- Set `SIGNUP_ALLOWLIST=you@example.com` to restrict who can create an account (recommended while the code lab is enabled).
- Email addresses are not verified for password signups. Google and GitHub sign-ins use the provider-verified email.

### Setting up Google and GitHub sign-in

Set `APP_URL` to the public address (`https://www.focusstack.tech` in production, `http://localhost:5173` locally), then create the two OAuth apps. A provider button stays disabled until its ID and secret are set.

**Google**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → *Create credentials* → *OAuth client ID* → *Web application*. Authorized redirect URI: `APP_URL/api/auth/google/callback`. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. On the OAuth consent screen, publish the app (move from *Testing* to *In production*), or only listed test users can sign in.

**GitHub**: [Developer settings](https://github.com/settings/developers) → *New OAuth App*. Homepage URL `APP_URL`, callback URL `APP_URL/api/auth/github/callback`. Generate a client secret, then set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

On DigitalOcean, add these as environment variables on the backend component (encrypt the secrets). Locally, put them in `backend/.env`.

## Database: PostgreSQL

FocusStack stores documents, finance rows, and snippets in **PostgreSQL**.

### Local Postgres with Docker

```bash
docker compose up -d db
```

Then in `backend/.env`:

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=focusstack
POSTGRES_USER=focusstack
POSTGRES_PASSWORD=focusstack
```

Or a single URL:

```
DATABASE_URL=postgresql+psycopg://focusstack:focusstack@localhost:5432/focusstack
```

Tables `documents`, `finance_entries`, and `snippets` are created on first API start.

If Postgres is not configured, the API falls back to local SQLite (`backend/focusstack.db`) so you can still run the app.

Production: point `DATABASE_URL` at a managed Postgres instance (Cloud SQL, Neon, RDS, Supabase, Railway, etc.). Do not use SQLite in production.

## Quick start

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API: http://127.0.0.1:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

### Code lab

- **Python** uses the same interpreter as the API.
- **JavaScript** needs Node.js on PATH.
- **Java** needs a JDK (`javac` and `java`). Cells time out after 8 seconds.
- Snippets run with a minimal environment (no server secrets), as the unprivileged `nobody` user when the API runs as root (the Docker image), with CPU, file-size and process limits. This is defence in depth, not a full sandbox: network access isn't blocked. If the site is public, restrict signups or move execution to an isolated service.

## License

MIT
