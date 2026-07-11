import { notFound } from 'next/navigation';
import { EpisodePlayer } from '@/components/episode-player';
import { getPool } from '@/lib/db';
import { getPublishedPlayerEpisode } from '@/lib/episodes';
import { getEpisodeDbId, loadEpisodeProgress } from '@/lib/player-progress';
import { ensurePlayer, getPlayerIdFromCookie } from '@/lib/player-session';

export const dynamic = 'force-dynamic';

export default async function PlayEpisodePage({
  params
}: {
  params: Promise<{ world: string; episodeNumber: string }>;
}) {
  const { world, episodeNumber } = await params;
  const num = parseInt(episodeNumber, 10);
  const pool = getPool();
  if (!pool || !Number.isFinite(num)) notFound();

  const published = await getPublishedPlayerEpisode(pool, world, num);
  if (!published) notFound();

  let initialProgress = null;
  const playerId = await getPlayerIdFromCookie();
  if (playerId) {
    await ensurePlayer(pool, playerId);
    const episodeId = await getEpisodeDbId(pool, world, num);
    if (episodeId) {
      const row = await loadEpisodeProgress(pool, playerId, episodeId);
      initialProgress = row?.payload ?? null;
    }
  }

  return (
    <EpisodePlayer
      episode={published.player}
      title={published.title}
      synopsis={published.synopsis}
      worldId={world}
      episodeNumber={num}
      initialProgress={initialProgress}
    />
  );
}
