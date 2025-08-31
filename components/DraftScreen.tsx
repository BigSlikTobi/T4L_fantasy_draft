import React, { useState, useMemo } from 'react';
import { Tier, Player, Position, DraftMode, DraftLogEntry, DraftSettings } from '../types';
import { computeEssentialNeeds, essentialSlotsRemaining, TOTAL_ROSTER_SLOTS } from '../services/rosterLogic';
import { POSITIONS } from '../constants';
import PlayerCard from './PlayerCard';
import RecommendationModal from './RecommendationModal';
import DraftLog from './DraftLog';
import LogBook from './LogBook';
import { SearchIcon } from './icons/SearchIcon';
import { TeamIcon } from './icons/TeamIcon';
import { ResetIcon } from './icons/ResetIcon';
import { BlockIcon } from './icons/BlockIcon';

interface DraftScreenProps {
  tiers: Tier[];
  myTeam: Player[];
  draftedCount: number;
  blockedPlayers: Set<string>;
  onPlayerAction: (player: Player, action: 'add' | 'remove' | 'block') => void;
  onGetRecommendation: () => void;
  recommendation: { player: Player; explanation: string } | null;
  onClearRecommendation: () => void;
  onReset: () => void;
  // Mock Draft Props
  draftMode: DraftMode;
  draftLog: DraftLogEntry[];
  currentPick: number;
  leagueSize: number;
  isMyTurn: boolean;
  isSimulating: boolean;
  draftSettings?: DraftSettings;
  strategyHistory?: { strategyName: string; explanation: string }[];
  recommendationHistory?: { playerName: string; explanation: string }[];
}

