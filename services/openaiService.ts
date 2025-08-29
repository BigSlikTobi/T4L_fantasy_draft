import OpenAI from 'openai';
import { DraftSettings, Player, PlayerWithTier, DraftStrategy, TeamRosters } from '../types';

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
  userFeedback?: string
): Promise<DraftStrategy> => {
    const myTeamRoster = myTeam.length > 0
        ? myTeam.map(p => `${p.name} (${p.position})`).join(', ')
        : 'No players drafted yet.';
    
    const availablePlayersList = availablePlayers.map(p => `${p.name} (${p.position}, Tier ${p.tier})`).join(', ');
    
    const feedbackInstruction = userFeedback 
        ? `The user provided the following feedback on the last suggestion: "${userFeedback}". Take this into account and suggest a different strategy.`
        : '';

    const prompt = `
You are an expert fantasy football draft analyst.
League: ${settings.leagueSize} teams, ${settings.scoringFormat} scoring.
My current roster: ${myTeamRoster}.
Best available (with tier, lower = better): ${availablePlayersList}.
Blocked players: ${blockedPlayers.join(', ')}.

Guidelines:
- NEVER build a strategy around drafting a K (kicker) or DST (defense) early.
- Deprioritize K/DST until very late (roster size >= 12 or last 3–4 picks) unless all core needs are satisfied (>=1 QB, >=1 TE, and at least 5 combined RB/WR).
- Only one K and one DST will ever be drafted total.
- Focus strategy on RB/WR value pockets, elite positional advantage at TE/QB, roster construction, and tier drop-offs.
${feedbackInstruction}

Task: Recommend a high-level draft strategy for the NEXT pick ONLY (do NOT name a specific player).
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
  apiKey?: string
): Promise<{ playerName: string; explanation: string }> => {
  const myTeamRoster = myTeam.length > 0
    ? myTeam.map(p => `${p.name} (${p.position})`).join(', ')
    : 'No players drafted yet.';

  const availablePlayersList = availablePlayers.map(p => `${p.name} (${p.position}, Tier ${p.tier})`).join(', ');
  
  const blockedPlayersList = blockedPlayers.length > 0
    ? `IMPORTANT: Do not recommend any of the following players, as I have blocked them: ${blockedPlayers.join(', ')}.`
    : '';

  const prompt = `
You are an expert fantasy football draft analyst.
League: ${settings.leagueSize} teams, ${settings.scoringFormat} scoring.
My roster: ${myTeamRoster}.
Available (tiered): ${availablePlayersList}.
${blockedPlayersList}

Current agreed strategy:
Name: ${strategy.strategyName}
Explanation: ${strategy.explanation}

Rules:
- DO NOT recommend a K or DST unless roster size >= 12 OR all core needs (QB, TE, depth at RB/WR) are addressed.
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
  const prompt = `Pick for Team ${pickingTeam} in ${settings.leagueSize}-team ${settings.scoringFormat} league.
${positionSummary} | Roster size: ${rosterSize}
Top available: ${topPlayers}
${blockedPlayers.length > 0 ? `Blocked: ${blockedPlayers.join(', ')}` : ''}

Rules:
- Defer K / DST until roster size >= 12 (final rounds) unless ALL of: QB>=1, TE>=1, (RB+WR)>=5 already met.
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
