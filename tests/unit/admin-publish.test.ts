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
import { isPublishable, reasonNotPublishable } from '../../apps/admin/src/lib/publish';

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
