import { GoogleGenAI, Type } from "@google/genai";
import { DraftSettings, Player, PlayerWithTier, DraftStrategy, TeamRosters } from '../types';

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
Current roster: ${myTeamRoster}.
Best available (tiered, lower tier = better): ${availablePlayersList}.
Blocked: ${blockedPlayers.join(', ')}.

Guidelines:
- Do NOT build early strategy around K (kicker) or DST (defense/special teams).
- Delay K/DST until late (roster size >= 12) unless core build is complete (>=1 QB, >=1 TE, >=5 combined RB/WR).
- Only one K and one DST total; no backups.
- Focus on tier cliffs, RB/WR depth balance, elite positional leverage at TE/QB, and avoiding positional runs.
${feedbackInstruction}

Task: Provide ONLY a high-level draft strategy for the next pick (no player names) in JSON (strategyName, explanation).`;

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
Roster: ${myTeamRoster}.
Available (tiered): ${availablePlayersList}.
${blockedPlayersList}

Current strategy:
${strategy.strategyName} - ${strategy.explanation}

Rules:
- Do NOT recommend K/DST unless roster size >= 12 OR core needs filled (QB>=1, TE>=1, RB+WR>=5).
- Only one K and one DST total; never suggest a second.
- Respect tier value; justify with tier & roster construction.

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
  const prompt = `Pick for Team ${pickingTeam} in ${settings.leagueSize}-team ${settings.scoringFormat} league.
${positionSummary} | Roster size: ${rosterSize}
Top available: ${topPlayers}
${blockedPlayers.length > 0 ? `Blocked: ${blockedPlayers.join(', ')}` : ''}

Rules:
- Defer K/DST until roster size >= 12 unless core needs filled (QB>=1, TE>=1, RB+WR>=5).
- Only 1 K and 1 DST total.
- Prioritize filling starting & flex depth (RB/WR) and scarce advantage positions before K/DST.
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