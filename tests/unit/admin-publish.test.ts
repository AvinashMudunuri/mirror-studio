/**
 * Unit tests for the admin publish workflow's pure logic
 * (apps/admin/src/lib/publish.ts).
 *
 * docs/decisions/003-publish-scope-proposal.md: an episode is publishable
 * only when the FULL review board approved it (a dev-mode run with
 * SKIP_REVIEWERS must never count, even if APPROVED) and a human then
 * confirms it here. These tests cover only the pure decision logic —
 * no real Postgres connection is made.
 */

import { describe, it, expect } from '@jest/globals';
import { isPublishable, reasonNotPublishable, publishLabelForRun, parseRunListFilter, matchesRunListFilter } from '../../apps/admin/src/lib/publish';

describe('reasonNotPublishable / isPublishable', () => {
  it('is publishable when APPROVED with no skipped reviewers', () => {
    const row = { status: 'APPROVED', metadata: { run: { skippedReviewers: [] } } };
    expect(reasonNotPublishable(row)).toBeNull();
    expect(isPublishable(row)).toBe(true);
  });

  it('rejects an episode that has never been persisted to Postgres', () => {
    expect(reasonNotPublishable(null)).toMatch(/persist:run/);
    expect(isPublishable(null)).toBe(false);
  });

  it('rejects a non-APPROVED status', () => {
    const row = { status: 'IN_REVIEW', metadata: { run: { skippedReviewers: [] } } };
    expect(reasonNotPublishable(row)).toMatch(/not APPROVED/);
    expect(isPublishable(row)).toBe(false);
  });

  it('rejects a dev-mode run even though its status is APPROVED — full board is required', () => {
    const row = { status: 'APPROVED', metadata: { run: { skippedReviewers: ['childPsychologist', 'gameDesigner', 'ethicsReviewer'] } } };
    const reason = reasonNotPublishable(row);
    expect(reason).toMatch(/Full review board required/);
    expect(reason).toMatch(/childPsychologist/);
    expect(isPublishable(row)).toBe(false);
  });

  it('treats a PUBLISHED status (this action\'s own doing) as still publishable — re-checking an already-published episode must not reject it', () => {
    const row = { status: 'PUBLISHED', metadata: { run: { skippedReviewers: [] } } };
    expect(reasonNotPublishable(row)).toBeNull();
    expect(isPublishable(row)).toBe(true);
  });

  it('tolerates missing metadata/run/skippedReviewers instead of throwing', () => {
    expect(isPublishable({ status: 'APPROVED', metadata: null })).toBe(true);
    expect(isPublishable({ status: 'APPROVED', metadata: {} })).toBe(true);
    expect(isPublishable({ status: 'APPROVED', metadata: { run: {} } })).toBe(true);
  });
});

describe('publishLabelForRun', () => {
  const index = [
    {
      worldId: 'NEW_SCHOOL',
      episodeNumber: 1,
      title: 'First Bell',
      publishedRunFolder: 'output/episodes/episode-01-first-day/run-2026-07-10_13-26-56',
      publishedAt: '2026-07-10T00:00:00Z',
      contentRunFolder: 'output/episodes/episode-01-first-day/run-2026-07-10_13-26-56'
    },
    {
      worldId: 'NEW_SCHOOL',
      episodeNumber: 2,
      title: 'Show Your Work',
      publishedRunFolder: 'output/episodes/episode-02-the-group-project/run-2026-07-10_22-26-36',
      publishedAt: '2026-07-10T01:00:00Z',
      contentRunFolder: 'output/episodes/episode-02-the-group-project/run-2026-07-10_22-26-36'
    },
    {
      worldId: 'NEW_SCHOOL',
      episodeNumber: 3,
      title: 'Showcase',
      publishedRunFolder: null,
      publishedAt: null,
      contentRunFolder: 'output/episodes/episode-03-the-invite/run-2026-07-10_22-52-33'
    }
  ];

  it('marks the published run folder as live', () => {
    expect(publishLabelForRun('output/episodes/episode-02-the-group-project/run-2026-07-10_22-26-36', index)).toBe('live');
  });

  it('marks latest persisted-but-unpublished content', () => {
    expect(publishLabelForRun('output/episodes/episode-03-the-invite/run-2026-07-10_22-52-33', index)).toBe('latest');
  });

  it('marks historical run folders as not published', () => {
    expect(publishLabelForRun('output/episodes/episode-02-the-group-project/run-2026-07-10_15-32-04', index)).toBe('not_published');
  });
});

describe('parseRunListFilter / matchesRunListFilter', () => {
  it('defaults to published', () => {
    expect(parseRunListFilter(undefined)).toBe('published');
    expect(parseRunListFilter('')).toBe('published');
  });

  it('rejects unknown filters', () => {
    expect(parseRunListFilter('bogus')).toBe('published');
  });

  it('published filter keeps only live runs', () => {
    expect(matchesRunListFilter('live', 'published', true)).toBe(true);
    expect(matchesRunListFilter('latest', 'published', true)).toBe(false);
    expect(matchesRunListFilter('not_published', 'published', true)).toBe(false);
  });

  it('current filter keeps live and latest', () => {
    expect(matchesRunListFilter('live', 'current', true)).toBe(true);
    expect(matchesRunListFilter('latest', 'current', true)).toBe(true);
    expect(matchesRunListFilter('not_published', 'current', true)).toBe(false);
  });

  it('all filter keeps everything', () => {
    expect(matchesRunListFilter('not_published', 'all', true)).toBe(true);
  });

  it('without database shows all runs regardless of filter', () => {
    expect(matchesRunListFilter(null, 'published', false)).toBe(true);
    expect(matchesRunListFilter('not_published', 'current', false)).toBe(true);
  });
});
