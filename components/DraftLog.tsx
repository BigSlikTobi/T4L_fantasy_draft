import React, { useEffect, useState } from 'react';
import { DraftLogEntry } from '../types';

interface DraftLogProps {
  log: DraftLogEntry[];
  isSimulating?: boolean;
  fastMode?: boolean;
}

const positionColors: Record<string, string> = {
  QB: 'text-red-400',
  RB: 'text-green-400',
  WR: 'text-blue-400',
  TE: 'text-yellow-400',
  K: 'text-purple-400',
  DST: 'text-indigo-400',
};

const DraftLog: React.FC<DraftLogProps> = ({ log, isSimulating = false, fastMode = false }) => {
  const [animatedEntries, setAnimatedEntries] = useState<Set<number>>(new Set());
  const [highlightedEntry, setHighlightedEntry] = useState<number | null>(null);

  // Animate new entries
  useEffect(() => {
    if (log.length > 0) {
      const latestPick = log[log.length - 1].pick;
      
      // Highlight the latest entry
      setHighlightedEntry(latestPick);
      
      // Add animation class
      setAnimatedEntries(prev => new Set([...prev, latestPick]));
      
      // Remove highlight after animation
      const timer = setTimeout(() => {
        setHighlightedEntry(null);
      }, fastMode ? 300 : 1000);
      
      return () => clearTimeout(timer);
    }
  }, [log.length, fastMode]);

  const getEntryClass = (pick: number) => {
    let baseClass = "flex items-center text-sm bg-gray-700/40 p-2 rounded-md transition-all duration-300";
    
    if (highlightedEntry === pick) {
      if (fastMode) {
        baseClass += " bg-teal-500/30 transform scale-102 shadow-lg shadow-teal-500/20 animate-pulse";
      } else {
        baseClass += " bg-green-500/30 transform scale-105 shadow-lg shadow-green-500/20";
      }
    }
    
    if (animatedEntries.has(pick)) {
      baseClass += " animate-slideInLeft";
    }
    
    return baseClass;
  };

  const getPlayerNameClass = (pick: number) => {
    let baseClass = "font-bold text-gray-100 truncate transition-colors duration-300";
    
    if (highlightedEntry === pick) {
      baseClass += fastMode ? " text-teal-300" : " text-green-300";
    }
    
    return baseClass;
  };

  return (
    <div className={`bg-gray-800/50 p-4 rounded-lg border border-gray-700 transition-all duration-300 ${fastMode && isSimulating ? 'fast-mode-glow' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-gray-200">Draft Log</h2>
          {isSimulating && (
            <div className="flex items-center gap-2">
              {fastMode && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-pickingDots"></div>
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-pickingDots"></div>
                  <div className="w-2 h-2 bg-teal-400 rounded-full animate-pickingDots"></div>
                </div>
              )}
              <span className="text-xs text-gray-400">
                {fastMode ? 'Fast picking...' : 'Simulating...'}
              </span>
            </div>
          )}
        </div>
        <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-2">
            {log.slice().reverse().map(({ pick, round, pickInRound, team, player }) => (
                <div key={pick} className={getEntryClass(pick)}>
                    <div className="font-mono text-gray-400 w-16 text-center shrink-0">
                        <span className="block text-xs">{`R${round}`}</span>
                        <span className="font-bold text-lg text-gray-200">{`P${pickInRound}`}</span>
                    </div>
                    <div className="border-l border-gray-600 pl-3 ml-3 flex-grow overflow-hidden">
                        <p className={getPlayerNameClass(pick)} title={player.name}>{player.name}</p>
                        <p className="text-xs text-gray-400">
                           <span className={positionColors[player.position] || 'text-gray-400'}>{player.position}</span> - {player.team} | Team {team}
                        </p>
                    </div>
                    {highlightedEntry === pick && fastMode && (
                      <div className="w-2 h-2 bg-teal-400 rounded-full animate-ping"></div>
                    )}
                </div>
            ))}
            {log.length === 0 && <p className="text-gray-500 text-center pt-8">The draft is about to begin...</p>}
        </div>
    </div>
  );
};

export default DraftLog;
