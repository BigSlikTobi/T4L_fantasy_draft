import { GoogleGenAI, Type } from "@google/genai";
import { DraftSettings, Player, PlayerWithTier, DraftStrategy, TeamRosters } from '../types';
import { computeEssentialNeeds, essentialSlotsRemaining, DEFAULT_TOTAL_ROSTER_SLOTS } from './rosterLogic';

let ai: GoogleGenAI | null = null;

try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (error) {
  console.warn("Gemini client could not be initialized:", error);
}

const strategySchema = {
    type: Type.OBJECT,
    properties: {
        strategyName: {
            type: Type.STRING,
            description: "A concise name for the recommended draft strategy (e.g., 'Best Player Available', 'Zero RB', 'Target High-Upside WR')."
        },
        explanation: {
            type: Type.STRING,
            description: "A brief, 2-3 sentence explanation for why this strategy is recommended for the user's next pick, considering their current roster and the state of the draft board."
        }
    },
    required: ["strategyName", "explanation"]
};

const recommendationSchema = {
    type: Type.OBJECT,
    properties: {
        playerName: {
            type: Type.STRING,
            description: "The full name of the single player you recommend drafting."
        },
        explanation: {
            type: Type.STRING,
            description: "A brief, 2-3 sentence explanation for why this player is the best pick, considering both value and the user's current team composition."
        }
    },
    required: ["playerName", "explanation"]
};

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
  const unmetEssentialList: string[] = [];
  if (needs.needQB) unmetEssentialList.push('QB');
  if (needs.needTE) unmetEssentialList.push('TE');
  if (needs.neededRB > 0) unmetEssentialList.push(`RB x${needs.neededRB}`);
  if (needs.neededWR > 0) unmetEssentialList.push(`WR x${needs.neededWR}`);
  if (needs.needFlex) unmetEssentialList.push('Flex (RB/WR depth)');
  if (needs.needDST) unmetEssentialList.push('DST');
  if (needs.needK) unmetEssentialList.push('K');
  const essentialSummary = unmetEssentialList.length ? unmetEssentialList.join(', ') : 'All essential needs filled';

  const feedbackInstruction = userFeedback 
    ? `The user provided feedback on the last suggestion: "${userFeedback}". Adjust accordingly.`
    : '';
  const recentStrategies = memory?.strategies.slice(-3).map(s => `- ${s.strategyName}: ${s.explanation}`).join('\n') || 'None';
  const recentRecs = memory?.recommendations.slice(-3).map(r => `- ${r.playerName}: ${r.explanation}`).join('\n') || 'None';

  const prompt = `
You are an expert fantasy football draft analyst.
League: ${settings.leagueSize} teams, ${settings.scoringFormat} scoring.
Current roster: ${myTeamRoster}.
Best available (tiered, lower tier = better): ${availablePlayersList}.
Blocked: ${blockedPlayers.join(', ')}.

Essential context:
- Position counts: QB ${counts.QB}, RB ${counts.RB}, WR ${counts.WR}, TE ${counts.TE}, DST ${counts.DST}, K ${counts.K}
- Unmet essential needs: ${essentialSummary}
- Essential slots remaining (must fill): ${essentialRemaining}
- Picks left (including this one): ${picksLeft}

Mandatory logic:
- If essential slots remaining equals picks left, next pick MUST address an unmet essential need (list above).
- Avoid drafting K/DST before roster size >= 12 unless ALL core needs (QB, TE, RB>=2, WR>=2, RB+WR>=5) already satisfied AND no higher leverage essential gaps remain.
- Never plan to take a second K or DST.
- Factor tier cliffs vs postponable needs; do not risk being forced into low-tier starters by ignoring essentials.

Guidelines:
- Do NOT build early strategy around K (kicker) or DST (defense/special teams).
- Delay K/DST until late (roster size >= 12) unless core build is complete (>=1 QB, >=1 TE, >=5 combined RB/WR).
- Only one K and one DST total; no backups.
- Focus on tier cliffs, RB/WR depth balance, elite positional leverage at TE/QB, and avoiding positional runs.
${feedbackInstruction}

 Recent prior strategies (latest last):\n${recentStrategies}\nRecent prior picks recommended: \n${recentRecs}\n
 Task: Provide ONLY a high-level draft strategy for the next pick (no player names) in JSON (strategyName, explanation). Avoid repeating the last strategy verbatim unless objectively still optimal; if repeating, explicitly justify.`;

    try {
        const clientToUse = apiKey ? new GoogleGenAI({ apiKey }) : ai;
        
        if (!clientToUse) {
            throw new Error("Gemini client not available. Please provide an API key.");
        }

        const response = await clientToUse.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: strategySchema
            }
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error getting draft strategy:", error);
        throw new Error("Failed to get draft strategy from Gemini API.");
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

  // Essential roster context
  const counts = { QB:0,RB:0,WR:0,TE:0,K:0,DST:0 } as Record<string, number>;
  myTeam.forEach(p => { counts[p.position] = (counts[p.position]||0)+1; });
  const needs = computeEssentialNeeds(counts as any);
  const essentialRemaining = essentialSlotsRemaining(needs);
  const totalSlots = settings.totalRounds || DEFAULT_TOTAL_ROSTER_SLOTS;
  const picksLeft = totalSlots - myTeam.length; // including current pick
  const unmetEssentialList: string[] = [];
  if (needs.needQB) unmetEssentialList.push('QB');
  if (needs.needTE) unmetEssentialList.push('TE');
  if (needs.neededRB > 0) unmetEssentialList.push(`RB x${needs.neededRB}`);
  if (needs.neededWR > 0) unmetEssentialList.push(`WR x${needs.neededWR}`);
  if (needs.needFlex) unmetEssentialList.push('Flex');
  if (needs.needDST) unmetEssentialList.push('DST');
  if (needs.needK) unmetEssentialList.push('K');
  const essentialSummary = unmetEssentialList.length ? unmetEssentialList.join(', ') : 'All filled';
  
  const blockedPlayersList = blockedPlayers.length > 0
    ? `IMPORTANT: Do not recommend any of the following players, as I have blocked them: ${blockedPlayers.join(', ')}.`
    : '';

  const recentStrategies = memory?.strategies.slice(-3).map(s => `${s.strategyName}`).join(', ') || 'None';
  const recentPicks = memory?.recommendations.slice(-3).map(r => r.playerName).join(', ') || 'None';
  const prompt = `
You are an expert fantasy football draft analyst.
League: ${settings.leagueSize} teams, ${settings.scoringFormat} scoring.
Roster: ${myTeamRoster}.
Available (tiered): ${availablePlayersList}.
${blockedPlayersList}

Essential context:
- Counts: QB ${counts.QB}, RB ${counts.RB}, WR ${counts.WR}, TE ${counts.TE}, DST ${counts.DST}, K ${counts.K}
- Unmet essentials: ${essentialSummary}
- Essential slots remaining: ${essentialRemaining}
- Picks left (including this one): ${picksLeft}

Current strategy:
${strategy.strategyName} - ${strategy.explanation}

Recent strategies considered: ${recentStrategies}
Recent AI recommended picks: ${recentPicks}

Rules:
- If essential slots remaining equals picks left you MUST pick an unmet essential (from list above).
- Do NOT recommend K/DST unless roster size >= 12 OR core needs filled (QB>=1, TE>=1, RB+WR>=5).
- Only one K and one DST total; never suggest a second.
- Respect tier value; justify with tier & roster construction.
- Avoid leaving multiple essential needs to final picks (explain if risk taken).

Return JSON (playerName, explanation).`;
  
  try {
    const clientToUse = apiKey ? new GoogleGenAI({ apiKey }) : ai;
    
    if (!clientToUse) {
        throw new Error("Gemini client not available. Please provide an API key.");
    }

    const response = await clientToUse.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: recommendationSchema
        }
    });
    
    return JSON.parse(response.text);

  } catch (error) {
    console.error("Error getting draft recommendation:", error);
    throw new Error("Failed to get draft recommendation from Gemini API.");
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
  // Essential needs for this AI-controlled team
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
Unmet essentials: ${unmetStr} (remaining essential slots: ${essentialRemaining})
${blockedPlayers.length > 0 ? `Blocked: ${blockedPlayers.join(', ')}` : ''}

Rules:
- If essential slots remaining equals picks left you MUST pick an unmet essential.
- Defer K/DST until roster size >= 12 unless core needs filled (QB>=1, TE>=1, RB+WR>=5) AND no forced essential situation.
- Only 1 K and 1 DST total.
- Prioritize filling core starters & needed RB/WR depth and scarce advantage positions.
- Use tiers (lower = better) plus roster need & scarcity.
Return JSON with playerName and explanation.`;

      try {
          const clientToUse = apiKey ? new GoogleGenAI({ apiKey }) : ai;
          
          if (!clientToUse) {
              throw new Error("Gemini client not available. Please provide an API key.");
          }

          const response = await clientToUse.models.generateContent({
              model: 'gemini-2.5-flash-lite',
              contents: prompt,
              config: {
                  responseMimeType: "application/json",
                  responseSchema: recommendationSchema,
                  thinkingConfig: { thinkingBudget: 0 }
              }
          });
          return JSON.parse(response.text);
      } catch (error) {
          console.error("Error getting mock draft pick:", error);
          throw new Error("Failed to get mock draft pick from Gemini API.");
      }
  };