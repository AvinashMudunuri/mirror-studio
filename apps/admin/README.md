# MIRROR Studio Admin

Dashboard over the pipeline's run folders (`output/episodes/`) — mostly
read-only; the filesystem/Postgres stays the source of truth for finished
runs. Publishing and generation are the two write actions this app
supports.

```bash
npm run dev -w @mirror/admin    # http://localhost:3300
```

- **/** — all runs, newest first: final status, reviewer verdicts, duration,
  token usage, revision count.
- **/generate** — spawn a real pipeline run from the browser: episode
  number + optional custom brief (title/themes/traits/synopsis), budget/
  revision-iteration/skip-reviewer controls, an advanced section for
  per-reviewer model overrides. Streams the spawned process's console
  live via SSE; only one generation runs at a time (a deliberate cost
  guardrail). **Costs real tokens and can take 10-60+ minutes** — this is
  a real pipeline run, not a mock.
- **/runs/[episode]/[run]** — run detail: stat cards, roster
  (active/inactive), revision history, the rendered bound script
  (`episode-script.md`), the artifact list, and the publish button.
- **/runs/…/artifact/[file]** — pretty-printed JSON / raw artifact viewer.
- **/published/[world]/[episodeNumber]** — preview of the durable
  published snapshot (see `docs/decisions/003-publish-scope-proposal.md`).

Legacy runs without `finalStatus` show as `LEGACY`; crashed runs without a
manifest show as `INCOMPLETE`. Set `EPISODES_DIR` to point at a different
episodes root.

Planned next phase (docs/OPEN-QUESTIONS.md item 1): rich editing/review
workflows (re-run specific agents, versioning) backed by Postgres.

**Dev note:** don't run `npm run build` (production) while `next dev` is
running against the same `apps/admin/.next` directory — they'll clobber
each other's build cache. Stop the dev server first, or use a separate
checkout for production build verification.
