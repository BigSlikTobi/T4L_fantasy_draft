
import React from 'react';
import { Player, DraftMode } from '../types';
import { AddIcon } from './icons/AddIcon';
import { RemoveIcon } from './icons/RemoveIcon';
import { BlockIcon } from './icons/BlockIcon';

interface PlayerCardProps {
  player: Player;
  onAction: (player: Player, action: 'add' | 'remove' | 'block') => void;
  isMyTurn?: boolean;
  draftMode?: DraftMode;
}

const positionColors: Record<string, string> = {
  QB: 'bg-red-500 text-red-100',
  RB: 'bg-green-500 text-green-100',
  WR: 'bg-blue-500 text-blue-100',
  TE: 'bg-yellow-500 text-yellow-100',
  K: 'bg-purple-500 text-purple-100',
  DST: 'bg-indigo-500 text-indigo-100',
};

const PlayerCard: React.FC<PlayerCardProps> = ({ player, onAction, isMyTurn, draftMode }) => {
  const isMockMyTurn = draftMode === 'mock' && isMyTurn;
  const isAssistantMode = draftMode === 'assistant' || !draftMode;
  
  return (
    <div className="bg-gray-700/50 rounded-lg p-3 flex items-center justify-between gap-3 border border-gray-600 hover:border-teal-500 transition-all duration-200 group">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${positionColors[player.position] || 'bg-gray-500'}`}>
          {player.position}
        </div>
        <div className="overflow-hidden">
          <p className="font-bold text-sm text-gray-200 truncate">{player.name}</p>
          <p className="text-xs text-gray-400">{player.team}</p>
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center gap-1.5">
        {(isAssistantMode || isMockMyTurn) && (
            <button
            onClick={() => onAction(player, 'add')}
            title="Add to My Team"
            className="p-1.5 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/40 hover:text-green-300 transition-colors"
            >
            <AddIcon className="w-4 h-4" />
            </button>
        )}
        <button
          onClick={() => onAction(player, 'block')}
          title="Block Player"
          className="p-1.5 rounded-full bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/40 hover:text-yellow-300 transition-colors"
        >
          <BlockIcon className="w-4 h-4" />
        </button>
        {isAssistantMode && (
            <button
            onClick={() => onAction(player, 'remove')}
            title="Remove from Board"
            className="p-1.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 transition-colors"
            >
            <RemoveIcon className="w-4 h-4" />
            </button>
        )}
      </div>
    </div>
  );
};

export default PlayerCard;
