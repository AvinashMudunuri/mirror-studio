# MIRROR Player (`apps/player`)

Minimal Phase 5 preview: an interactive episode player that consumes the **player content projection** from published Postgres snapshots.

## Run locally

```bash
# Same DATABASE_URL as apps/admin — player reads published_* columns only
export DATABASE_URL=postgres://...

npm run dev --workspace=@mirror/player
# → http://localhost:3400
```

Episodes must be published first via `apps/admin` (`/runs/...` → Publish).

## Content contract

- Authoring shape (what publish snapshots): `{ outline, cast, dialogue, choiceDialogue, branchDialogue }`
- Player shape: `projectPlayerEpisode()` in `@mirror/schemas` → scene graph with choices, response dialogue, and branch variants
- Admin API: `GET /api/published/[world]/[episodeNumber]?format=player` returns the same projection

## Scope (deliberately minimal)

- Linear scene flow + choice branching + branch-specific ending dialogue
- No profiles, trait tracking UI, reflection prompts, or illustration/voice
- Debug strip shows current scene id for QA — remove before a public launch
