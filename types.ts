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
  // Optional Sleeper integration info
  sleeper?: {
    username: string;
    userId: string;
    leagueId: string;
    leagueName: string;
  draftId?: string;
  draftStartTime?: number; // epoch ms
  };
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

// Sleeper API types
export interface SleeperUser {
  user_id: string; // sleeper uses snake_case in API
  username: string;
  display_name?: string;
  avatar?: string | null;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string; // e.g. "2025"
  season_type?: string;
  total_rosters: number;
  status?: string; // e.g. "pre_draft", "drafting", etc.
  sport?: string; // e.g. "nfl"
  draft_id?: string;
  previous_league_id?: string;
  avatar?: string | null;
  settings?: Record<string, any>;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  status: string; // e.g. pre_draft, draft, complete
  type?: string; // snake, auction, etc.
  start_time?: number; // epoch ms
  sport?: string; // nfl
  settings?: Record<string, any>;
}

export interface SleeperDraftPick {
  draft_id: string;
  draft_slot: number;
  is_keeper: boolean | null;
  metadata: {
    first_name?: string;
    last_name?: string;
    player_id?: string;
    position?: string;
    team?: string;
    sport?: string;
    status?: string;
    [k: string]: any;
  };
  pick_no: number;
  picked_by: string; // user id who picked
  player_id: string;
  reactions: any;
  roster_id: number;
  round: number;
}
