'use client';

import { useActionState } from 'react';
import { publishEpisodeAction, type PublishActionResult } from './actions';

const initialState: PublishActionResult = { ok: false, message: '' };

export function PublishButton({
  episodeId,
  episodeFolder,
  runFolder,
  label
}: {
  episodeId: string;
  episodeFolder: string;
  runFolder: string;
  label: string;
}) {
  const [state, formAction, isPending] = useActionState(
    async () => publishEpisodeAction(episodeId, episodeFolder, runFolder),
    initialState
  );

  return (
    <form action={formAction} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <button type="submit" className="btn btn-primary" disabled={isPending}>
        {isPending ? 'Publishing…' : label}
      </button>
      {state.message && (
        <span className={state.ok ? 'publish-ok' : 'publish-error'}>{state.message}</span>
      )}
    </form>
  );
}
