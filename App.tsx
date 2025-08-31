import React, { useState, useCallback, useEffect } from 'react';
import { DraftSettings, Player, Tier, UploadedPlayer, PlayerWithTier, DraftStrategy, DraftMode, DraftLogEntry, TeamRosters, AutoMockDraftResult } from './types';
import { getDraftStrategy, getDraftRecommendation, getMockDraftPick } from './services/aiService';
import { getFastMockDraftPick } from './services/fastMockService';
import SetupScreen from './components/SetupScreen';
import DraftScreen from './components/DraftScreen';
import Loader from './components/Loader';
import StrategyModal from './components/StrategyModal';
import AutoMockResults from './components/AutoMockResults';

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
  // Memory
  const [strategyHistory, setStrategyHistory] = useState<DraftStrategy[]>([]);
  const [recommendationHistory, setRecommendationHistory] = useState<{ playerName: string; explanation: string }[]>([]);
  const [autoMockResults, setAutoMockResults] = useState<AutoMockDraftResult[] | null>(null);
  const [isRunningAutoMocks, setIsRunningAutoMocks] = useState(false);
  const [autoMockProgress, setAutoMockProgress] = useState<{ completed: number; total: number; estCostUSD?: number; estTokens?: number }>({ completed: 0, total: 0 });
  const [autoMockActive, setAutoMockActive] = useState(false); // ensures we stay in auto-mock flow

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
    setAutoMockResults(null);
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

      const result = await getDraftStrategy(
        draftSettings,
        myTeam,
        bestAvailable,
        Array.from(blockedPlayers),
        apiKeys,
        userFeedback,
        { strategies: strategyHistory, recommendations: recommendationHistory }
      );
      setStrategy(result);
      setIsStrategyModalOpen(true);
      setStrategyHistory(prev => [...prev, result]);
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

      const result = await getDraftRecommendation(
        draftSettings,
        myTeam,
        bestAvailable,
        Array.from(blockedPlayers),
        strategy,
        apiKeys,
        { strategies: strategyHistory, recommendations: recommendationHistory }
      );
      const recommendedPlayer = availablePlayers.find(p => p.name === result.playerName);

      if (recommendedPlayer) {
        setRecommendation({ player: recommendedPlayer, explanation: result.explanation });
        setRecommendationHistory(prev => [...prev, { playerName: result.playerName, explanation: result.explanation }]);
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
  setStrategyHistory([]); setRecommendationHistory([]);
    setAutoMockResults(null); setIsRunningAutoMocks(false);
  };

  // Auto mock using real AI service for each pick of user's team only (others use fast simulation to reduce cost/time)
  const handleAutoMock = async (settings: DraftSettings, players: UploadedPlayer[], count: number, keys: { gemini?: string; openai?: string }) => {
    setIsRunningAutoMocks(true);
    setAutoMockResults(null);
  setAutoMockActive(true);
    setError(null);
    try {
  // Persist keys so downstream calls have them if user later starts an interactive draft
  setApiKeys(keys);
      // --- Cost Estimation (OpenAI only) ---
      // Provided pricing per 1,000,000 tokens:
      // gpt-5: input $1.25 | output $10.00
      // gpt-5-mini: input $0.25 | output $2.00
      // gpt-5-nano: input $0.05 | output $0.40
      // We CURRENTLY use gpt-5-nano for mock picks (see openaiService), so map cost accordingly.
      const modelForMocks = 'gpt-5-nano';
      const pricing: Record<string, { in: number; out: number }> = {
        'gpt-5': { in: 1.25, out: 10.0 },
        'gpt-5-mini': { in: 0.25, out: 2.0 },
        'gpt-5-nano': { in: 0.05, out: 0.40 }
      };
      // Assumptions (can be refined): ~140 prompt tokens + 25 output tokens per pick average.
      const perCallInput = 140;
      const perCallOutput = 25;
      const picksPerSimulation = 16 * settings.leagueSize; // 16 rounds * teams
      const totalCalls = picksPerSimulation * count; // AI call per pick (all teams)
      const estInputTokens = perCallInput * totalCalls;
      const estOutputTokens = perCallOutput * totalCalls;
      const estTotalTokens = estInputTokens + estOutputTokens;
      let estCost: number | undefined;
      if (settings.aiProvider === 'openai') {
        const price = pricing[modelForMocks];
        if (price) {
          estCost = (estInputTokens / 1_000_000) * price.in + (estOutputTokens / 1_000_000) * price.out;
        }
      }
      setAutoMockProgress({ completed: 0, total: count, estCostUSD: estCost ? parseFloat(estCost.toFixed(2)) : undefined, estTokens: Math.round(estTotalTokens) });
      const tiersMap = players.reduce((acc, player) => {
        const tierNum = player.tier;
        if (!acc[tierNum]) acc[tierNum] = [];
        acc[tierNum].push({ id: `${player.name}-${player.team}`.replace(/\s+/g,'-'), name: player.name, position: player.position, team: player.team });
        return acc;
      }, {} as Record<number, Player[]>);
      const baseTiers: Tier[] = Object.entries(tiersMap).map(([tier, pls]) => ({ tier: parseInt(tier), players: pls })).sort((a,b)=> a.tier-b.tier);

      // Concurrency limit for simulations
  const concurrency = Math.min(2, count); // keep low to manage API rate / cost
  const indices = Array.from({ length: count }, (_, i) => i + 1);
  const results: AutoMockDraftResult[] = new Array(count);

  const runSimulation = async (sim: number): Promise<void> => {
        let availableTiers: Tier[] = JSON.parse(JSON.stringify(baseTiers));
        const rosters: TeamRosters = {};
        for (let t=1; t<=settings.leagueSize; t++) rosters[t] = [];
        const pickLog: AutoMockDraftResult['pickLog'] = [];
        const buildDraftOrder: number[] = [];
        for (let round=1; round<=16; round++) {
          const isEven = round % 2 === 0;
            const picksInRound = Array.from({length: settings.leagueSize}, (_,i)=> i+1);
            if (settings.draftFormat === 'Snake' && isEven) picksInRound.reverse();
            buildDraftOrder.push(...picksInRound);
        }
        const totalPicks = buildDraftOrder.length;
        for (let currentPickNum=1; currentPickNum<= totalPicks; currentPickNum++) {
          const pickingTeam = buildDraftOrder[currentPickNum-1];
          const availablePlayersWithTiers: PlayerWithTier[] = availableTiers.flatMap(t=> t.players.map(p=> ({...p, tier: t.tier})));
          if (availablePlayersWithTiers.length === 0) break;
          // Use AI for every team pick (using provided keys). Fallback to first player if error.
          let aiResult: { playerName: string; explanation: string } | null = null;
          try {
            aiResult = await getMockDraftPick(settings, rosters, pickingTeam, availablePlayersWithTiers.slice(0,25), [], keys);
          } catch (err) {
            console.error(`Simulation ${sim} pick ${currentPickNum} AI error, falling back`, err);
            aiResult = { playerName: availablePlayersWithTiers[0].name, explanation: 'Fallback best available due to AI error' };
          }
          const chosen = availablePlayersWithTiers.find(p => p.name === aiResult.playerName) || availablePlayersWithTiers[0];
          rosters[pickingTeam].push(chosen);
          availableTiers = availableTiers.map(t=> ({...t, players: t.players.filter(p=> p.id !== chosen.id)})).filter(t=> t.players.length>0);
          if (pickingTeam === settings.pickPosition) {
            const round = Math.floor((currentPickNum -1)/settings.leagueSize)+1;
            const pickInRound = ((currentPickNum -1)%settings.leagueSize)+1;
            pickLog.push({ pick: currentPickNum, round, pickInRound, player: chosen, explanation: aiResult.explanation });
          }
          // slight delay to smooth rate (esp. openai)
          await new Promise(r => setTimeout(r, 40));
        }
        results[sim-1] = { simulation: sim, roster: rosters[settings.pickPosition], pickLog };
      };
      // Simple promise pool
      const queue = [...indices];
      const workers: Promise<void>[] = [];
      const startNext = async (): Promise<void> => {
        const next = queue.shift();
        if (next === undefined) return;
        await runSimulation(next);
  setAutoMockProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
        await startNext();
      };
      for (let i=0; i<concurrency; i++) workers.push(startNext());
      await Promise.all(workers);
  // Ensure deep copy so React detects change fully
  setAutoMockResults(results.map(r => ({ ...r, roster: [...r.roster], pickLog: [...r.pickLog] })));
  console.info('Auto mock simulations complete:', { simulations: count, results });
    } catch (err) {
      console.error(err);
      setError('Auto mock simulation failed.');
    } finally {
      setIsRunningAutoMocks(false);
  // Keep autoMockActive true so results pane shows; user resets to exit.
    }
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
        
        // In fast mode, we'll add picks one by one with small delays for visual effect
        if (draftSettings.fastMode) {
          while (draftOrder[tempCurrentPick - 1] !== draftSettings.pickPosition && tempCurrentPick <= draftOrder.length) {
            const teamToPick = draftOrder[tempCurrentPick - 1];
            
            if (tempCurrentPick % 3 === 0) {
              setLoadingMessage(`Fast picking #${tempCurrentPick} (Team ${teamToPick})...`);
            }
            
            const availablePlayersWithTiers = tempTiers.flatMap(t => t.players.map(p => ({ ...p, tier: t.tier })));
            
            if (availablePlayersWithTiers.length === 0) {
              console.warn("No available players left to pick.");
              break;
            }

            const result = await getMockDraftPick(draftSettings, tempTeamRosters, teamToPick, availablePlayersWithTiers.slice(0, 15), Array.from(blockedPlayers), apiKeys);
            const pickedPlayer = availablePlayersWithTiers.find(p => p.name === result.playerName);
            
            if (pickedPlayer) {
                tempTeamRosters = {
                    ...tempTeamRosters,
                    [teamToPick]: [...(tempTeamRosters[teamToPick] || []), pickedPlayer]
                };
                tempTiers = tempTiers.map(t => ({...t, players: t.players.filter(p => p.id !== pickedPlayer.id)})).filter(t => t.players.length > 0);
                
                const round = Math.floor((tempCurrentPick - 1) / draftSettings.leagueSize) + 1;
                const pickInRound = ((tempCurrentPick - 1) % draftSettings.leagueSize) + 1;
                const newEntry = { pick: tempCurrentPick, round, pickInRound, team: teamToPick, player: pickedPlayer };
                
                // Add pick immediately for animation
                setDraftLog(log => [...log, newEntry]);
                setTeamRosters(tempTeamRosters);
                setTiers(tempTiers);
                setDraftedPlayers(prev => new Set([...prev, pickedPlayer.name]));
                setCurrentPick(tempCurrentPick + 1);
                
                tempCurrentPick++;
                
                // Small delay for visual effect
                await new Promise(resolve => setTimeout(resolve, 150));
            } else {
               console.error(`Fast mode picked invalid player: ${result.playerName}`);
               const fallbackPlayer = availablePlayersWithTiers[0];
               if(fallbackPlayer) {
                   tempTeamRosters = {
                       ...tempTeamRosters,
                       [teamToPick]: [...(tempTeamRosters[teamToPick] || []), fallbackPlayer]
                   };
                   tempTiers = tempTiers.map(t => ({...t, players: t.players.filter(p => p.id !== fallbackPlayer.id)})).filter(t => t.players.length > 0);
                   
                   const round = Math.floor((tempCurrentPick - 1) / draftSettings.leagueSize) + 1;
                   const pickInRound = ((tempCurrentPick - 1) % draftSettings.leagueSize) + 1;
                   const newEntry = { pick: tempCurrentPick, round, pickInRound, team: teamToPick, player: fallbackPlayer };
                   
                   setDraftLog(log => [...log, newEntry]);
                   setTeamRosters(tempTeamRosters);
                   setTiers(tempTiers);
                   setDraftedPlayers(prev => new Set([...prev, fallbackPlayer.name]));
                   setCurrentPick(tempCurrentPick + 1);
                   
                   tempCurrentPick++;
                   await new Promise(resolve => setTimeout(resolve, 150));
               } else {
                 throw new Error('Fast mode failed and no fallback players available.');
               }
            }
          }
          
          // Check if it's now the user's turn
          if (tempCurrentPick <= draftOrder.length && draftOrder[tempCurrentPick - 1] === draftSettings.pickPosition) {
              setIsMyTurn(true);
          }
        } else {
          // Original batch processing for regular mode
          while (draftOrder[tempCurrentPick - 1] !== draftSettings.pickPosition && tempCurrentPick <= draftOrder.length) {
            const teamToPick = draftOrder[tempCurrentPick - 1];
            setLoadingMessage(`Simulating pick #${tempCurrentPick} (Team ${teamToPick})...`);
            
            const availablePlayersWithTiers = tempTiers.flatMap(t => t.players.map(p => ({ ...p, tier: t.tier })));
            
            if (availablePlayersWithTiers.length === 0) {
              console.warn("No available players left to pick.");
              break;
            }

            const result = await getMockDraftPick(draftSettings, tempTeamRosters, teamToPick, availablePlayersWithTiers.slice(0, 15), Array.from(blockedPlayers), apiKeys);
            const pickedPlayer = availablePlayersWithTiers.find(p => p.name === result.playerName);
            
            if (pickedPlayer) {
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

          // Batch update React state once all picks are simulated (regular mode)
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
      
      {isLoading && <Loader message={loadingMessage} fastMode={draftSettings?.fastMode} />}

      <main className="max-w-7xl mx-auto">
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6 text-center" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {autoMockResults ? (
          <AutoMockResults results={autoMockResults} onBack={handleReset} />
        ) : autoMockActive && !autoMockResults ? (
          <div className="relative">
            <SetupScreen onStart={handleDraftStart} onAutoMock={handleAutoMock} />
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-full max-w-md shadow-xl">
                <h3 className="text-xl font-semibold text-teal-300 mb-2">Running Auto Mocks</h3>
                <p className="text-sm text-gray-400 mb-4">Full AI simulation (all teams, all picks).</p>
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>{autoMockProgress.completed} / {autoMockProgress.total}</span>
                  </div>
                  <div className="h-3 bg-gray-700 rounded overflow-hidden">
                    <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${(autoMockProgress.completed/Math.max(1,autoMockProgress.total))*100}%` }} />
                  </div>
                </div>
                {autoMockProgress.estTokens && (
                  <div className="text-xs text-gray-400 space-y-1 mb-4">
                    <div>Est. Tokens: <span className="text-gray-300 font-mono">{autoMockProgress.estTokens.toLocaleString()}</span></div>
                    {autoMockProgress.estCostUSD !== undefined && (
                      <div>Est. Cost (OpenAI): <span className="text-gray-300 font-mono">${autoMockProgress.estCostUSD}</span></div>
                    )}
                    <div className="italic">Estimate only. Final cost depends on real token usage.</div>
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <button onClick={handleReset} className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs text-gray-200">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        ) : !draftSettings ? (
          <SetupScreen onStart={handleDraftStart} onAutoMock={handleAutoMock} />
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
              draftSettings={draftSettings}
                strategyHistory={strategyHistory}
                recommendationHistory={recommendationHistory}
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