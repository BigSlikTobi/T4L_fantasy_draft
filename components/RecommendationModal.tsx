
import React from 'react';
import { Player } from '../types';
import { CheckIcon } from './icons/CheckIcon';
import { CloseIcon } from './icons/CloseIcon';

interface RecommendationModalProps {
  recommendation: {
    player: Player;
    explanation: string;
  };
  onClose: () => void;
  onConfirm: () => void;
}

const RecommendationModal: React.FC<RecommendationModalProps> = ({ recommendation, onClose, onConfirm }) => {
  const { player, explanation } = recommendation;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl border border-teal-500/50 max-w-lg w-full transform transition-all animate-fade-in-up">
        <div className="p-6">
          <div className="text-center">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-teal-400">AI Recommendation</h3>
            <p className="text-4xl font-bold text-white mt-2">{player.name}</p>
            <p className="text-lg text-gray-400">{player.position} - {player.team}</p>
          </div>
          <div className="mt-6 p-4 bg-gray-900/50 rounded-lg">
            <p className="text-gray-300 text-center leading-relaxed">{explanation}</p>
          </div>
        </div>
        <div className="bg-gray-700/50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-3 rounded-b-xl">
          <button
            onClick={onConfirm}
            className="w-full inline-flex justify-center items-center gap-2 rounded-md border border-transparent shadow-sm px-4 py-2 bg-teal-600 text-base font-medium text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:text-sm"
          >
            <CheckIcon className="w-5 h-5"/>
            Draft Player
          </button>
          <button
            onClick={onClose}
            type="button"
            className="w-full inline-flex justify-center items-center gap-2 rounded-md border border-gray-500 shadow-sm px-4 py-2 bg-gray-600 text-base font-medium text-gray-200 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 sm:text-sm"
          >
             <CloseIcon className="w-5 h-5"/>
             Dismiss
          </button>
        </div>
      </div>
       <style>{`
        @keyframes fade-in-up {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default RecommendationModal;
