# Runbook: Shared cloud Postgres (Neon + Cursor + Codespaces)

**ADR:** `docs/decisions/006-shared-cloud-postgres.md`

One Postgres database used by Codespaces, Cursor Cloud Agents (for
continuity reads only — not provisioned locally), admin publish, and the
player app.

---

## When you need this

| Symptom | Fix |
|---------|-----|
| Episodes published in Codespaces don't show in Cloud Agent player tests | Same `DATABASE_URL` everywhere |
| Cloud Agent "published" an episode but Codespaces `/play/...` 404s | Agent used ephemeral local DB — use shared URL + `persist:run` |
| `loadPreviousEpisodes()` says `filesystem` but you want DB continuity | Set `DATABASE_URL` before `npm run real:episode` |

**You do not need shared Postgres** if you only generate episodes and read
artifacts from `output/` — but you **do** need it for publish + player.

---

## 1. Create the database (Neon example)

1. Create a project at [https://neon.tech](https://neon.tech) (free tier is fine for dev).
2. Create database `mirror_studio`.
3. Copy the **pooled** connection string (PgBouncer), e.g.  
   `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/mirror_studio?sslmode=require`

Neon, Supabase, and RDS all work — any Postgres 15+ with `pgvector` support.

---

## 2. Apply schema

From a machine with `psql` and network access to the instance:

```bash
export DATABASE_URL='postgresql://...'   # your cloud URL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infrastructure/db/init/01-schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infrastructure/db/migrations/2026-07-06-agent-memory-fixes.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f infrastructure/db/migrations/2026-07-08-add-published-columns.sql
```

Verify:

```bash
psql "$DATABASE_URL" -c "\dt"
# expect: episodes, seasons, worlds, agent_memory, ...
```

**Landmine:** Do not add an IVFFlat/HNSW index on `vector(3072)` — see
`.agents/skills/mirror-postgres/SKILL.md`.

---

## 3. Wire secrets

### Cursor Cloud Agent

In **Cursor → Cloud → Environment secrets** for this repo, add:

```
DATABASE_URL=postgresql://...@.../mirror_studio?sslmode=require
```

Cloud Agents should **not** run `docker compose` or `apt install postgresql`
for publish. Generate episodes, commit approved run folders, then persist
from Codespaces (or any env with this secret).

### GitHub Codespaces

**Option A — shared cloud (recommended)**

Add the same `DATABASE_URL` to Codespaces secrets or `.env` (not committed):

```bash
export DATABASE_URL='postgresql://...@.../mirror_studio?sslmode=require'
```

Skip `docker compose up postgres` for publish/player, or keep Docker for
Redis only:

```bash
docker compose up -d redis   # optional; pipeline doesn't need it at runtime
```

**Option B — local Docker only (solo dev)**

Keep `docker compose up -d` and local URL:

```bash
export DATABASE_URL=postgresql://mirror:mirror_dev_password@localhost:5432/mirror_studio
```

Use this only when **one** environment owns publish — not Cloud Agent +
Codespaces together.

---

## 4. Backfill published episodes

After pulling approved run folders from git:

```bash
npm install
npm run build --workspace=@mirror/schemas

export DATABASE_URL='postgresql://...'   # shared cloud URL

# Persist each approved run (zero LLM tokens)
npm run persist:run -- output/episodes/episode-01-first-day/run-2026-07-10_13-26-56
npm run persist:run -- output/episodes/episode-02-the-group-project/run-2026-07-10_15-32-04
npm run persist:run -- output/episodes/episode-03-the-invite/run-2026-07-10_20-56-29

# Check rows
psql "$DATABASE_URL" -c "
  SELECT e.episode_number, e.title, e.status, e.published_at IS NOT NULL AS published
  FROM episodes e
  JOIN seasons s ON s.id = e.season_id
  WHERE s.world_id = 'NEW_SCHOOL'
  ORDER BY 1;"
```

### Publish

**Admin UI** (port 3300): open each run → **Publish**.

**API:**

```bash
# episodeId comes from persist:run output or:
psql "$DATABASE_URL" -c "
  SELECT e.id, e.episode_number FROM episodes e
  JOIN seasons s ON s.id = e.season_id
  WHERE s.world_id = 'NEW_SCHOOL' ORDER BY e.episode_number;"

curl -X POST http://localhost:3300/api/publish \
  -H 'Content-Type: application/json' \
  -d '{
    "episodeId": "<uuid>",
    "episodeFolder": "episode-03-the-invite",
    "runFolder": "run-2026-07-10_20-56-29",
    "worldId": "NEW_SCHOOL",
    "episodeNumber": "3"
  }'
```

---

## 5. Verify player

```bash
export DATABASE_URL='postgresql://...'
npm run dev --workspace=@mirror/player   # http://localhost:3400
```

- Home lists worlds when DB is configured.
- `/play/NEW_SCHOOL/1` (and `/2`, `/3` after publish) should load.

API equivalent:

```bash
curl 'http://localhost:3300/api/published/NEW_SCHOOL/3?format=player' | head
```

---

## 6. Standard workflows

### Cloud Agent generates episode N

1. `EPISODE_NUMBER=N npm run real:episode` (Bedrock or Anthropic secrets set).
2. Commit `output/episodes/.../run-<timestamp>/` to git (PR).
3. **Do not** rely on agent-local Postgres for publish.

### After PR merge (Codespaces or laptop)

```bash
git pull
export DATABASE_URL='postgresql://...'
npm run persist:run -- output/episodes/.../run-<timestamp>
# Publish via admin or curl above
```

### Generate episode N+1 with continuity

With shared `DATABASE_URL` set **before** the run, `loadPreviousEpisodes()`
uses Postgres. Without it, filesystem fallback still works if approved
runs are in `output/episodes/`.

---

## 7. Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `DATABASE_URL not set` on `persist:run` | Env missing | Export URL or add Codespaces secret |
| Publish 503 in admin | Admin has no `DATABASE_URL` | Same URL as pipeline |
| Player home says DB not configured | Player missing `DATABASE_URL` | Same URL as admin |
| `relation "episodes" does not exist` | Schema not applied | Run init + migrations (step 2) |
| Episodes persisted but player 404 | Not published | `published_at` must be set — click Publish |
| SSL required | Neon/Supabase | Add `?sslmode=require` to URL |

---

## 8. Security

- Never commit `DATABASE_URL` or put it in `.env` tracked by git.
- Use provider **pooled** connection strings for serverless/Next.js if offered.
- Rotate credentials if a Cloud Agent log ever leaked the URL.
- Keep `TEST_DATABASE_URL` separate for CI integration tests — do not run
  destructive tests against the shared content database.
