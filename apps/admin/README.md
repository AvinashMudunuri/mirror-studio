# MIRROR Studio Admin

Read-only dashboard over the pipeline's run folders (`output/episodes/`).
The filesystem stays the source of truth; this app just renders it.

```bash
npm run dev -w @mirror/admin    # http://localhost:3300
```

- **/** — all runs, newest first: final status, reviewer verdicts, duration,
  token usage, revision count.
- **/runs/[episode]/[run]** — run detail: stat cards, roster
  (active/inactive), revision history, the rendered bound script
  (`episode-script.md`), and the artifact list.
- **/runs/…/artifact/[file]** — pretty-printed JSON / raw artifact viewer.

Legacy runs without `finalStatus` show as `LEGACY`; crashed runs without a
manifest show as `INCOMPLETE`. Set `EPISODES_DIR` to point at a different
episodes root.

Planned next phases (docs/OPEN-QUESTIONS.md): trigger runs from the UI with
SSE console streaming, then editing/review workflows backed by Postgres.
