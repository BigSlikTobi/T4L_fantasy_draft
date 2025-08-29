import { PlayerWithTier, Position } from '../types';

export interface EssentialNeeds {
  needQB: boolean;
  needTE: boolean;
  needDST: boolean;
  needK: boolean;
  neededRB: number; // remaining to reach 2
  neededWR: number; // remaining to reach 2
  needFlex: boolean; // true if RB+WR < 5 (after satisfying the above minimums)
}

export const TOTAL_ROSTER_SLOTS = 16;

export function computeEssentialNeeds(counts: Record<Position, number>): EssentialNeeds {
  const neededRB = Math.max(0, 2 - counts.RB);
  const neededWR = Math.max(0, 2 - counts.WR);
  const needFlex = (counts.RB + counts.WR) < 5; // RB/WR combined < 5 means flex not yet satisfied
  return {
    needQB: counts.QB === 0,
    needTE: counts.TE === 0,
    needDST: counts.DST === 0,
    needK: counts.K === 0,
    neededRB,
    neededWR,
    needFlex
  };
}

export function essentialSlotsRemaining(needs: EssentialNeeds): number {
  return (needs.needQB ? 1 : 0)
    + (needs.needTE ? 1 : 0)
    + (needs.needDST ? 1 : 0)
    + (needs.needK ? 1 : 0)
    + needs.neededRB
    + needs.neededWR
    + (needs.needFlex ? 1 : 0);
}

// Decide if we must force an essential pick: remaining picks for team equals essential slots remaining.
export function mustForceEssentialPick(currentRosterSize: number, needs: EssentialNeeds): boolean {
  const remaining = TOTAL_ROSTER_SLOTS - currentRosterSize;
  return essentialSlotsRemaining(needs) === remaining;
}

// Select best essential player given available pool and current needs.
export function pickEssentialPlayer(available: PlayerWithTier[], needs: EssentialNeeds): PlayerWithTier | null {
  const isEssential = (pos: Position): boolean => {
    switch (pos) {
      case 'QB': return needs.needQB;
      case 'TE': return needs.needTE;
      case 'DST': return needs.needDST;
      case 'K': return needs.needK;
      case 'RB': return needs.neededRB > 0 || (needs.needFlex && (needs.neededRB === 0 && (needs.neededWR === 0))); // RB can satisfy flex after core min
      case 'WR': return needs.neededWR > 0 || (needs.needFlex && (needs.neededRB === 0 && (needs.neededWR === 0)));
      default: return false;
    }
  };
  const essentialCandidates = available.filter(p => isEssential(p.position));
  if (essentialCandidates.length === 0) return null;
  // Pick lowest tier; tie-break arbitrarily by name.
  essentialCandidates.sort((a,b) => a.tier === b.tier ? a.name.localeCompare(b.name) : a.tier - b.tier);
  return essentialCandidates[0];
}
