import React from 'react';
import { AutoMockDraftResult, Player } from '../types';

interface AutoMockResultsProps {
  results: AutoMockDraftResult[];
  onBack: () => void;
}

const AutoMockResults: React.FC<AutoMockResultsProps> = ({ results, onBack }) => {
  if (results.length === 0) return null;

  const aggregateCounts: Record<string, number> = {};
  results.forEach(r => r.roster.forEach(p => {
    aggregateCounts[p.name] = (aggregateCounts[p.name] || 0) + 1;
  }));
  const mostFrequent = Object.entries(aggregateCounts)
    .sort((a,b)=> b[1]-a[1])
    .slice(0,10);

  // Positional distribution across simulations
  const positionTotals: Record<string, number> = {};
  results.forEach(r => r.roster.forEach(p => {
    positionTotals[p.position] = (positionTotals[p.position] || 0) + 1;
  }));
  const positionAverages = Object.entries(positionTotals)
    .map(([pos, total]) => ({ pos, avg: (total / results.length).toFixed(2), total }))
    .sort((a,b)=> a.pos.localeCompare(b.pos));

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">Auto Mock Results ({results.length})</h2>
        <button onClick={onBack} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm text-gray-200">Back to Setup</button>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map(res => (
          <div key={res.simulation} className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 flex flex-col">
            <h3 className="text-lg font-semibold text-teal-400 mb-2">Draft #{res.simulation}</h3>
            <div className="text-xs text-gray-400 mb-2">Roster ({res.roster.length}/16)</div>
            <ul className="text-sm space-y-1 flex-1">
              {res.roster.map(p => (
                <li key={p.id} className="text-gray-200 flex justify-between"><span>{p.name}</span><span className="text-gray-500">{p.position}</span></li>
              ))}
            </ul>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-200">Pick Log</summary>
              <ul className="mt-2 space-y-1 text-xs max-h-40 overflow-y-auto pr-1">
                {res.pickLog.map(pl => (
                  <li key={pl.pick} className="text-gray-300"><span className="font-mono text-teal-300">R{pl.round}P{pl.pickInRound}</span> {pl.player.name} <span className="text-gray-500">({pl.player.position})</span></li>
                ))}
              </ul>
            </details>
          </div>
        ))}
      </div>
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Most Frequent Players</h3>
        <ul className="text-sm grid md:grid-cols-2 lg:grid-cols-3 gap-2">
          {mostFrequent.map(([name,count]) => (
            <li key={name} className="bg-gray-900/40 px-2 py-1 rounded flex justify-between text-gray-300"><span>{name}</span><span className="text-teal-400 font-mono">x{count}</span></li>
          ))}
        </ul>
      </div>
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">Positional Distribution</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {positionAverages.map(p => (
            <div key={p.pos} className="bg-gray-900/40 rounded px-3 py-2 flex flex-col">
              <span className="text-gray-400 text-xs">{p.pos}</span>
              <span className="text-teal-300 font-mono text-base">{p.avg}</span>
              <span className="text-[10px] text-gray-500">Total {p.total}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AutoMockResults;
