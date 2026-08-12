import { describe, it, expect } from 'vitest';
import { normalizeProposalsData } from '../hooks/useProposals.js';

/**
 * Regression guard for the post-login request storm.
 *
 * DashboardPage runs `useEffect(..., [proposals])` blocks that fetch from the
 * network and then setState. When `normalizeProposalsData` returned a fresh []
 * for every call, `proposals` was a new object on every render, so those
 * effects re-ran on every render, and their setState scheduled another render.
 * That loop fired hundreds of duplicate requests until the proposals query
 * settled — most visibly right after login/signup, when there is no cached
 * list in localStorage and `data` is undefined for the whole first stretch.
 *
 * The invariant that has to hold: equivalent input => identical reference.
 */
describe('normalizeProposalsData reference stability', () => {
  it('returns the SAME reference for undefined across calls', () => {
    expect(normalizeProposalsData(undefined)).toBe(normalizeProposalsData(undefined));
  });

  it('returns the SAME reference for every non-array input', () => {
    const first = normalizeProposalsData(undefined);
    for (const input of [null, {}, 0, '', false, { data: 'not-an-array' }]) {
      expect(normalizeProposalsData(input)).toBe(first);
    }
  });

  it('passes an array through by reference rather than copying', () => {
    const arr = [{ id: 'p1' }];
    expect(normalizeProposalsData(arr)).toBe(arr);
  });

  it('unwraps { data: [...] } by reference', () => {
    const inner = [{ id: 'p2' }];
    expect(normalizeProposalsData({ data: inner })).toBe(inner);
  });

  it('never hands back a mutable shared empty array', () => {
    // A shared instance is only safe if callers cannot mutate it into a
    // surprise for the next caller.
    const empty = normalizeProposalsData(undefined);
    expect(Object.isFrozen(empty)).toBe(true);
    expect(empty).toHaveLength(0);
  });
});
