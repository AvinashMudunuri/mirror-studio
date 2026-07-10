import { notFound } from 'next/navigation';
import { EpisodePlayer } from '@/components/episode-player';
import { getPool } from '@/lib/db';
import { getPublishedPlayerEpisode } from '@/lib/episodes';

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

  return (
    <EpisodePlayer
      episode={published.player}
      title={published.title}
      synopsis={published.synopsis}
    />
  );
}
