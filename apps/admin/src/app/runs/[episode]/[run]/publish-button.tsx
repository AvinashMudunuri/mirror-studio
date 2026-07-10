'use client';

import { useState } from 'react';

interface PublishResult {
  ok: boolean;
  message: string;
}

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
  const [result, setResult] = useState<PublishResult | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handlePublish() {
    setIsPending(true);
    setResult(null);
    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId, episodeFolder, runFolder, worldId, episodeNumber })
      });
      const data = (await response.json()) as PublishResult;
      setResult(data);
      if (data.ok) {
        // Refresh server-rendered publish state (published_at banner, label).
        window.location.reload();
      }
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : 'Publish request failed.'
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <button type="button" className="btn btn-primary" disabled={isPending} onClick={handlePublish}>
        {isPending ? 'Publishing…' : label}
      </button>
      {result?.message && (
        <span className={result.ok ? 'publish-ok' : 'publish-error'}>{result.message}</span>
      )}
    </div>
  );
}
