import Link from 'next/link';

export interface BrowseHeroEpisode {
  worldId: string;
  episodeNumber: number;
  title: string;
  synopsis: string;
  posterUrl: string | null;
  seasonTitle: string;
  seasonSubtitle: string;
  status: 'not_started' | 'in_progress' | 'completed';
  ctaLabel: string;
}

interface BrowseHeroProps {
  featured: BrowseHeroEpisode | null;
}

export function BrowseHero({ featured }: BrowseHeroProps) {
  if (!featured) {
    return (
      <section className="browse-hero browse-hero--empty">
        <div className="browse-hero-content container-wide">
          <p className="browse-hero-eyebrow">MIRROR Player</p>
          <h2 className="browse-hero-title">Stories that respond to you</h2>
          <p className="browse-hero-synopsis">
            Publish an episode in the admin app to start playing.
          </p>
        </div>
      </section>
    );
  }

  const playHref = `/play/${featured.worldId}/${featured.episodeNumber}`;

  return (
    <section className="browse-hero">
      {featured.posterUrl && (
        <img
          className="browse-hero-bg"
          src={featured.posterUrl}
          alt=""
          aria-hidden="true"
        />
      )}
      <div className="browse-hero-vignette" aria-hidden="true" />
      <div className="browse-hero-content container-wide">
        <p className="browse-hero-eyebrow">
          {featured.seasonTitle} · {featured.seasonSubtitle}
        </p>
        <h2 className="browse-hero-title">
          Episode {featured.episodeNumber}: {featured.title}
        </h2>
        <p className="browse-hero-synopsis">{featured.synopsis}</p>
        <div className="browse-hero-actions">
          <Link href={playHref} className="btn-play">
            <span className="btn-play-icon" aria-hidden="true">▶</span>
            {featured.ctaLabel}
          </Link>
          {featured.status === 'in_progress' && (
            <span className="browse-hero-badge">In progress on this device</span>
          )}
        </div>
      </div>
    </section>
  );
}
