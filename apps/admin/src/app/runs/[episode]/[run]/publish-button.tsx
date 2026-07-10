'use client';

import { useActionState } from 'react';
import { publishEpisodeAction, type PublishActionResult } from './actions';

const initialState: PublishActionResult = { ok: false, message: '' };

export function PublishButton({
  episodeId,
  episodeFolder,
  runFolder,
  episodeNumber,
  worldId,
  label
}: {
  episodeId: string;
  episodeFolder: string;
  runFolder: string;
  episodeNumber: number;
  worldId: string;
  label: string;
}) {
  const [state, formAction, isPending] = useActionState(publishEpisodeAction, initialState);

  return (
    <form action={formAction} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <input type="hidden" name="episodeId" value={episodeId} />
      <input type="hidden" name="episodeFolder" value={episodeFolder} />
      <input type="hidden" name="runFolder" value={runFolder} />
      <input type="hidden" name="episodeNumber" value={episodeNumber} />
      <input type="hidden" name="worldId" value={worldId} />
      <button type="submit" className="btn btn-primary" disabled={isPending}>
        {isPending ? 'Publishing…' : label}
      </button>
      {state.message && (
        <span className={state.ok ? 'publish-ok' : 'publish-error'}>{state.message}</span>
      )}
    </form>
  );
}
