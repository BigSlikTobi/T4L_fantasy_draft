import React, { useState } from 'react';
import { DraftStrategy } from '../types';
import { CheckIcon } from './icons/CheckIcon';
import { CloseIcon } from './icons/CloseIcon';
import { RefreshIcon } from './icons/RefreshIcon';

interface StrategyModalProps {
  strategy: DraftStrategy;
  onConfirm: () => void;
  onRequestNew: (feedback: string) => void;
  onClose: () => void;
}

const StrategyModal: React.FC<StrategyModalProps> = ({ strategy, onConfirm, onRequestNew, onClose }) => {
  const [feedback, setFeedback] = useState('');

  const handleRequestNew = () => {
    onRequestNew(feedback);
    setFeedback(''); // Clear feedback after sending
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl border border-blue-500/50 max-w-lg w-full transform transition-all animate-fade-in-up relative">
        <div className="p-6">
          <div className="text-center">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-blue-400">Recommended Strategy</h3>
            <p className="text-3xl font-bold text-white mt-2">{strategy.strategyName}</p>
          </div>
          <div className="mt-6 p-4 bg-gray-900/50 rounded-lg">
            <p className="text-gray-300 text-center leading-relaxed">{strategy.explanation}</p>
          </div>
          <div className="mt-6 space-y-2">
            <label htmlFor="feedback" className="block text-sm font-medium text-gray-400">
              Not what you're looking for? Ask for something different.
            </label>
            <textarea
              id="feedback"
              rows={2}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g., 'Focus more on running backs' or 'I want a riskier pick.'"
              className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>
        <div className="bg-gray-700/50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-3 rounded-b-xl">
          <button
            onClick={onConfirm}
            className="w-full inline-flex justify-center items-center gap-2 rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
          >
            <CheckIcon className="w-5 h-5"/>
            Confirm & Get Pick
          </button>
          <button
            onClick={handleRequestNew}
            type="button"
            className="w-full inline-flex justify-center items-center gap-2 rounded-md border border-gray-500 shadow-sm px-4 py-2 bg-gray-600 text-base font-medium text-gray-200 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 sm:text-sm"
          >
             <RefreshIcon className="w-5 h-5"/>
             Suggest New Strategy
          </button>
        </div>
         <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
            <CloseIcon className="w-6 h-6" />
        </button>
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

export default StrategyModal;
