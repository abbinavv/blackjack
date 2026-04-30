import { useGameStore } from '../store/gameStore';
import { DealerArea } from './DealerArea';
import { PlayerSeat } from './PlayerSeat';
import { BetPanel } from './BetPanel';
import { InsurancePanel } from './InsurancePanel';
import { GameControls } from './GameControls';
import { RoundSummary } from './RoundSummary';

export function Table() {
  const { gameState, roomCode, myId } = useGameStore();
  if (!gameState || !roomCode) return null;

  const me = gameState.players.find(p => p.id === myId);
  const activePlayers = gameState.players.filter(p => !p.isSittingOut);

  // Grid columns based on player count
  const colClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }[Math.min(gameState.players.length, 6)] ?? 'grid-cols-3';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0f14' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8"
           style={{ background: 'rgba(0,0,0,0.6)' }}>
        <div className="flex items-center gap-3">
          <span className="text-gold font-display font-bold text-lg">♠ Blackjack</span>
          <span className="text-white/20">|</span>
          <span className="text-xs text-white/40">Room:</span>
          <span className="font-mono font-bold text-gold tracking-widest text-sm">{roomCode}</span>
        </div>
        <div className="flex items-center gap-3">
          {gameState.needsReshuffle && (
            <span className="text-xs text-yellow-400 animate-pulse">⟳ Reshuffling next round</span>
          )}
          {me && (
            <span className="text-xs">
              <span className="text-white/40">Balance: </span>
              <span className="text-green-400 font-bold">${me.balance.toLocaleString()}</span>
            </span>
          )}
          <span className="text-xs text-white/30">Round {gameState.round}</span>
        </div>
      </div>

      {/* Main felt area */}
      <div className="flex-1 flex flex-col felt-table mx-3 my-3 rounded-2xl overflow-hidden">

        {/* Message bar */}
        <div className="text-center py-2 text-xs tracking-widest text-white/40 uppercase border-b border-white/5">
          {gameState.message}
        </div>

        {/* Dealer zone */}
        <div className="flex-1 flex flex-col items-center justify-center py-6 px-4 gap-6 min-h-0">
          <DealerArea gameState={gameState} />

          {/* Center divider */}
          <div className="flex items-center gap-3 w-full max-w-lg opacity-30">
            <div className="flex-1 h-px bg-white/20" />
            <div className="w-2 h-2 rounded-full bg-white/40" />
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* Player row */}
          <div className={`grid ${colClass} gap-3 w-full max-w-4xl place-items-center`}>
            {gameState.players.map((player, i) => (
              <PlayerSeat
                key={player.id}
                player={player}
                playerIndex={i}
                gameState={gameState}
                isMe={player.id === myId}
              />
            ))}
          </div>
        </div>

        {/* Bottom controls zone */}
        <div className="border-t border-white/8 p-4 flex justify-center">
          {gameState.phase === 'betting' && <BetPanel />}
          {gameState.phase === 'insurance' && <InsurancePanel />}
          {(gameState.phase === 'playing') && <GameControls />}
          {gameState.phase === 'dealer' && (
            <div className="text-white/40 text-sm animate-pulse py-3">Dealer is playing...</div>
          )}
          {gameState.phase === 'dealing' && (
            <div className="text-white/40 text-sm animate-pulse py-3">Dealing cards...</div>
          )}
        </div>
      </div>

      {/* Round summary overlay */}
      <RoundSummary />
    </div>
  );
}
