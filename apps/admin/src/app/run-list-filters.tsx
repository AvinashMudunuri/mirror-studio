import Link from 'next/link';
import type { RunListFilter } from '@/lib/publish';

const FILTER_OPTIONS: Array<{ id: RunListFilter; label: string; hint: string }> = [
  { id: 'published', label: 'Published', hint: 'LIVE on the player' },
  { id: 'current', label: 'Current', hint: 'LIVE + latest unpublished' },
  { id: 'all', label: 'All runs', hint: 'Full filesystem history' }
];

export function RunListFilters({ active, hasDatabase }: { active: RunListFilter; hasDatabase: boolean }) {
  return (
    <div className="run-filters" role="tablist" aria-label="Filter episode runs">
      {FILTER_OPTIONS.map(option => {
        const disabled = !hasDatabase && option.id !== 'all';
        const className = `run-filter${active === option.id ? ' active' : ''}${disabled ? ' disabled' : ''}`;
        if (disabled) {
          return (
            <span key={option.id} className={className} title="Requires DATABASE_URL">
              {option.label}
            </span>
          );
        }
        return (
          <Link
            key={option.id}
            href={option.id === 'published' ? '/' : `/?filter=${option.id}`}
            className={className}
            title={option.hint}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
