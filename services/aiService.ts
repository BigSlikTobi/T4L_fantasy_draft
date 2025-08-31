import { DraftSettings, Player, PlayerWithTier, DraftStrategy, TeamRosters, AIProvider } from '../types';
import * as geminiService from './geminiService';
import * as openaiService from './openaiService';
import { getFastMockDraftPick } from './fastMockService';

export const getDraftStrategy = async (
  settings: DraftSettings,
  myTeam: Player[],
  availablePlayers: PlayerWithTier[],
  blockedPlayers: string[],
  apiKeys: { gemini?: string; openai?: string },
    userFeedback?: string,
    memory?: { strategies: DraftStrategy[]; recommendations: { playerName: string; explanation: string }[] }
): Promise<DraftStrategy> => {
    const provider = settings.aiProvider;
    
    if (provider === 'openai') {
                return openaiService.getDraftStrategy(settings, myTeam, availablePlayers, blockedPlayers, apiKeys.openai, userFeedback, memory);
    } else {
                return geminiService.getDraftStrategy(settings, myTeam, availablePlayers, blockedPlayers, apiKeys.gemini, userFeedback, memory);
    }
};

export const getDraftRecommendation = async (
  settings: DraftSettings,
  myTeam: Player[],
  availablePlayers: PlayerWithTier[],
  blockedPlayers: string[],
  strategy: DraftStrategy,
    apiKeys: { gemini?: string; openai?: string },
    memory?: { strategies: DraftStrategy[]; recommendations: { playerName: string; explanation: string }[] }
): Promise<{ playerName: string; explanation: string }> => {
    const provider = settings.aiProvider;
    
    if (provider === 'openai') {
                return openaiService.getDraftRecommendation(settings, myTeam, availablePlayers, blockedPlayers, strategy, apiKeys.openai, memory);
    } else {
                return geminiService.getDraftRecommendation(settings, myTeam, availablePlayers, blockedPlayers, strategy, apiKeys.gemini, memory);
    }
};

export const getMockDraftPick = async (
    settings: DraftSettings,
    allRosters: TeamRosters,
    pickingTeam: number,
    availablePlayers: PlayerWithTier[],
    blockedPlayers: string[],
    apiKeys: { gemini?: string; openai?: string }
  ): Promise<{ playerName: string; explanation: string }> => {
    // Use fast mode if enabled
    if (settings.fastMode) {
        return getFastMockDraftPick(settings, allRosters, pickingTeam, availablePlayers, blockedPlayers);
    }
    
    const provider = settings.aiProvider;
    
    if (provider === 'openai') {
        return openaiService.getMockDraftPick(settings, allRosters, pickingTeam, availablePlayers, blockedPlayers, apiKeys.openai);
    } else {
        return geminiService.getMockDraftPick(settings, allRosters, pickingTeam, availablePlayers, blockedPlayers, apiKeys.gemini);
    }
};
