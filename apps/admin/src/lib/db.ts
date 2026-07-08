/**
 * Postgres connectivity for the publish workflow
 * (docs/decisions/003-publish-scope-proposal.md).
 *
 * Optional by design, same philosophy as the pipeline's own DATABASE_URL
 * handling: without it, the dashboard stays exactly as read-only /
 * filesystem-only as before — publishing just isn't available.
 */

import { Pool } from 'pg';

let pool: Pool | undefined;

/** Shared pool, or null if DATABASE_URL isn't configured for this admin instance. */
export function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}
