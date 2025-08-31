import React, { useState } from 'react';
import { DraftStrategy } from '../types';

interface LogBookProps {
  strategies: DraftStrategy[];
  recommendations: { playerName: string; explanation: string }[];
  className?: string;
}

const LogBook: React.FC<LogBookProps> = ({ strategies, recommendations, className }) => {
  const [open, setOpen] = useState(true);

  // Pair strategies with recommendations by index (chronological). If uneven lengths, ignore trailing unmatched.
  const pairCount = Math.min(strategies.length, recommendations.length);
  const rows = Array.from({ length: pairCount }, (_, i) => ({
    strategy: strategies[i],
    recommendation: recommendations[i]
  }));

  // Show latest first
  rows.reverse();

  return (
    <div className={`bg-gray-800/50 rounded-lg border border-gray-700 ${className || ''}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-lg font-bold text-gray-200">AI Logbook</span>
        <span className="text-xs font-mono px-2 py-1 rounded bg-gray-700 text-teal-300">
          {pairCount} picks
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 max-h-64 overflow-y-auto pr-2">
          {rows.length === 0 ? (
            <p className="text-gray-500 text-sm">No AI picks yet.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-gray-300 bg-gray-900/40">
                  <th className="py-2 px-2 text-left font-semibold tracking-wide uppercase border-b border-gray-700/70">Strategy</th>
                  <th className="py-2 px-2 text-left font-semibold tracking-wide uppercase border-b border-gray-700/70">Pick</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="odd:bg-gray-900/30 even:bg-gray-900/10 hover:bg-gray-700/40 transition-colors">
                    <td className="py-1.5 px-2 align-top text-gray-200 font-medium">
                      {r.strategy.strategyName}
                    </td>
                    <td className="py-1.5 px-2 align-top">
                      <span className="text-teal-300 font-semibold">{r.recommendation.playerName}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default LogBook;
