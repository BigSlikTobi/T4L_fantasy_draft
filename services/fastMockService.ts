import { DraftSettings, Player, PlayerWithTier, TeamRosters, Position } from '../types';

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

  // Position priority based on typical draft strategy
  const getPositionPriority = (position: Position, positionCounts: Record<Position, number>): number => {
    switch (position) {
      case 'QB': return positionCounts.QB === 0 ? 2 : 0;
      case 'RB': return positionCounts.RB < 2 ? 5 : (positionCounts.RB < 4 ? 3 : 1);
      case 'WR': return positionCounts.WR < 2 ? 5 : (positionCounts.WR < 5 ? 4 : 2);
      case 'TE': return positionCounts.TE === 0 ? 3 : 1;
      case 'K': return positionCounts.K === 0 ? 1 : 0;
      case 'DST': return positionCounts.DST === 0 ? 1 : 0;
      default: return 1;
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
  const scoredPlayers = validPlayers.map(player => {
    const tierScore = player.tier; // Lower tier = better player
    const positionPriority = getPositionPriority(player.position, positionCounts);
    const totalScore = tierScore - (positionPriority * 0.5); // Slight position preference
    
    return {
      ...player,
      score: totalScore
    };
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
