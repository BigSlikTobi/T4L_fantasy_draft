export type ScoringFormat = 'PPR' | 'Half PPR' | 'Standard';
export type DraftFormat = 'Snake' | 'Linear';
export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';
export type DraftMode = 'assistant' | 'mock';
export type AIProvider = 'gemini' | 'openai';

export interface DraftSettings {
  leagueSize: number;
  scoringFormat: ScoringFormat;
  pickPosition: number;
  draftFormat: DraftFormat;
  aiProvider: AIProvider;
  fastMode?: boolean;
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  team: string;
}

export interface Tier {
  tier: number;
  players: Player[];
}

export interface UploadedPlayer {
    rank: number;
    name: string;
    team: string;
    position: Position;
    tier: number;
}

export interface GroundingSource {
  web?: {
    uri: string;
    title: string;
  };
}

export interface PlayerWithTier extends Player {
  tier: number;
}

export interface DraftStrategy {
  strategyName: string;
  explanation: string;
}

export interface DraftLogEntry {
  pick: number;
  round: number;
  pickInRound: number;
  team: number;
  player: Player;
}

export type TeamRosters = Record<number, Player[]>;

// Auto mock draft simulation results
export interface AutoMockPickLogEntry {
  pick: number; // global pick number
  round: number;
  pickInRound: number;
  player: Player;
  explanation: string; // AI reasoning for this pick
}

export interface AutoMockDraftResult {
  simulation: number; // simulation index starting at 1
  roster: Player[];   // final roster for the user's team
  pickLog: AutoMockPickLogEntry[]; // only picks of the user's team
}
