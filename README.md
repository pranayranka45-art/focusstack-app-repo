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
| **Playlist** | Generated writing rooms (lo-fi, rain, café, forest, piano, train) |
| **Code lab** | Run Python, JavaScript, or Java cells |

Appearance: **Light** and **Dark** in the sidebar.

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

## License

MIT
