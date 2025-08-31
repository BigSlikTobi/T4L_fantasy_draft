import React, { useState } from 'react';
import { DraftSettings, UploadedPlayer, Position, DraftMode } from '../types';
import { SCORING_FORMATS, DRAFT_FORMATS, POSITIONS, AI_PROVIDERS } from '../constants';
import { FootballIcon } from './icons/FootballIcon';
import { FileUploadIcon } from './icons/FileUploadIcon';
import { CheckIcon } from './icons/CheckIcon';

interface SetupScreenProps {
  onStart: (settings: DraftSettings, players: UploadedPlayer[], mode: DraftMode, apiKeys: { gemini?: string; openai?: string }) => void;
  onAutoMock?: (settings: DraftSettings, players: UploadedPlayer[], count: number, apiKeys: { gemini?: string; openai?: string }) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onStart, onAutoMock }) => {
  const [settings, setSettings] = useState<DraftSettings>({
    leagueSize: 12,
    scoringFormat: 'PPR',
    pickPosition: 1,
    draftFormat: 'Snake',
    aiProvider: 'gemini',
    fastMode: false,
  });
  const [players, setPlayers] = useState<UploadedPlayer[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [draftMode, setDraftMode] = useState<DraftMode>('assistant');
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [autoMockCount, setAutoMockCount] = useState<number>(0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : (name === 'leagueSize' || name === 'pickPosition' ? parseInt(value, 10) : value),
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setPlayers(null);
    setFileError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== 'string') {
          throw new Error('Failed to read file content.');
        }
        const data = JSON.parse(text);

        if (!Array.isArray(data) || data.length === 0) throw new Error('JSON must be a non-empty array of players.');
        const firstPlayer = data[0];
        const requiredKeys: (keyof UploadedPlayer)[] = ['rank', 'name', 'team', 'position', 'tier'];
        for (const key of requiredKeys) {
          if (!(key in firstPlayer)) throw new Error(`Each player object must contain the key: "${key}".`);
        }
        if (!POSITIONS.includes(firstPlayer.position)) {
             throw new Error(`Invalid position "${firstPlayer.position}". Must be one of: ${POSITIONS.join(', ')}`);
        }
        setPlayers(data);
      } catch (err) {
        if (err instanceof Error) setFileError(`Error parsing file: ${err.message}`);
        else setFileError('An unknown error occurred while parsing the file.');
      }
    };
    reader.onerror = () => setFileError('Failed to read the file.');
    reader.readAsText(file);
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (players) {
      const apiKeys = {
        gemini: geminiApiKey || undefined,
        openai: openaiApiKey || undefined
      };
      onStart(settings, players, draftMode, apiKeys);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-gray-800 rounded-xl shadow-2xl overflow-hidden border border-gray-700">
      <div className="p-8">
        <div className="flex justify-center mb-6">
          <FootballIcon className="w-16 h-16 text-teal-400" />
        </div>
        <h2 className="text-center text-3xl font-bold text-white mb-2">Configure Your Draft</h2>
        <p className="text-center text-gray-400 mb-8">Enter league details and upload your player list.</p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300">Draft Mode</label>
            <div className="mt-1 grid grid-cols-2 gap-2 rounded-lg bg-gray-700 p-1">
              <button
                type="button"
                onClick={() => setDraftMode('assistant')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${draftMode === 'assistant' ? 'bg-teal-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
              >
                Draft Assistant
              </button>
              <button
                type="button"
                onClick={() => setDraftMode('mock')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${draftMode === 'mock' ? 'bg-teal-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
              >
                Mock Draft
              </button>
            </div>
          </div>
          {draftMode === 'mock' && (
            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  name="fastMode"
                  checked={settings.fastMode || false}
                  onChange={handleChange}
                  className="h-4 w-4 text-teal-600 bg-gray-700 border-gray-600 rounded focus:ring-teal-500 focus:ring-2"
                />
                <span className="text-sm font-medium text-gray-300">Fast Mode</span>
              </label>
              <p className="mt-1 text-xs text-gray-400">
                Speeds up mock draft picks with shorter AI prompts (recommended for faster simulations)
              </p>
            </div>
          )}
          <div>
            <label htmlFor="leagueSize" className="block text-sm font-medium text-gray-300">No. of Teams</label>
            <input
              type="number" id="leagueSize" name="leagueSize" value={settings.leagueSize} onChange={handleChange} min="8" max="20"
              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500" required
            />
          </div>
          <div>
            <label htmlFor="pickPosition" className="block text-sm font-medium text-gray-300">Your Pick Position</label>
            <input
              type="number" id="pickPosition" name="pickPosition" value={settings.pickPosition} onChange={handleChange} min="1" max={settings.leagueSize}
              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500" required
            />
          </div>
          <div>
            <label htmlFor="scoringFormat" className="block text-sm font-medium text-gray-300">Scoring Format</label>
            <select
              id="scoringFormat" name="scoringFormat" value={settings.scoringFormat} onChange={handleChange}
              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500"
            >
              {SCORING_FORMATS.map(format => <option key={format} value={format}>{format}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="draftFormat" className="block text-sm font-medium text-gray-300">Draft Format</label>
            <select
              id="draftFormat" name="draftFormat" value={settings.draftFormat} onChange={handleChange}
              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500"
            >
              {DRAFT_FORMATS.map(format => <option key={format} value={format}>{format}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="aiProvider" className="block text-sm font-medium text-gray-300">AI Provider</label>
            <select
              id="aiProvider" name="aiProvider" value={settings.aiProvider} onChange={handleChange}
              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500"
            >
              {AI_PROVIDERS.map(provider => (
                <option key={provider} value={provider}>
                  {provider === 'gemini' ? 'Google Gemini' : 'OpenAI GPT'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300">
              {settings.aiProvider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}
            </label>
            <input
              type="password"
              id="apiKey"
              value={settings.aiProvider === 'gemini' ? geminiApiKey : openaiApiKey}
              onChange={(e) => {
                if (settings.aiProvider === 'gemini') {
                  setGeminiApiKey(e.target.value);
                } else {
                  setOpenaiApiKey(e.target.value);
                }
              }}
              placeholder={`Enter your ${settings.aiProvider === 'gemini' ? 'Gemini' : 'OpenAI'} API key`}
              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500"
              required
            />
            <p className="mt-1 text-xs text-gray-400">
              {settings.aiProvider === 'gemini' 
                ? 'Get your API key from https://ai.google.dev/' 
                : 'Get your API key from https://platform.openai.com/api-keys'}
            </p>
          </div>
          <div>
            <label htmlFor="playerFile" className="block text-sm font-medium text-gray-300">Player Rankings File</label>
            <label htmlFor="player-file-upload" className="mt-1 flex justify-center items-center gap-2 w-full px-3 py-2 border-2 border-dashed border-gray-600 rounded-md cursor-pointer bg-gray-700/50 hover:bg-gray-700/80 transition-colors">
              <FileUploadIcon className="w-5 h-5 text-gray-400"/>
              <span className="text-gray-400 text-sm">Upload a .json file</span>
            </label>
            <input id="player-file-upload" type="file" className="hidden" accept=".json" onChange={handleFileChange} />
             {fileName && (
              <div className={`mt-2 text-sm flex items-center gap-2 ${fileError ? 'text-red-400' : 'text-green-400'}`}>
                {players && <CheckIcon className="w-5 h-5" />}
                <span className="truncate">{fileName} {players ? `(${players.length} players loaded)` : ''}</span>
              </div>
            )}
            {fileError && <p className="mt-2 text-sm text-red-400">{fileError}</p>}
          </div>
          {draftMode === 'mock' && (
            <div>
              <label htmlFor="autoMockCount" className="block text-sm font-medium text-gray-300">Auto Mock Drafts (batch)</label>
              <input
                type="number"
                id="autoMockCount"
                value={autoMockCount}
                min={0}
                max={50}
                onChange={(e) => setAutoMockCount(parseInt(e.target.value || '0',10))}
                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-teal-500 focus:border-teal-500"
              />
              <p className="mt-1 text-xs text-gray-400">Run fully automated AI mock simulations and view aggregate results.</p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={!players || (settings.aiProvider === 'gemini' ? !geminiApiKey : !openaiApiKey)}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 focus:ring-offset-gray-800 transition-all transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:scale-100"
          >
            Start Draft
          </button>
          {draftMode === 'mock' && autoMockCount > 0 && (
            <button
              type="button"
              onClick={() => players && onAutoMock && onAutoMock(settings, players, autoMockCount, { gemini: geminiApiKey || undefined, openai: openaiApiKey || undefined })}
              disabled={!players || (settings.aiProvider === 'gemini' ? !geminiApiKey : !openaiApiKey)}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-gray-800 transition-all transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:scale-100"
            >
              Run {autoMockCount} Auto Mock{autoMockCount>1?'s':''}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default SetupScreen;
