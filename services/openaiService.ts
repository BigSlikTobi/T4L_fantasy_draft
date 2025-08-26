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
        My league settings are: ${settings.leagueSize} teams, ${settings.scoringFormat} scoring.
        My current roster is: ${myTeamRoster}.
        The best available players, along with their value tier (lower tier number is better), are: ${availablePlayersList}.
        The user has blocked these players: ${blockedPlayers.join(', ')}.

        Based on this situation, recommend a high-level draft strategy for my next pick.
        Your analysis should consider team needs, player value (tiers), and potential positional runs.
        Do NOT recommend a specific player yet. Just the strategy.
        ${feedbackInstruction}
        
        Provide a concise name for the strategy and a short explanation.
        
        Respond with a JSON object with the following structure:
        {
            "strategyName": "A concise name for the recommended draft strategy",
            "explanation": "A brief, 2-3 sentence explanation for why this strategy is recommended"
        }
    `;

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
    
    Respond with a JSON object with the following structure:
    {
        "playerName": "The full name of the single player you recommend drafting",
        "explanation": "A brief, 2-3 sentence explanation for why this player is the best pick"
    }
  `;
  
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

      const prompt = `Pick for Team ${pickingTeam} in ${settings.leagueSize}-team ${settings.scoringFormat} league.
${positionSummary}
Top available: ${topPlayers}
${blockedPlayers.length > 0 ? `Blocked: ${blockedPlayers.join(', ')}` : ''}

Pick best player considering team needs and tier value (lower tier = better). JSON format: {"playerName": "Full Name", "explanation": "Brief reason"}`;

      try {
          const clientToUse = apiKey ? new OpenAI({ apiKey, dangerouslyAllowBrowser: true }) : openai;
          
          if (!clientToUse) {
              throw new Error("OpenAI client not available. Please provide an API key.");
          }

          const completion = await clientToUse.chat.completions.create({
              model: 'gpt-5-nano-2025-08-07',
              messages: [{ role: 'user', content: prompt }],
              response_format: { type: 'json_object' },
              max_tokens: 150,
              temperature: 0.3
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
