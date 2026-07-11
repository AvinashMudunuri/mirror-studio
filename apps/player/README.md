# MIRROR Player (`apps/player`)

Interactive episode player — scene pacing, anonymous progress, story outcomes.

## Run locally

```bash
# Same DATABASE_URL as apps/admin — player reads published_* and writes player_progress
export DATABASE_URL=postgres://...

npm run dev --workspace=@mirror/player
# → http://localhost:3400
```

Episodes must be published first via `apps/admin` (`/runs/...` → Publish).

## Features

- **Line-at-a-time play** — sticky Continue, progress dots, at most one narrator line per beat (art + dialogue/inner voice carry the rest)
- **Anonymous progress** — `mirror_player_id` httpOnly cookie → `players` + `player_progress` rows; resume on same device
- **Story outcome screen** — ending title + authored branch outcome text, optional collapsed reflection, next-episode tease
- Homepage — Netflix-style browse with Finished / In progress / soft locks

## Content contract

- Authoring shape (publish snapshots): `{ outline, cast, dialogue, choiceDialogue, branchDialogue }`
- Player shape: `projectPlayerEpisode()` in `@mirror/schemas`
- Progress payload: `PlayerProgressPayload` in `@mirror/schemas`

## API

- `GET /api/progress?world=&episodeNumber=` — load saved progress
- `POST /api/progress` — save progress `{ world, episodeNumber, progress }`

## Not yet built

Profiles/auth, trait UI, save/resume across devices, art for episodes 2–5, analytics.
