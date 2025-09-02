import OpenAI from 'openai';
import { DraftSettings, Player, PlayerWithTier, DraftStrategy, TeamRosters } from '../types';
import { computeEssentialNeeds, essentialSlotsRemaining, DEFAULT_TOTAL_ROSTER_SLOTS } from './rosterLogic';

let openai: OpenAI | null = null;

try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    });
  }
} catch (error) {
  console.warn("OpenAI client could not be initialized:", error);
}

export const getDraftStrategy = async (
  settings: DraftSettings,
  myTeam: Player[],
  availablePlayers: PlayerWithTier[],
  blockedPlayers: string[],
  apiKey?: string,
  userFeedback?: string,
  memory?: { strategies: DraftStrategy[]; recommendations: { playerName: string; explanation: string }[] }
): Promise<DraftStrategy> => {
  const myTeamRoster = myTeam.length > 0
    ? myTeam.map(p => `${p.name} (${p.position})`).join(', ')
    : 'No players drafted yet.';
    
  const availablePlayersList = availablePlayers.map(p => `${p.name} (${p.position}, Tier ${p.tier})`).join(', ');

  // Essential roster context
  const counts = { QB:0,RB:0,WR:0,TE:0,K:0,DST:0 } as Record<string, number>;
  myTeam.forEach(p => { counts[p.position] = (counts[p.position]||0)+1; });
  const needs = computeEssentialNeeds(counts as any);
  const essentialRemaining = essentialSlotsRemaining(needs);
  const totalSlots = settings.totalRounds || DEFAULT_TOTAL_ROSTER_SLOTS;
  const picksLeft = totalSlots - myTeam.length; // including current pick
  const unmet: string[] = [];
  if (needs.needQB) unmet.push('QB');
  if (needs.needTE) unmet.push('TE');
  if (needs.neededRB>0) unmet.push(`RB x${needs.neededRB}`);
  if (needs.neededWR>0) unmet.push(`WR x${needs.neededWR}`);
  if (needs.needFlex) unmet.push('Flex');
  if (needs.needDST) unmet.push('DST');
  if (needs.needK) unmet.push('K');
  const essentialSummary = unmet.length ? unmet.join(', ') : 'All essential needs satisfied';
    
  const feedbackInstruction = userFeedback 
    ? `User feedback on last strategy: "${userFeedback}". Adjust accordingly.`
    : '';
  const recentStrategies = memory?.strategies.slice(-3).map(s => `- ${s.strategyName}: ${s.explanation}`).join('\n') || 'None';
  const recentRecs = memory?.recommendations.slice(-3).map(r => `- ${r.playerName}: ${r.explanation}`).join('\n') || 'None';

    const prompt = `
You are an expert fantasy football draft analyst.
League: ${settings.leagueSize} teams, ${settings.scoringFormat} scoring.
My current roster: ${myTeamRoster}.
Best available (with tier, lower = better): ${availablePlayersList}.
Blocked players: ${blockedPlayers.join(', ')}.

Essential context:
- Position counts: QB ${counts.QB}, RB ${counts.RB}, WR ${counts.WR}, TE ${counts.TE}, DST ${counts.DST}, K ${counts.K}
- Unmet essential needs: ${essentialSummary}
- Essential slots remaining: ${essentialRemaining}
- Picks left (including this one): ${picksLeft}

Guidelines:
- If essential slots remaining equals picks left the next pick MUST address an unmet essential (list above).
- NEVER build a strategy around drafting a K (kicker) or DST (defense) early.
- Deprioritize K/DST until roster size >= 12 or last 3–4 picks unless all core needs already satisfied (QB>=1, TE>=1, RB>=2, WR>=2, RB+WR>=5) and no forced essential logic applies.
- Only one K and one DST will ever be drafted total.
- Focus strategy on RB/WR value pockets, elite positional advantage at TE/QB, roster construction, and tier drop-offs.
${feedbackInstruction}

Recent prior strategies (latest last):\n${recentStrategies}\nRecent recommended picks: \n${recentRecs}\n
Task: Recommend a high-level draft strategy for the NEXT pick ONLY (do NOT name a specific player). Avoid repeating the last strategy name verbatim unless it remains clearly optimal (justify if repeated).
Return JSON:
{
  "strategyName": "Concise strategy name",
  "explanation": "2-3 sentence rationale referencing roster construction & tier dynamics"
}`;

    try {
        const clientToUse = apiKey ? new OpenAI({ apiKey, dangerouslyAllowBrowser: true }) : openai;
        
        if (!clientToUse) {
            throw new Error("OpenAI client not available. Please provide an API key.");
        }

        const completion = await clientToUse.chat.completions.create({
            model: 'gpt-5-2025-08-07',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error("No response from OpenAI");
        }

        return JSON.parse(content);
    } catch (error) {
        console.error("Error getting draft strategy:", error);
        throw new Error("Failed to get draft strategy from OpenAI API.");
    }
};

export const getDraftRecommendation = async (
  settings: DraftSettings,
  myTeam: Player[],
  availablePlayers: PlayerWithTier[],
  blockedPlayers: string[],
  strategy: DraftStrategy,
  apiKey?: string,
  memory?: { strategies: DraftStrategy[]; recommendations: { playerName: string; explanation: string }[] }
): Promise<{ playerName: string; explanation: string }> => {
  const myTeamRoster = myTeam.length > 0
    ? myTeam.map(p => `${p.name} (${p.position})`).join(', ')
    : 'No players drafted yet.';

  const availablePlayersList = availablePlayers.map(p => `${p.name} (${p.position}, Tier ${p.tier})`).join(', ');

  // Essential context
  const counts = { QB:0,RB:0,WR:0,TE:0,K:0,DST:0 } as Record<string, number>;
  myTeam.forEach(p => { counts[p.position] = (counts[p.position]||0)+1; });
  const needs = computeEssentialNeeds(counts as any);
  const essentialRemaining = essentialSlotsRemaining(needs);
  const totalSlots = settings.totalRounds || DEFAULT_TOTAL_ROSTER_SLOTS;
  const picksLeft = totalSlots - myTeam.length; // including this pick
  const unmet: string[] = [];
  if (needs.needQB) unmet.push('QB');
  if (needs.needTE) unmet.push('TE');
  if (needs.neededRB>0) unmet.push(`RB x${needs.neededRB}`);
  if (needs.neededWR>0) unmet.push(`WR x${needs.neededWR}`);
  if (needs.needFlex) unmet.push('Flex');
  if (needs.needDST) unmet.push('DST');
  if (needs.needK) unmet.push('K');
  const essentialSummary = unmet.length ? unmet.join(', ') : 'All essentials met';
  
  const blockedPlayersList = blockedPlayers.length > 0
    ? `IMPORTANT: Do not recommend any of the following players, as I have blocked them: ${blockedPlayers.join(', ')}.`
    : '';

  const recentStrategies = memory?.strategies.slice(-3).map(s => s.strategyName).join(', ') || 'None';
  const recentPicks = memory?.recommendations.slice(-3).map(r => r.playerName).join(', ') || 'None';
  const prompt = `
You are an expert fantasy football draft analyst.
League: ${settings.leagueSize} teams, ${settings.scoringFormat} scoring.
My roster: ${myTeamRoster}.
Available (tiered): ${availablePlayersList}.
${blockedPlayersList}

Current agreed strategy:
Name: ${strategy.strategyName}
Explanation: ${strategy.explanation}

Recent strategies used: ${recentStrategies}
Recent AI picks: ${recentPicks}

Essential context:
- Counts: QB ${counts.QB}, RB ${counts.RB}, WR ${counts.WR}, TE ${counts.TE}, DST ${counts.DST}, K ${counts.K}
- Unmet essentials: ${essentialSummary}
- Essential slots remaining: ${essentialRemaining}
- Picks left: ${picksLeft}

Rules:
- If essential slots remaining equals picks left you MUST recommend an unmet essential need.
- DO NOT recommend a K or DST unless roster size >= 12 OR all core needs (QB>=1, TE>=1, RB>=2, WR>=2, RB+WR>=5) are addressed and no forced essential situation.
- Only one K and one DST maximum; never recommend a second of either.
- Respect tiers: prefer the best tier value that fits the strategy and roster construction.

Return JSON only:
{
  "playerName": "Full Name",
  "explanation": "2-3 sentence justification tied to strategy and tier value"
}`;
  
  try {
    const clientToUse = apiKey ? new OpenAI({ apiKey, dangerouslyAllowBrowser: true }) : openai;
    
    if (!clientToUse) {
        throw new Error("OpenAI client not available. Please provide an API key.");
    }

    const completion = await clientToUse.chat.completions.create({
        model: 'gpt-5-2025-08-07',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
        throw new Error("No response from OpenAI");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("Error getting draft recommendation:", error);
    throw new Error("Failed to get draft recommendation from OpenAI API.");
  }
};

export const getMockDraftPick = async (
    settings: DraftSettings,
    allRosters: TeamRosters,
    pickingTeam: number,
    availablePlayers: PlayerWithTier[],
    blockedPlayers: string[],
    apiKey?: string
  ): Promise<{ playerName: string; explanation: string }> => {
      // Simplified roster summary - only show current team and basic stats
  const currentTeam = allRosters[pickingTeam] || [];
      const teamPositions = currentTeam.map(p => p.position);
      const positionCounts = teamPositions.reduce((acc, pos) => {
        acc[pos] = (acc[pos] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Only show top 15 available players for speed
      const topPlayers = availablePlayers.slice(0, 15).map(p => `${p.name} (${p.position}, T${p.tier})`).join(', ');
      
      const positionSummary = Object.keys(positionCounts).length > 0 
        ? `Current roster: ${Object.entries(positionCounts).map(([pos, count]) => `${count} ${pos}`).join(', ')}`
        : 'Empty roster';

  const rosterSize = currentTeam.length;
  // Essential needs for AI team
  const counts = { QB:0,RB:0,WR:0,TE:0,K:0,DST:0 } as Record<string, number>;
  currentTeam.forEach(p => { counts[p.position] = (counts[p.position]||0)+1; });
  const needs = computeEssentialNeeds(counts as any);
  const essentialRemaining = essentialSlotsRemaining(needs);
  const totalSlots = settings.totalRounds || DEFAULT_TOTAL_ROSTER_SLOTS;
  const picksLeft = totalSlots - rosterSize;
  const unmet: string[] = [];
  if (needs.needQB) unmet.push('QB');
  if (needs.needTE) unmet.push('TE');
  if (needs.neededRB>0) unmet.push(`RB x${needs.neededRB}`);
  if (needs.neededWR>0) unmet.push(`WR x${needs.neededWR}`);
  if (needs.needFlex) unmet.push('Flex');
  if (needs.needDST) unmet.push('DST');
  if (needs.needK) unmet.push('K');
  const unmetStr = unmet.length ? unmet.join(', ') : 'None';
  const prompt = `Pick for Team ${pickingTeam} in ${settings.leagueSize}-team ${settings.scoringFormat} league.
${positionSummary} | Roster size: ${rosterSize} | Picks left: ${picksLeft}
Top available: ${topPlayers}
Unmet essentials: ${unmetStr} (essential slots remaining: ${essentialRemaining})
${blockedPlayers.length > 0 ? `Blocked: ${blockedPlayers.join(', ')}` : ''}

Rules:
- If essential slots remaining equals picks left you MUST draft an unmet essential.
- Defer K / DST until roster size >= 12 unless all core needs met and not forced by essentials.
- Never select more than one K or one DST total.
- Prefer filling RB/WR depth and any missing core starters before K/DST.
- Use tiers: lower tier = better. Break ties by positional scarcity / roster need.

Return JSON: {"playerName": "Full Name", "explanation": "Brief reason"}`;

      try {
          const clientToUse = apiKey ? new OpenAI({ apiKey, dangerouslyAllowBrowser: true }) : openai;
          
          if (!clientToUse) {
              throw new Error("OpenAI client not available. Please provide an API key.");
          }

          const completion = await clientToUse.chat.completions.create({
              model: 'gpt-5-nano-2025-08-07',
              messages: [{ role: 'user', content: prompt }],
              response_format: { type: 'json_object' },
          });

          const content = completion.choices[0]?.message?.content;
          if (!content) {
              throw new Error("No response from OpenAI");
          }

          return JSON.parse(content);
      } catch (error) {
          console.error("Error getting mock draft pick:", error);
          throw new Error("Failed to get mock draft pick from OpenAI API.");
      }
  };
