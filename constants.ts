
import { ScoringFormat, DraftFormat, Position, AIProvider } from './types';

export const SCORING_FORMATS: ScoringFormat[] = ['PPR', 'Half PPR', 'Standard'];
export const DRAFT_FORMATS: DraftFormat[] = ['Snake', 'Linear'];
export const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
export const AI_PROVIDERS: AIProvider[] = ['gemini', 'openai'];
