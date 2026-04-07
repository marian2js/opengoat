// ---------------------------------------------------------------------------
// Job tier scoring — groups and ranks jobs into hero / primary / secondary
// ---------------------------------------------------------------------------

export type JobTier = "hero" | "primary" | "secondary";

export interface TieredJobs<T> {
  hero: T | null;
  primary: T[];
  secondary: T[];
}

const MAX_PRIMARY = 4;
const MIN_PRIMARY = 2;

/**
 * Groups jobs by their `tier` field and enforces the tier hierarchy:
 * - Exactly 1 hero (extras demoted to primary; if none, first primary promoted)
 * - 2–4 primary (overflow demoted to secondary; underflow promoted from secondary)
 * - Remaining jobs are secondary
 *
 * Jobs without a `tier` field default to secondary.
 * Original order within each tier is preserved.
 */
export function groupAndRankJobs<T extends { tier?: JobTier }>(jobs: T[]): TieredJobs<T> {
  if (jobs.length === 0) {
    return { hero: null, primary: [], secondary: [] };
  }

  // Step 1: bucket by tier metadata
  const heroes: T[] = [];
  const primaries: T[] = [];
  const secondaries: T[] = [];

  for (const job of jobs) {
    switch (job.tier) {
      case "hero":
        heroes.push(job);
        break;
      case "primary":
        primaries.push(job);
        break;
      default:
        secondaries.push(job);
        break;
    }
  }

  // Step 2: enforce exactly 1 hero — demote extras to primary
  let hero: T | null = null;
  if (heroes.length > 0) {
    hero = heroes[0];
    // Demote extra heroes to the front of primary
    for (let i = 1; i < heroes.length; i++) {
      primaries.unshift(heroes[i]);
    }
  }

  // Step 3: if no hero, promote first primary
  if (!hero && primaries.length > 0) {
    hero = primaries.shift()!;
  }

  // Step 4: enforce 2–4 primary count
  // Overflow: demote excess to secondary
  while (primaries.length > MAX_PRIMARY) {
    secondaries.unshift(primaries.pop()!);
  }

  // Underflow: promote from secondary
  while (primaries.length < MIN_PRIMARY && secondaries.length > 0) {
    primaries.push(secondaries.shift()!);
  }

  return { hero, primary: primaries, secondary: secondaries };
}