const DraftScreen: React.FC<DraftScreenProps> = ({
  tiers, myTeam, draftedCount, blockedPlayers, onPlayerAction, onGetRecommendation,
  recommendation, onClearRecommendation, onReset, draftMode, draftLog, currentPick,
  leagueSize, isMyTurn, isSimulating, draftSettings, strategyHistory = [], recommendationHistory = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<Position | 'ALL'>('ALL');

  const filteredTiers = useMemo(() => {
    if (!searchTerm && positionFilter === 'ALL') return tiers;
    return tiers.map(tier => ({
        ...tier,
        players: tier.players.filter(player => 
          player.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          (positionFilter === 'ALL' || player.position === positionFilter)
        ),
      })).filter(tier => tier.players.length > 0);
  }, [tiers, searchTerm, positionFilter]);

  // Essential roster status (now for both assistant + mock modes)
  const rosterStatus = useMemo(() => {
    if (!draftSettings) return null;
    const counts = { QB:0,RB:0,WR:0,TE:0,K:0,DST:0 } as Record<Position, number>;
    myTeam.forEach(p => { counts[p.position]++; });
    const needs = computeEssentialNeeds(counts as any);
    const remaining = essentialSlotsRemaining(needs);
    return { counts, needs, remaining, rosterSize: myTeam.length };
  }, [myTeam, draftSettings]);
  
  const myTeamByPosition = useMemo(() => {
    const grouped = myTeam.reduce((acc, player) => {
        acc[player.position] = [...(acc[player.position] || []), player];
        return acc;
    }, {} as Record<Position, Player[]>);
    return POSITIONS.map(pos => ({ position: pos, players: grouped[pos] || [] }));
  }, [myTeam]);

  const blockedPlayersArray = useMemo(() => Array.from(blockedPlayers), [blockedPlayers]);

  const round = Math.floor((currentPick - 1) / leagueSize) + 1;
  const pickInRound = ((currentPick - 1) % leagueSize) + 1;
  const draftIsOver = currentPick > leagueSize * 16;


  return (
    <div>
      {draftMode === 'mock' && (
        <div className="text-center mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
          <p className={`text-xl font-bold ${isMyTurn ? 'text-teal-400 animate-pulse' : 'text-gray-200'}`}>
            {draftIsOver ? "Mock Draft Complete!" : (isMyTurn ? "It's Your Turn to Pick!" : `Simulating Opponent's Pick...`)}
          </p>
          {!draftIsOver &&
            <p className="text-gray-400 font-mono text-sm">
              Round {round}, Pick {pickInRound} (Overall: {currentPick})
            </p>
          }
        </div>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 transition-all duration-300 ${draftSettings?.fastMode ? 'animate-pulse opacity-90' : ''}`}>
  {rosterStatus && (
          <div className="lg:col-span-12 mb-2 flex flex-wrap gap-2 text-xs">
            <StatusPill label={`Roster ${rosterStatus.rosterSize}/${TOTAL_ROSTER_SLOTS}`} />
            <StatusPill label={`QB ${rosterStatus.counts.QB}${rosterStatus.needs.needQB ? ' (need)' : ''}`} warn={rosterStatus.needs.needQB} />
            <StatusPill label={`RB ${rosterStatus.counts.RB}`} warn={rosterStatus.needs.neededRB>0} />
            <StatusPill label={`WR ${rosterStatus.counts.WR}`} warn={rosterStatus.needs.neededWR>0} />
            <StatusPill label={`TE ${rosterStatus.counts.TE}${rosterStatus.needs.needTE ? ' (need)' : ''}`} warn={rosterStatus.needs.needTE} />
            <StatusPill label={`Flex ${rosterStatus.needs.needFlex ? 'open' : 'filled'}`} warn={rosterStatus.needs.needFlex} />
            <StatusPill label={`DST ${rosterStatus.counts.DST}${rosterStatus.needs.needDST ? ' (late)' : ''}`} warn={rosterStatus.needs.needDST && rosterStatus.rosterSize>=12} />
            <StatusPill label={`K ${rosterStatus.counts.K}${rosterStatus.needs.needK ? ' (late)' : ''}`} warn={rosterStatus.needs.needK && rosterStatus.rosterSize>=12} />
            <StatusPill label={`Essential left ${rosterStatus.remaining}`} emphasize={rosterStatus.remaining === (16 - rosterStatus.rosterSize)} />
          </div>
        )}
        {recommendation && (
          <RecommendationModal
            recommendation={recommendation}
            onClose={onClearRecommendation}
            onConfirm={() => onPlayerAction(recommendation.player, 'add')}
          />
        )}
        {/* Left Column: Player Board */}
        <div className="lg:col-span-8 xl:col-span-9 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <h2 className="text-2xl font-bold mb-4 text-gray-200">Draft Board</h2>
          <div className="flex flex-col sm:flex-row gap-4 mb-4 sticky top-4 bg-gray-800/80 backdrop-blur-sm p-2 rounded-lg z-10">
            <div className="relative flex-grow">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text" placeholder="Search player name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex-shrink-0">
              <select
                value={positionFilter} onChange={e => setPositionFilter(e.target.value as Position | 'ALL')}
                className="w-full sm:w-auto bg-gray-700 border border-gray-600 rounded-md py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="ALL">All Positions</option>
                {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-6 max-h-[calc(100vh-320px)] overflow-y-auto pr-2">
            {filteredTiers.length > 0 ? filteredTiers.map(tier => (
              <div key={tier.tier}>
                <h3 className="text-xl font-semibold mb-3 text-teal-400 border-b-2 border-teal-500/30 pb-1">Tier {tier.tier}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {tier.players.map(player => (
                    <PlayerCard key={player.id} player={player} onAction={onPlayerAction} isMyTurn={isMyTurn} draftMode={draftMode} />
                  ))}
                </div>
              </div>
            )) : (
              <div className="text-center py-16 text-gray-400"><p className="text-lg">No players match your criteria.</p><p>Try adjusting your search or filters.</p></div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          {draftMode === 'mock' && (
            <DraftLog 
              log={draftLog} 
              isSimulating={isSimulating}
              fastMode={draftSettings?.fastMode || false}
            />
          )}
          <LogBook strategies={strategyHistory} recommendations={recommendationHistory} />
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-200 flex items-center gap-2"><TeamIcon className="w-6 h-6"/>My Team</h2>
                  <span className="text-sm font-mono bg-gray-700 text-teal-300 px-2 py-1 rounded">{myTeam.length}/16</span>
              </div>
              <div className="space-y-3 h-64 overflow-y-auto pr-2">
                  {myTeamByPosition.map(({ position, players}) => ( players.length > 0 && (
                      <div key={position}>
                          <h4 className="font-bold text-teal-400">{position}</h4>
                          <ul className="text-sm space-y-1 mt-1">
                              {players.map(p => (<li key={p.id} className="text-gray-300 flex justify-between"><span>{p.name}</span><span className="text-gray-500">{p.team}</span></li>))}
                          </ul>
                      </div>
                  )))}
                  {myTeam.length === 0 && <p className="text-gray-500 text-center pt-8">Your roster is empty. Make your first pick!</p>}
              </div>
          </div>
          <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-4">
              <h2 className="text-xl font-bold text-gray-200">Draft Actions</h2>
              <div className="text-sm text-gray-400">Total Players Drafted: <span className="font-bold text-white">{draftedCount}</span></div>
              <button
                  onClick={onGetRecommendation}
                  disabled={draftMode === 'mock' && (!isMyTurn || isSimulating)}
                  className="w-full text-center py-3 px-4 border border-transparent rounded-md shadow-sm font-medium text-white bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 focus:ring-offset-gray-900 transition-transform transform hover:scale-105 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed disabled:scale-100"
              >
                  Get AI Recommendation
              </button>
              <button onClick={onReset} className="w-full flex items-center justify-center gap-2 text-center py-2 px-4 rounded-md text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:ring-offset-gray-900 transition">
                  <ResetIcon className="w-4 h-4"/>Start New Draft
              </button>
          </div>
          {blockedPlayersArray.length > 0 && (
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                  <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2 mb-3"><BlockIcon className="w-5 h-5 text-red-400"/>Blocked Players</h3>
                  <div className="max-h-32 overflow-y-auto pr-2">
                      <ul className="text-sm space-y-1">{blockedPlayersArray.map(name => (<li key={name} className="text-gray-400">{name}</li>))}</ul>
                  </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DraftScreen;

// Inline lightweight pill component
const StatusPill: React.FC<{label: string; warn?: boolean; emphasize?: boolean}> = ({ label, warn, emphasize }) => (
  <span className={`px-2 py-1 rounded-full border text-[10px] tracking-wide uppercase ${emphasize ? 'bg-teal-600 text-white border-teal-500' : warn ? 'bg-red-900/40 text-red-300 border-red-600' : 'bg-gray-700/60 text-gray-300 border-gray-600'}`}>{label}</span>
);
