import { socket } from '../lib/socket';
import { useGameStore } from '../store/gameStore';
import { playButton } from '../lib/sounds';
import { PublicPlayerHand } from '../types';

function canDoubleHand(hand: PublicPlayerHand, balance: number): boolean {
  return hand.cards.length === 2 && balance >= hand.bet * 2;
}

function canSplitHand(hand: PublicPlayerHand, balance: number, totalHands: number): boolean {
  if (hand.cards.length !== 2) return false;
  if (totalHands >= 4) return false;
  if (balance < hand.bet * (totalHands + 1)) return false;
  const v = (r: string) => ['J','Q','K'].includes(r) ? 10 : r === 'A' ? 11 : parseInt(r, 10);
  return v(hand.cards[0].rank) === v(hand.cards[1].rank);
}

function TurnTimer({ seconds, total = 45, compact = false }: { seconds: number; total?: number; compact?: boolean }) {
  const pct = (seconds / total) * 100;
  const color = seconds > 15 ? '#c9a84c' : seconds > 5 ? '#f59e0b' : '#e63946';
  return (
    <div className="flex items-center gap-2">
      <div className={`h-1 rounded-full bg-white/10 overflow-hidden ${compact ? 'w-28' : 'w-40'}`}>
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={`text-xs font-bold tabular-nums w-6 ${seconds <= 5 ? 'text-red-400 animate-pulse' : 'text-gold'}`}>
        {seconds}s
      </span>
    </div>
  );
}

export function GameControls() {
  const { gameState, roomCode, myId } = useGameStore();

  if (!gameState || !roomCode) return null;
  if (gameState.phase !== 'playing') return null;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  if (!currentPlayer || currentPlayer.id !== myId) {
    return (
      <div className="flex flex-col items-center gap-2 py-3">
        <div className="text-white/50 text-sm">
          Waiting for <span className="text-white font-bold">{currentPlayer?.name ?? '...'}</span>
        </div>
        {gameState.turnTimeLeft <= 15 && (
          <TurnTimer seconds={gameState.turnTimeLeft} compact />
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
      <TurnTimer seconds={gameState.turnTimeLeft} />

      <div className="text-gold text-xs font-bold tracking-widest uppercase">Your Turn</div>

      <div className="grid grid-cols-2 sm:flex gap-2 justify-center w-full max-w-xs sm:max-w-none">
        <button className="btn-hit text-sm py-2.5 font-bold" onClick={() => emit('hit')}>Hit</button>
        <button className="btn-stand text-sm py-2.5 font-bold" onClick={() => emit('stand')}>Stand</button>
        <button className="btn-double text-sm py-2.5 font-bold" onClick={() => emit('doubleDown')}
          disabled={!canDouble} title={!canDouble ? 'Need 2× bet in balance · first 2 cards only' : `Double — $${activeHand.bet * 2}`}>
          Double
        </button>
        <button className="btn-split text-sm py-2.5 font-bold" onClick={() => emit('split')}
          disabled={!canSplit} title={!canSplit ? 'Need matching cards · max 4 hands' : 'Split'}>
          Split
        </button>
      </div>

      <div className="text-xs text-white/35 tabular-nums">
        {currentPlayer.hands.length > 1 && (
          <span>Hand {currentPlayer.activeHandIndex + 1}/{currentPlayer.hands.length} · </span>
        )}
        Score: <span className="text-white/70 font-bold">{activeHand.score}</span>
        {' · '}Bet: <span className="text-gold font-bold">${activeHand.bet.toLocaleString()}</span>
      </div>
    </div>
  );
}
