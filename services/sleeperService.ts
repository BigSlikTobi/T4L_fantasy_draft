// Lightweight Sleeper API wrapper (public endpoints)
// Sleeper API docs: https://docs.sleeper.com/
import type { SleeperUser, SleeperLeague, SleeperDraft, SleeperDraftPick } from '../types';

const BASE = 'https://api.sleeper.app/v1';

async function http<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Sleeper API ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchSleeperUser(username: string): Promise<SleeperUser> {
  return http<SleeperUser>(`${BASE}/user/${encodeURIComponent(username)}`);
}

export async function fetchSleeperLeagues(userId: string, season: string): Promise<SleeperLeague[]> {
  // Sport fixed to NFL for now per requirements
  return http<SleeperLeague[]>(`${BASE}/user/${encodeURIComponent(userId)}/leagues/nfl/${encodeURIComponent(season)}`);
}

export interface NormalizedLeagueOption {
  id: string;
  name: string;
  season: string;
  totalRosters: number;
  raw: SleeperLeague;
}

export function normalizeLeagues(leagues: SleeperLeague[]): NormalizedLeagueOption[] {
  return leagues.map(l => ({
    id: l.league_id,
    name: l.name || 'Unnamed League',
    season: l.season,
    totalRosters: l.total_rosters,
    raw: l
  })).sort((a,b) => a.name.localeCompare(b.name));
}

export async function fetchSleeperDrafts(leagueId: string): Promise<SleeperDraft[]> {
  return http<SleeperDraft[]>(`${BASE}/league/${encodeURIComponent(leagueId)}/drafts`);
}

export interface NormalizedDraftOption {
  id: string;
  startTime?: number;
  status: string;
  type?: string;
  raw: SleeperDraft;
  label: string; // human friendly label for select
}

export function normalizeDrafts(drafts: SleeperDraft[]): NormalizedDraftOption[] {
  return drafts.map(d => {
    const dt = d.start_time ? new Date(d.start_time) : null;
    const label = dt ? `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${d.status})` : `Draft ${d.draft_id} (${d.status})`;
    return {
      id: d.draft_id,
      startTime: d.start_time,
      status: d.status,
      type: d.type,
      raw: d,
      label
    };
  }).sort((a,b) => (a.startTime || 0) - (b.startTime || 0));
}

export async function fetchSleeperDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  return http<SleeperDraftPick[]>(`${BASE}/draft/${encodeURIComponent(draftId)}/picks`);
}
