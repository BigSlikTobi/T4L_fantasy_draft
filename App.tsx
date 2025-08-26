import React, { useState, useCallback, useEffect } from 'react';
import { DraftSettings, Player, Tier, UploadedPlayer, PlayerWithTier, DraftStrategy, DraftMode, DraftLogEntry, TeamRosters } from './types';
import { getDraftStrategy, getDraftRecommendation, getMockDraftPick } from './services/aiService';
import SetupScreen from './components/SetupScreen';
import DraftScreen from './components/DraftScreen';
import Loader from './components/Loader';
import StrategyModal from './components/StrategyModal';

const App: React.FC = () => {
  const [draftSettings, setDraftSettings] = useState<DraftSettings | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [myTeam, setMyTeam] = useState<Player[]>([]);
  const [draftedPlayers, setDraftedPlayers] = useState<Set<string>>(new Set());
  const [blockedPlayers, setBlockedPlayers] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<{ player: Player; explanation: string } | null>(null);
  const [strategy, setStrategy] = useState<DraftStrategy | null>(null);
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState<boolean>(false);
  const [apiKeys, setApiKeys] = useState<{ gemini?: string; openai?: string }>({});

  // --- Mock Draft State ---
  const [draftMode, setDraftMode] = useState<DraftMode | null>(null);
  const [currentPick, setCurrentPick] = useState(1);
  const [draftLog, setDraftLog] = useState<DraftLogEntry[]>([]);
  const [teamRosters, setTeamRosters] = useState<TeamRosters>({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [draftOrder, setDraftOrder] = useState<number[]>([]);
  const [isMyTurn, setIsMyTurn] = useState(false);
  
  const handleDraftStart = (settings: DraftSettings, players: UploadedPlayer[], mode: DraftMode, keys: { gemini?: string; openai?: string }) => {
    setError(null);
    setDraftMode(mode);
    setApiKeys(keys);
    try {
      const tiersMap = players.reduce((acc, player) => {
        const tierNum = player.tier;
        if (!acc[tierNum]) acc[tierNum] = [];
        acc[tierNum].push({
          id: `${player.name}-${player.team}`.replace(/\s+/g, '-'),
          name: player.name, position: player.position, team: player.team,
        });
        return acc;
      }, {} as Record<number, Player[]>);

      const generatedTiers = Object.entries(tiersMap)
        .map(([tier, players]) => ({ tier: parseInt(tier), players }))
        .sort((a, b) => a.tier - b.tier);

      setTiers(generatedTiers);
      setDraftSettings(settings);

      if (mode === 'mock') {
        const order: number[] = [];
        const rounds = 16;
        for (let round = 1; round <= rounds; round++) {
          const isEvenRound = round % 2 === 0;
          const picksInRound = Array.from({ length: settings.leagueSize }, (_, i) => i + 1);
          if (settings.draftFormat === 'Snake' && isEvenRound) {
            picksInRound.reverse();
          }
          order.push(...picksInRound);
        }
        setDraftOrder(order);

        const initialRosters: TeamRosters = {};
        for (let i = 1; i <= settings.leagueSize; i++) initialRosters[i] = [];
        setTeamRosters(initialRosters);

        setCurrentPick(1);
        setDraftLog([]);
        setMyTeam([]);
        setIsMyTurn(settings.pickPosition === 1);
      }
    } catch (err) {
      setError('Failed to process player list. Please check the file format.');
      console.error(err);
    }
  };

  const handlePlayerAction = useCallback((player: Player, action: 'add' | 'remove' | 'block') => {
    if (draftMode === 'mock') {
        if (action === 'add' && isMyTurn) {
            // User makes their pick in the mock draft
            if (!draftSettings) return;
            
            const newMyTeam = [...myTeam, player];
            setMyTeam(newMyTeam);
            
            const newRosters = { ...teamRosters, [draftSettings.pickPosition]: newMyTeam };
            setTeamRosters(newRosters);
            
            setTiers(prevTiers => prevTiers.map(tier => ({...tier, players: tier.players.filter(p => p.id !== player.id)})).filter(t => t.players.length > 0));

            const round = Math.floor((currentPick - 1) / draftSettings.leagueSize) + 1;
            const pickInRound = ((currentPick - 1) % draftSettings.leagueSize) + 1;
            setDraftLog(prev => [...prev, { pick: currentPick, round, pickInRound, team: draftSettings.pickPosition, player }]);
            
            setDraftedPlayers(prev => new Set(prev).add(player.name));
            setRecommendation(null);
            setIsMyTurn(false);
            setCurrentPick(p => p + 1); // This triggers the useEffect for the next simulation
        } else if (action === 'block') {
            setBlockedPlayers(prev => new Set(prev).add(player.name));
            setTiers(prevTiers => prevTiers.map(tier => ({...tier, players: tier.players.filter(p => p.id !== player.id)})));
        }
    } else { // Assistant Mode
        setTiers(prevTiers => prevTiers.map(tier => ({...tier, players: tier.players.filter(p => p.id !== player.id)})));
        if (action === 'add') setMyTeam(prevTeam => [...prevTeam, player]);
        if (action === 'block') setBlockedPlayers(prev => new Set(prev).add(player.name));
        setDraftedPlayers(prev => new Set(prev).add(player.name));
        setRecommendation(null);
    }
  }, [draftMode, isMyTurn, draftSettings, currentPick, myTeam, teamRosters]);

  const handleGetStrategy = async (userFeedback?: string) => {
    if (!draftSettings) return;
    setIsLoading(true);
    setLoadingMessage(userFeedback ? 'Getting a new strategy...' : 'Analyzing the board for a strategy...');
    setError(null);
    setStrategy(null);
    setRecommendation(null);

    try {
      const availablePlayersWithTiers: PlayerWithTier[] = tiers.flatMap(tier =>
        tier.players.map(player => ({ ...player, tier: tier.tier }))
      );
      const bestAvailable = availablePlayersWithTiers.slice(0, 50);

      const result = await getDraftStrategy(draftSettings, myTeam, bestAvailable, Array.from(blockedPlayers), apiKeys, userFeedback);
      setStrategy(result);
      setIsStrategyModalOpen(true);
    } catch (err) {
      setError('Could not get a strategy. The AI is strategizing about its own existence.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

 const handleStrategyConfirmed = async () => {
    if (!draftSettings || !strategy) return;
    setIsStrategyModalOpen(false);
    setIsLoading(true);
    setLoadingMessage(`Finding the best player for the "${strategy.strategyName}" strategy...`);
    setError(null);

    try {
      const availablePlayers = tiers.flatMap(tier => tier.players);
      const availablePlayersWithTiers: PlayerWithTier[] = tiers.flatMap(tier =>
        tier.players.map(player => ({ ...player, tier: tier.tier }))
      );
      const bestAvailable = availablePlayersWithTiers.slice(0, 30);

      const result = await getDraftRecommendation(draftSettings, myTeam, bestAvailable, Array.from(blockedPlayers), strategy, apiKeys);
      const recommendedPlayer = availablePlayers.find(p => p.name === result.playerName);

      if (recommendedPlayer) {
        setRecommendation({ player: recommendedPlayer, explanation: result.explanation });
      } else {
        setError("AI recommended a player not found on the board. Perhaps a ghost pick?");
      }
    } catch (err) {
      setError('Could not get a recommendation. The AI is contemplating the meaning of fantasy football.');
      console.error(err);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
      setStrategy(null);
    }
  };

  const handleCloseStrategyModal = () => setIsStrategyModalOpen(false);

  const handleReset = () => {
    setDraftSettings(null); setTiers([]); setMyTeam([]);
    setDraftedPlayers(new Set()); setBlockedPlayers(new Set());
    setError(null); setRecommendation(null); setStrategy(null);
    setIsStrategyModalOpen(false); setDraftMode(null);
    setCurrentPick(1); setDraftLog([]); setTeamRosters({});
    setDraftOrder([]); setIsSimulating(false); setIsMyTurn(false);
  };
  
  // --- Mock Draft Simulation Effect ---
  useEffect(() => {
    // This effect runs when it's the AI's turn to make picks.
    if (draftMode !== 'mock' || !draftSettings || isMyTurn || isSimulating || currentPick > draftOrder.length) {
      return;
    }

    const simulateOpponentPicks = async () => {
      setIsSimulating(true);
      setIsLoading(true);
      
      // We will mutate copies of state and update React state once at the end.
      let tempCurrentPick = currentPick;
      let tempTiers = tiers;
      let tempTeamRosters = teamRosters;
      const newLogEntries: DraftLogEntry[] = [];
      const newDraftedPlayerNames = new Set<string>();

      try {
        setLoadingMessage(draftSettings.fastMode ? `Fast simulating opponent picks...` : `Simulating opponent picks...`);
        // Loop until it's the user's turn or the draft is over
        while (draftOrder[tempCurrentPick - 1] !== draftSettings.pickPosition && tempCurrentPick <= draftOrder.length) {
          const teamToPick = draftOrder[tempCurrentPick - 1];
          // Provide a more dynamic loading message (less frequent in fast mode)
          if (!draftSettings.fastMode || tempCurrentPick % 3 === 0) {
            setLoadingMessage(`Simulating pick #${tempCurrentPick} (Team ${teamToPick})...`);
          }
          
          const availablePlayersWithTiers = tempTiers.flatMap(t => t.players.map(p => ({ ...p, tier: t.tier })));
          
          if (availablePlayersWithTiers.length === 0) {
            console.warn("No available players left to pick.");
            break; // Exit loop if no players are left
          }

          const result = await getMockDraftPick(draftSettings, tempTeamRosters, teamToPick, availablePlayersWithTiers.slice(0, 15), Array.from(blockedPlayers), apiKeys);
          const pickedPlayer = availablePlayersWithTiers.find(p => p.name === result.playerName);
          
          if (pickedPlayer) {
              // Update temporary variables
              tempTeamRosters = {
                  ...tempTeamRosters,
                  [teamToPick]: [...(tempTeamRosters[teamToPick] || []), pickedPlayer]
              };
              tempTiers = tempTiers.map(t => ({...t, players: t.players.filter(p => p.id !== pickedPlayer.id)})).filter(t => t.players.length > 0);
              
              const round = Math.floor((tempCurrentPick - 1) / draftSettings.leagueSize) + 1;
              const pickInRound = ((tempCurrentPick - 1) % draftSettings.leagueSize) + 1;
              newLogEntries.push({ pick: tempCurrentPick, round, pickInRound, team: teamToPick, player: pickedPlayer });
              newDraftedPlayerNames.add(pickedPlayer.name);
              
              tempCurrentPick++;
          } else {
             // Graceful failure: if AI fails, pick the top available player
             console.error(`AI picked invalid player: ${result.playerName}. Picking best available.`);
             const fallbackPlayer = availablePlayersWithTiers[0];
             if(fallbackPlayer) {
                 tempTeamRosters = {
                     ...tempTeamRosters,
                     [teamToPick]: [...(tempTeamRosters[teamToPick] || []), fallbackPlayer]
                 };
                 tempTiers = tempTiers.map(t => ({...t, players: t.players.filter(p => p.id !== fallbackPlayer.id)})).filter(t => t.players.length > 0);
                 const round = Math.floor((tempCurrentPick - 1) / draftSettings.leagueSize) + 1;
                 const pickInRound = ((tempCurrentPick - 1) % draftSettings.leagueSize) + 1;
                 newLogEntries.push({ pick: tempCurrentPick, round, pickInRound, team: teamToPick, player: fallbackPlayer });
                 newDraftedPlayerNames.add(fallbackPlayer.name);
                 tempCurrentPick++;
             } else {
               throw new Error('AI failed and no fallback players available.');
             }
          }
        }

        // Batch update React state once all picks are simulated
        if (newLogEntries.length > 0) {
            setDraftLog(log => [...log, ...newLogEntries]);
            setTeamRosters(tempTeamRosters);
            setTiers(tempTiers);
            setDraftedPlayers(prev => new Set([...prev, ...newDraftedPlayerNames]));
            setCurrentPick(tempCurrentPick);
        }

        // Check if the draft continues and if it's now the user's turn
        if (tempCurrentPick <= draftOrder.length && draftOrder[tempCurrentPick - 1] === draftSettings.pickPosition) {
            setIsMyTurn(true);
        }

      } catch (err) {
        console.error(err);
        setError(`An error occurred during AI simulation. Please check the console.`);
      } finally {
        setIsSimulating(false);
        setIsLoading(false);
        setLoadingMessage('');
      }
    };
    
    simulateOpponentPicks();
  }, [draftMode, currentPick, draftSettings, draftOrder, isSimulating, isMyTurn, blockedPlayers, teamRosters, tiers]);


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
          AI Fantasy Draft Helper
        </h1>
        <p className="text-gray-400 mt-2">Your unfair advantage, powered by Gemini.</p>
      </header>
      
      {isLoading && <Loader message={loadingMessage} />}

      <main className="max-w-7xl mx-auto">
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6 text-center" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {!draftSettings ? (
          <SetupScreen onStart={handleDraftStart} />
        ) : (
          <>
            <DraftScreen
              tiers={tiers}
              myTeam={myTeam}
              draftedCount={draftedPlayers.size}
              blockedPlayers={blockedPlayers}
              onPlayerAction={handlePlayerAction}
              onGetRecommendation={handleGetStrategy}
              recommendation={recommendation}
              onClearRecommendation={() => setRecommendation(null)}
              onReset={handleReset}
              // Mock Draft Props
              draftMode={draftMode!}
              draftLog={draftLog}
              currentPick={currentPick}
              leagueSize={draftSettings.leagueSize}
              isMyTurn={isMyTurn}
              isSimulating={isSimulating}
            />
            {isStrategyModalOpen && strategy && (
              <StrategyModal 
                strategy={strategy}
                onConfirm={handleStrategyConfirmed}
                onRequestNew={handleGetStrategy}
                onClose={handleCloseStrategyModal}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;