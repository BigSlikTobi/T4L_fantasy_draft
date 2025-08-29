import { Tier, PlayerWithTier, DraftSettings, TeamRosters } from '../types.ts';
import { getFastMockDraftPick } from '../services/fastMockService.ts';
// import { computeEssentialNeeds } from '../services/rosterLogic.ts'; // Not needed in harness now

// Simple in-memory simulation using tiers. Assumes K in tier 16 and DST in tier 17 as per user info.
// This script runs a number of simulated drafts and prints when K & DST are taken relative to roster size.

interface SimResult { rosterSizeWhenK: number | null; rosterSizeWhenDST: number | null; }

function simulateOneDraft(tiers: Tier[], settings: DraftSettings): SimResult {
  const leagueSize = settings.leagueSize;
  const rounds = 16;
  const draftOrder: number[] = [];
  for (let round = 1; round <= rounds; round++) {
    const isEven = round % 2 === 0;
    const picks = Array.from({ length: leagueSize }, (_, i) => i + 1);
    if (settings.draftFormat === 'Snake' && isEven) picks.reverse();
    draftOrder.push(...picks);
  }

  let availableTiers: Tier[] = JSON.parse(JSON.stringify(tiers));
  let rosters: TeamRosters = {};
  for (let i = 1; i <= leagueSize; i++) rosters[i] = [];

  const myTeamIndex = settings.pickPosition; // track just one team for metrics
  let rosterSizeWhenK: number | null = null;
  let rosterSizeWhenDST: number | null = null;

  for (let overall = 1; overall <= draftOrder.length; overall++) {
    const team = draftOrder[overall - 1];
    const availablePlayersWithTiers: PlayerWithTier[] = availableTiers.flatMap(t => t.players.map(p => ({ ...p, tier: t.tier })));
    if (!availablePlayersWithTiers.length) break;

    const result = getFastMockDraftPick(settings, rosters, team, availablePlayersWithTiers, []);
    const picked = availablePlayersWithTiers.find(p => p.name === result.playerName) || availablePlayersWithTiers[0];

    rosters[team] = [...(rosters[team] || []), picked];
    availableTiers = availableTiers.map(t => ({...t, players: t.players.filter(p => p.id !== picked.id)})).filter(t => t.players.length > 0);

    if (team === myTeamIndex) {
      if (picked.position === 'K' && rosterSizeWhenK === null) rosterSizeWhenK = rosters[team].length;
      if (picked.position === 'DST' && rosterSizeWhenDST === null) rosterSizeWhenDST = rosters[team].length;
    }
  }

  return { rosterSizeWhenK, rosterSizeWhenDST };
}

function buildDummyTiers(): Tier[] {
  // Construct minimal representative tiers; K & DST in tiers 16 & 17
  const tiers: Tier[] = [];
  let idCounter = 1;
  const add = (tier: number, position: string, count: number) => {
    if (!tiers.find(t => t.tier === tier)) tiers.push({ tier, players: [] });
    const bucket = tiers.find(t => t.tier === tier)!;
    for (let i = 0; i < count; i++) {
      bucket.players.push({ id: `${position}-${tier}-${idCounter++}`, name: `${position}${tier}-${i}`, position: position as any, team: 'T' });
    }
  };
  // Early tiers
  add(1, 'RB', 6); add(1, 'WR', 6); add(1, 'QB', 2); add(1, 'TE', 2);
  add(2, 'RB', 8); add(2, 'WR', 8); add(2, 'TE', 2); add(2, 'QB', 2);
  add(3, 'WR', 10); add(3, 'RB', 8); add(3, 'TE', 2);
  add(4, 'WR', 10); add(4, 'RB', 8); add(4, 'QB', 4);
  add(5, 'RB', 10); add(5, 'WR', 10); add(5, 'TE', 4);
  add(6, 'RB', 10); add(6, 'WR', 10);
  add(7, 'WR', 10); add(7, 'RB', 10);
  add(8, 'WR', 8); add(8, 'RB', 8);
  add(9, 'WR', 8); add(9, 'RB', 8);
  add(10, 'WR', 8); add(10, 'RB', 8);
  add(11, 'WR', 6); add(11, 'RB', 6);
  add(12, 'WR', 6); add(12, 'RB', 6);
  add(13, 'WR', 4); add(13, 'RB', 4);
  add(14, 'WR', 4); add(14, 'RB', 4);
  add(15, 'WR', 4); add(15, 'RB', 4);
  add(16, 'K', 8); // Kickers
  add(17, 'DST', 8); // Defenses
  tiers.sort((a,b) => a.tier - b.tier);
  return tiers;
}

async function main() {
  const simulations = 50;
  const settings: DraftSettings = {
    leagueSize: 12,
    scoringFormat: 'PPR',
    pickPosition: 5,
    draftFormat: 'Snake',
    aiProvider: 'gemini',
    fastMode: true
  };

  let kTotals: number[] = []; let dstTotals: number[] = [];
  let earlyK = 0; let earlyDST = 0;
  for (let i = 0; i < simulations; i++) {
    const tiers = buildDummyTiers();
    const { rosterSizeWhenK, rosterSizeWhenDST } = simulateOneDraft(tiers, settings);
    if (rosterSizeWhenK) kTotals.push(rosterSizeWhenK);
    if (rosterSizeWhenDST) dstTotals.push(rosterSizeWhenDST);
    if (rosterSizeWhenK && rosterSizeWhenK < 12) earlyK++;
    if (rosterSizeWhenDST && rosterSizeWhenDST < 12) earlyDST++;
  }

  const avg = (arr: number[]) => arr.reduce((a,b)=>a+b,0)/ (arr.length || 1);
  console.log(`Simulations: ${simulations}`);
  console.log(`K taken avg roster size: ${avg(kTotals).toFixed(2)} (values: ${kTotals.join(',')})`);
  console.log(`DST taken avg roster size: ${avg(dstTotals).toFixed(2)} (values: ${dstTotals.join(',')})`);
  console.log(`Early K picks (<12 roster size): ${earlyK}`);
  console.log(`Early DST picks (<12 roster size): ${earlyDST}`);
  if (earlyK === 0 && earlyDST === 0) {
    console.log('✅ PASS: No early K/DST selections across simulations.');
  } else {
    console.log('⚠️  WARNING: Some early K/DST selections occurred. Consider adjusting priority logic.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
