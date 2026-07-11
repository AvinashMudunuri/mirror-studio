import { EpisodeTile, type EpisodeTileData } from '@/components/episode-tile';

interface EpisodeRowProps {
  title: string;
  subtitle?: string;
  episodes: EpisodeTileData[];
}

export function EpisodeRow({ title, subtitle, episodes }: EpisodeRowProps) {
  if (!episodes.length) return null;

  return (
    <section className="episode-row">
      <div className="container-wide episode-row-header">
        <h3 className="episode-row-title">{title}</h3>
        {subtitle && <p className="episode-row-subtitle">{subtitle}</p>}
      </div>
      <div className="episode-row-track-wrap">
        <div className="episode-row-track" role="list">
          {episodes.map(ep => (
            <div key={`${ep.worldId}-${ep.episodeNumber}`} className="episode-row-item" role="listitem">
              <EpisodeTile episode={ep} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
