import { socket } from '../lib/socket';
import { useGameStore } from '../store/gameStore';
import { playButton } from '../lib/sounds';
import { PublicPlayerHand } from '../types';

function canDoubleHand(hand: PublicPlayerHand, balance: number): boolean {
  // balance isn't deducted during play, so need 2x bet available in total balance
  return hand.cards.length === 2 && balance >= hand.bet * 2;
}

function canSplitHand(hand: PublicPlayerHand, balance: number, totalHands: number): boolean {
  if (hand.cards.length !== 2) return false;
  if (totalHands >= 4) return false;
  if (balance < hand.bet) return false;
  const v = (r: string) => ['J','Q','K'].includes(r) ? 10 : r === 'A' ? 11 : parseInt(r, 10);
  return v(hand.cards[0].rank) === v(hand.cards[1].rank);
}

export function GameControls() {
  const { gameState, roomCode, myId } = useGameStore();

  if (!gameState || !roomCode) return null;
  if (gameState.phase !== 'playing') return null;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.id !== myId) {
    // Show whose turn it is
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="text-white/50 text-sm animate-pulse">
          Waiting for <span className="text-white font-bold">{currentPlayer?.name ?? '...'}</span>
        </div>
        {/* Turn timer */}
        {gameState.turnTimeLeft <= 15 && (
          <div className="flex items-center gap-2">
            <div className="h-1 w-32 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${(gameState.turnTimeLeft / 45) * 100}%`,
                  background: gameState.turnTimeLeft > 10 ? '#c9a84c' : '#e63946',
                }}
              />
            </div>
            <span className={`text-xs tabular-nums ${gameState.turnTimeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-gold'}`}>
              {gameState.turnTimeLeft}s
            </span>
          </div>
        )}
      </div>
    );
  }

  const activeHand = currentPlayer.hands[currentPlayer.activeHandIndex];
  if (!activeHand || activeHand.status !== 'active') return null;

  const emit = (event: string) => { playButton(); socket.emit(event, roomCode); };

  const canDouble = canDoubleHand(activeHand, currentPlayer.balance);
  const canSplit = canSplitHand(activeHand, currentPlayer.balance, currentPlayer.hands.length);

  return (
    <div className="animate-slideUp flex flex-col items-center gap-3">
      {/* Turn timer */}
      <div className="flex items-center gap-2">
        <div className="h-1 w-40 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${(gameState.turnTimeLeft / 45) * 100}%`,
              background: gameState.turnTimeLeft > 15 ? '#c9a84c' : gameState.turnTimeLeft > 5 ? '#f59e0b' : '#e63946',
            }}
          />
        </div>
        <span className={`text-xs font-bold tabular-nums ${gameState.turnTimeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-gold'}`}>
          {gameState.turnTimeLeft}s
        </span>
      </div>

      {/* Your turn label */}
      <div className="text-gold text-sm font-bold tracking-wide animate-pulse">Your Turn</div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 sm:flex gap-2 justify-center w-full max-w-xs sm:max-w-none">
        <button className="btn-hit text-sm py-2.5" onClick={() => emit('hit')}>Hit</button>
        <button className="btn-stand text-sm py-2.5" onClick={() => emit('stand')}>Stand</button>
        <button className="btn-double text-sm py-2.5" onClick={() => emit('doubleDown')}
          disabled={!canDouble} title={!canDouble ? 'Need 2x bet in balance, first 2 cards only' : ''}>
          Double
        </button>
        <button className="btn-split text-sm py-2.5" onClick={() => emit('split')}
          disabled={!canSplit} title={!canSplit ? 'Matching cards, max 4 hands' : ''}>
          Split
        </button>
      </div>

      {/* Hand info */}
      <div className="text-xs text-white/40">
        Hand {currentPlayer.activeHandIndex + 1} of {currentPlayer.hands.length} •{' '}
        Score: <span className="text-white/70">{activeHand.score}</span> •{' '}
        Bet: <span className="text-gold">${activeHand.bet}</span>
      </div>
    </div>
  );
}
