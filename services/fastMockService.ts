import { DraftSettings, Player, PlayerWithTier, TeamRosters, Position } from '../types';
import { computeEssentialNeeds, mustForceEssentialPick, pickEssentialPlayer, DEFAULT_TOTAL_ROSTER_SLOTS } from './rosterLogic.ts';

// Fast mode: Simple tier-based picking with basic position needs
export const getFastMockDraftPick = (
  settings: DraftSettings,
  allRosters: TeamRosters,
  pickingTeam: number,
  availablePlayers: PlayerWithTier[],
  blockedPlayers: string[]
): { playerName: string; explanation: string } => {
  const currentTeam = allRosters[pickingTeam] || [];
  const teamPositions = currentTeam.map(p => p.position);
  
  // Count positions on current team
  const positionCounts: Record<Position, number> = {
    QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0
  };
  
  teamPositions.forEach(pos => {
    positionCounts[pos] = positionCounts[pos] + 1;
  });

  // Position priority based on typical draft strategy.
  // We DEPRIORITIZE K / DST until the final rounds (last 3-4 roster spots) unless everything else is filled.
  const totalSlots = settings.totalRounds || DEFAULT_TOTAL_ROSTER_SLOTS;
  const rosterSize = currentTeam.length; // target total dynamic
  const needs = computeEssentialNeeds(positionCounts as any);
  const forceEssential = mustForceEssentialPick(rosterSize, needs, totalSlots);
  // Late / end phase thresholds scale relative to total slots (approx original logic 12 & 14 for 16)
  const latePhaseThreshold = Math.max(8, Math.floor(totalSlots * 0.75));
  const endPhaseThreshold = Math.max(latePhaseThreshold + 1, totalSlots - 2);
  const latePhase = rosterSize >= latePhaseThreshold;
  const endPhase = rosterSize >= endPhaseThreshold;

  const getPositionPriority = (position: Position, positionCounts: Record<Position, number>): number => {
    switch (position) {
      case 'QB':
        // 1 QB early, slight bump for a safe backup very late
        return positionCounts.QB === 0 ? 2.5 : (latePhase && positionCounts.QB === 1 ? 0.5 : 0);
      case 'RB':
        // Core + depth
        return positionCounts.RB < 2 ? 6 : (positionCounts.RB < 4 ? 4 : (positionCounts.RB < 5 ? 2 : 0.5));
      case 'WR':
        return positionCounts.WR < 2 ? 6 : (positionCounts.WR < 5 ? 5 : (positionCounts.WR < 6 ? 2.5 : 1));
      case 'TE':
        return positionCounts.TE === 0 ? 3.5 : (latePhase && positionCounts.TE === 1 ? 0.5 : 0);
      case 'K':
        if (positionCounts.K > 0) return 0; // Only draft one
        if (endPhase) return 8;            // Force pick if still missing
        if (latePhase) return 1;           // Light consideration late
        return -2;                         // Negative priority early
      case 'DST':
        if (positionCounts.DST > 0) return 0; // Only draft one
        if (endPhase) return 8;              // Force pick if still missing
        if (latePhase) return 1;             // Light consideration late
        return -2;                           // Negative priority early
      default:
        return 1;
    }
  };

  // Filter out blocked players
  const validPlayers = availablePlayers.filter(p => !blockedPlayers.includes(p.name));
  
  if (validPlayers.length === 0) {
    return {
      playerName: "No available players",
      explanation: "All available players are blocked"
    };
  }

  // Score players based on tier (lower is better) and position need
  // If we must force an essential slot, pick strictly from essentials
  if (forceEssential) {
    const essentialPick = pickEssentialPlayer(validPlayers, needs);
    if (essentialPick) {
      return {
        playerName: essentialPick.name,
        explanation: `Essential need fill (${essentialPick.position}) Tier ${essentialPick.tier}`
      };
    }
  }

  // End-game safeguard: if only 1 slot left after this pick and still missing K or DST, force whichever exists.
  const slotsRemaining = totalSlots - rosterSize;
  if (slotsRemaining <= 2) {
    if (needs.needK) {
      const k = validPlayers.find(p => p.position === 'K');
      if (k) return { playerName: k.name, explanation: `Late required K (Tier ${k.tier})` };
    }
    if (needs.needDST) {
      const d = validPlayers.find(p => p.position === 'DST');
      if (d) return { playerName: d.name, explanation: `Late required DST (Tier ${d.tier})` };
    }
  }

  const scoredPlayers = validPlayers.map(player => {
    const tierScore = player.tier;
    const positionPriority = getPositionPriority(player.position, positionCounts);
    // Additional bump if player satisfies an unmet essential (except K/DST early) to accelerate meeting requirements
    const essentialBonus = (() => {
      switch (player.position) {
        case 'QB': return needs.needQB ? 1.2 : 0;
        case 'TE': return needs.needTE ? 1.0 : 0;
        case 'RB': return needs.neededRB > 0 ? 1.5 : (needs.needFlex ? 0.6 : 0);
        case 'WR': return needs.neededWR > 0 ? 1.5 : (needs.needFlex ? 0.6 : 0);
        case 'DST': return needs.needDST && rosterSize >= 12 ? 2.2 : 0;
        case 'K': return needs.needK && rosterSize >= 12 ? 2.0 : 0;
        default: return 0;
      }
    })();
    const totalScore = tierScore - (positionPriority * 0.55) - essentialBonus;
    return { ...player, score: totalScore };
  });

  // Sort by score (lower is better)
  scoredPlayers.sort((a, b) => a.score - b.score);
  
  const selectedPlayer = scoredPlayers[0];
  const positionNeed = getPositionPriority(selectedPlayer.position, positionCounts) > 2;
  
  return {
    playerName: selectedPlayer.name,
    explanation: positionNeed 
      ? `Tier ${selectedPlayer.tier} ${selectedPlayer.position} - filling position need`
      : `Tier ${selectedPlayer.tier} ${selectedPlayer.position} - best available value`
  };
};
