import { GoogleGenAI, Type } from "@google/genai";
import { DraftSettings, Player, PlayerWithTier, DraftStrategy, TeamRosters } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
        My league settings are: ${settings.leagueSize} teams, ${settings.scoringFormat} scoring.
        My current roster is: ${myTeamRoster}.
        The best available players, along with their value tier (lower tier number is better), are: ${availablePlayersList}.
        The user has blocked these players: ${blockedPlayers.join(', ')}.

        Based on this situation, recommend a high-level draft strategy for my next pick.
        Your analysis should consider team needs, player value (tiers), and potential positional runs.
        Do NOT recommend a specific player yet. Just the strategy.
        ${feedbackInstruction}
        
        Provide a concise name for the strategy and a short explanation.
    `;

    try {
        const response = await ai.models.generateContent({
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
  strategy: DraftStrategy
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
    My league settings are: ${settings.leagueSize} teams, ${settings.scoringFormat} scoring.
    My current roster is: ${myTeamRoster}.
    The best available players, along with their value tier (lower tier number is better), are: ${availablePlayersList}.
    ${blockedPlayersList}

    We have agreed on the following strategy for this pick:
    Strategy Name: ${strategy.strategyName}
    Strategy Explanation: ${strategy.explanation}

    Based EXPLICITLY on this strategy, who should I draft next?
    Your recommendation should be heavily influenced by the player tiers provided, but must align with the chosen strategy.
    Recommend a single player and provide a short, compelling explanation for why they are the perfect fit for this strategy.
  `;
  
  try {
    const response = await ai.models.generateContent({
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
    blockedPlayers: string[]
  ): Promise<{ playerName: string; explanation: string }> => {
      const rostersSummary = Object.entries(allRosters)
          .map(([teamId, players]) => `Team ${teamId}: ${players.length > 0 ? players.map(p => `${p.name} (${p.position})`).join(', ') : 'No players yet.'}`)
          .join('\n');
      
      const availablePlayersList = availablePlayers.map(p => `${p.name} (${p.position}, Tier ${p.tier})`).join(', ');
  
      const blockedPlayersList = blockedPlayers.length > 0
        ? `The user has blocked these players, so do not pick them: ${blockedPlayers.join(', ')}.`
        : '';
  
      const prompt = `
          You are an expert fantasy football analyst simulating a draft.
          League settings: ${settings.leagueSize} teams, ${settings.scoringFormat} scoring.
          It is currently Team ${pickingTeam}'s turn to pick.
  
          Current rosters for all teams:
          ${rostersSummary}
  
          Best available players (lower tier is better):
          ${availablePlayersList}
          ${blockedPlayersList}
  
          Your task: Make the most logical and strategic pick for Team ${pickingTeam}.
          Consider their current roster to identify positional needs.
          Balance team need with the 'best player available' philosophy, heavily weighing the player tiers.
          Pick one player. Provide their name and a brief explanation for the pick.
      `;
  
      try {
          const response = await ai.models.generateContent({
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