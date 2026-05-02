import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { PublicGameState } from '../types';
import { DealerArea } from './DealerArea';
import { PlayerSeat } from './PlayerSeat';
import { BetPanel } from './BetPanel';
import { InsurancePanel } from './InsurancePanel';
import { GameControls } from './GameControls';
import { RoundSummary } from './RoundSummary';
import { playShuffle } from '../lib/sounds';

export function Table() {
  const { gameState: rawState, roomCode, myId } = useGameStore();
  if (!rawState || !roomCode) return null;
  const gameState = rawState as PublicGameState;

  const prevReshuffle = useRef(false);
  useEffect(() => {
    if (gameState.needsReshuffle && !prevReshuffle.current) playShuffle();
    prevReshuffle.current = !!gameState.needsReshuffle;
  }, [gameState.needsReshuffle]);

  const me = gameState.players.find(p => p.id === myId);
  const myIndex = gameState.players.findIndex(p => p.id === myId);
  const others = gameState.players.filter(p => p.id !== myId);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0a0f14' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 flex-shrink-0"
           style={{ background: 'rgba(0,0,0,0.6)' }}>
        <div className="flex items-center gap-2">
          <span className="text-gold font-display font-bold text-base">♠ Blackjack</span>
          <span className="text-white/20 hidden sm:block">|</span>
          <span className="text-xs text-white/40 hidden sm:block">Room:</span>
          <span className="font-mono font-bold text-gold tracking-widest text-sm">{roomCode}</span>
        </div>
        <div className="flex items-center gap-2">
          {gameState.needsReshuffle && (
            <span className="text-xs text-yellow-400 hidden sm:block">⟳ Reshuffling</span>
          )}
          {me && (
            <span className="text-xs">
              <span className="text-white/40">$</span>
              <span className="text-green-400 font-bold">{me.balance.toLocaleString()}</span>
            </span>
          )}
          <span className="text-xs text-white/30">R{gameState.round}</span>
        </div>
      </div>

      {/* Felt table */}
      <div className="flex-1 flex flex-col felt-table mx-2 my-2 rounded-2xl overflow-hidden min-h-0">

        {/* Message */}
        <div className="text-center py-1.5 text-xs tracking-widest text-white/40 uppercase border-b border-white/5 flex-shrink-0">
          {gameState.message}
        </div>

        {/* Other players — compact pill row at top */}
        {others.length > 0 && (
          <div className="flex-shrink-0 border-b border-white/5 px-2 py-1.5">
            <div className="flex gap-2 justify-center flex-wrap">
              {gameState.players.map((player, i) => {
                if (player.id === myId) return null;
                return (
                  <PlayerSeat
                    key={player.id}
                    player={player}
                    playerIndex={i}
                    gameState={gameState}
                    isMe={false}
                    hideCards={true}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Dealer zone */}
        <div className="flex-1 flex flex-col items-center justify-center py-3 px-2 min-h-0">
          <DealerArea gameState={gameState} />

          {/* Divider */}
          <div className="flex items-center gap-2 w-full max-w-sm opacity-20 my-3">
            <div className="flex-1 h-px bg-white/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
            <div className="flex-1 h-px bg-white/30" />
          </div>

          {/* My seat — prominent, centered, full cards */}
          {me && myIndex !== -1 && (
            <div className="flex justify-center">
              <PlayerSeat
                key={me.id}
                player={me}
                playerIndex={myIndex}
                gameState={gameState}
                isMe={true}
                hideCards={false}
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="border-t border-white/8 px-3 py-3 flex-shrink-0 flex justify-center">
          {gameState.phase === 'betting' && <BetPanel />}
          {gameState.phase === 'insurance' && <InsurancePanel />}
          {gameState.phase === 'playing' && <GameControls />}
          {gameState.phase === 'dealer' && (
            <div className="text-white/40 text-sm animate-pulse py-2">Dealer is playing...</div>
          )}
          {gameState.phase === 'dealing' && (
            <div className="text-white/40 text-sm animate-pulse py-2">Dealing cards...</div>
          )}
        </div>
      </div>

      <RoundSummary />
    </div>
  );
}
