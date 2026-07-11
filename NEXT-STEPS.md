# Next Steps

**This file is superseded.** It described Phase 1 onboarding from early 2026 and is no longer accurate.

Use these instead:

| Doc | Purpose |
|-----|---------|
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Current phase status, Season 1 episode table, what's done vs not |
| [`docs/OPEN-QUESTIONS.md`](docs/OPEN-QUESTIONS.md) | Backlog, open decisions, evidence links |
| [`docs/runbooks/shared-postgres.md`](docs/runbooks/shared-postgres.md) | Neon setup for publish/player/continuity |
| [`.agents/skills/mirror-pipeline/SKILL.md`](.agents/skills/mirror-pipeline/SKILL.md) | Generate episodes, token budget, Bedrock |
| [`.agents/skills/mirror-postgres/SKILL.md`](.agents/skills/mirror-postgres/SKILL.md) | Persistence model, schema landmines |

## Quick commands (2026-07-11)

```bash
npm run build
npm run test
npm run dev -w @mirror/admin      # :3300
npm run dev -w @mirror/player     # :3400
EPISODE_NUMBER=N npm run real:episode   # full board; needs DATABASE_URL + Claude/Bedrock
```

**Season 1 (`NEW_SCHOOL`)**: 5 episodes, protagonist Wren Okafor-Silva. Publish approved runs in admin; player shows all published episodes from Postgres.
