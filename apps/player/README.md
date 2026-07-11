# MIRROR Player (`apps/player`)

Interactive episode player — Tier 0 UX with anonymous progress and outcome screen.

## Run locally

```bash
# Same DATABASE_URL as apps/admin — player reads published_* and writes player_progress
export DATABASE_URL=postgres://...

npm run dev --workspace=@mirror/player
# → http://localhost:3400
```

Episodes must be published first via `apps/admin` (`/runs/...` → Publish).

## Features

- **Tier 0 presentation** — one scene at a time, location header, mood backgrounds, choice cards (not a scrolling script)
- **Anonymous progress** — `mirror_player_id` httpOnly cookie → `players` + `player_progress` rows; resume on same device
- **Outcome screen** — ending title, themes practiced, optional reflection (saved to progress JSONB)
- Homepage shows **Finished** / **In progress** badges per episode

## Content contract

- Authoring shape (publish snapshots): `{ outline, cast, dialogue, choiceDialogue, branchDialogue }`
- Player shape: `projectPlayerEpisode()` in `@mirror/schemas`
- Progress payload: `PlayerProgressPayload` in `@mirror/schemas`

## API

- `GET /api/progress?world=&episodeNumber=` — load saved progress
- `POST /api/progress` — save progress `{ world, episodeNumber, progress }`

## Not yet built

Profiles/auth, trait UI, illustrations, save/resume across devices, analytics.
