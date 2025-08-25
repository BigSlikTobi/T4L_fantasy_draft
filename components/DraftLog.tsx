import React from 'react';
import { DraftLogEntry } from '../types';

interface DraftLogProps {
  log: DraftLogEntry[];
}

const positionColors: Record<string, string> = {
  QB: 'text-red-400',
  RB: 'text-green-400',
  WR: 'text-blue-400',
  TE: 'text-yellow-400',
  K: 'text-purple-400',
  DST: 'text-indigo-400',
};

const DraftLog: React.FC<DraftLogProps> = ({ log }) => {
  return (
    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <h2 className="text-xl font-bold text-gray-200 mb-3">Draft Log</h2>
        <div className="space-y-2 max-h-[26rem] overflow-y-auto pr-2">
            {log.slice().reverse().map(({ pick, round, pickInRound, team, player }) => (
                <div key={pick} className="flex items-center text-sm bg-gray-700/40 p-2 rounded-md">
                    <div className="font-mono text-gray-400 w-16 text-center shrink-0">
                        <span className="block text-xs">{`R${round}`}</span>
                        <span className="font-bold text-lg text-gray-200">{`P${pickInRound}`}</span>
                    </div>
                    <div className="border-l border-gray-600 pl-3 ml-3 flex-grow overflow-hidden">
                        <p className="font-bold text-gray-100 truncate" title={player.name}>{player.name}</p>
                        <p className="text-xs text-gray-400">
                           <span className={positionColors[player.position] || 'text-gray-400'}>{player.position}</span> - {player.team} | Team {team}
                        </p>
                    </div>
                </div>
            ))}
            {log.length === 0 && <p className="text-gray-500 text-center pt-8">The draft is about to begin...</p>}
        </div>
    </div>
  );
};

export default DraftLog;
