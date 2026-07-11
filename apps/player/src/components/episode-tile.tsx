import Link from 'next/link';
import type { EpisodeAccess } from '@/lib/season-config';

export interface EpisodeTileData {
  worldId: string;
  episodeNumber: number;
  title: string;
  synopsis: string;
  posterUrl: string | null;
  access: EpisodeAccess;
  status: 'not_started' | 'in_progress' | 'completed';
}

function statusLabel(access: EpisodeAccess, status: string): string | null {
  if (access === 'locked') return 'Locked';
  if (access === 'completed' || status === 'completed') return 'Finished';
  if (access === 'up_next') return 'Up next';
  if (status === 'in_progress') return 'Continue';
  return null;
}

interface EpisodeTileProps {
  episode: EpisodeTileData;
}

export function EpisodeTile({ episode }: EpisodeTileProps) {
  const locked = episode.access === 'locked';
  const label = statusLabel(episode.access, episode.status);
  const href = `/play/${episode.worldId}/${episode.episodeNumber}`;

  const inner = (
    <>
      <div className="tile-poster">
        {episode.posterUrl ? (
          <img src={episode.posterUrl} alt="" loading="lazy" />
        ) : (
          <div className="tile-poster-fallback" aria-hidden="true">
            <span>{episode.episodeNumber}</span>
          </div>
        )}
        {label && (
          <span className={`tile-badge tile-badge--${episode.access}`}>{label}</span>
        )}
        {!locked && (
          <div className="tile-hover" aria-hidden="true">
            <span className="tile-hover-play">▶</span>
            <p className="tile-hover-title">{episode.title}</p>
          </div>
        )}
        {locked && (
          <div className="tile-locked-overlay" aria-hidden="true">
            <span className="tile-lock-icon" />
          </div>
        )}
      </div>
      <p className="tile-meta">
        <span className="tile-ep">E{episode.episodeNumber}</span>
        <span className="tile-name">{episode.title}</span>
      </p>
    </>
  );

  if (locked) {
    return (
      <article className="episode-tile episode-tile--locked" aria-disabled="true">
        {inner}
      </article>
    );
  }

  return (
    <Link href={href} className="episode-tile">
      {inner}
    </Link>
  );
}
