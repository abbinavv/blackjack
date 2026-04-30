import { PublicPlayer, PublicGameState } from '../types';
import { Hand } from './Hand';

interface Props {
  player: PublicPlayer;
  playerIndex: number;
  gameState: PublicGameState;
  isMe: boolean;
}

export function PlayerSeat({ player, playerIndex, gameState, isMe }: Props) {
  const isCurrentTurn =
    gameState.phase === 'playing' &&
    gameState.currentPlayerIndex === playerIndex;

  const statusColors: Record<string, string> = {
    active: 'text-white',
    standing: 'text-blue-300',
    bust: 'text-red-400',
    blackjack: 'text-yellow-300',
  };

  // Overall player status for display
  const overallStatus = (() => {
    if (player.isSittingOut) return 'sitting-out';
    if (!player.hasBet && (gameState.phase === 'playing' || gameState.phase === 'dealer' || gameState.phase === 'complete')) return null;
    if (player.hands.length === 0) return null;
    if (player.hands.every(h => h.status === 'bust')) return 'bust';
    if (player.hands.some(h => h.status === 'blackjack')) return 'blackjack';
    if (player.hands.every(h => h.status === 'standing' || h.status === 'bust')) return 'standing';
    return 'active';
  })();

  return (
    <div
      className={`player-seat flex flex-col items-center gap-2
        ${isCurrentTurn ? 'active-player' : ''}
        ${isMe ? 'my-seat' : ''}
      `}
    >
      {/* Name + host badge */}
      <div className="flex items-center gap-1.5">
        {player.isHost && (
          <span className="text-gold text-xs">★</span>
        )}
        <span className={`text-sm font-bold truncate max-w-[90px] ${isMe ? 'text-gold' : 'text-white'}`}>
          {player.name}
          {isMe && <span className="text-white/40 text-xs ml-1">(you)</span>}
        </span>
      </div>

      {/* Balance */}
      <div className="text-xs text-white/60">
        <span className="text-green-400 font-bold">${player.balance.toLocaleString()}</span>
      </div>

      {/* Hands */}
      {player.hands.length > 0 && !player.isSittingOut && (
        <div className="flex gap-3 flex-wrap justify-center">
          {player.hands.map((hand, hi) => (
            <Hand
              key={hi}
              hand={hand}
              isActive={isCurrentTurn && player.activeHandIndex === hi}
              compact={player.hands.length > 1}
            />
          ))}
        </div>
      )}

      {/* Sitting out / bet waiting */}
      {player.isSittingOut && (
        <span className="text-xs text-white/40 italic">sitting out</span>
      )}

      {gameState.phase === 'betting' && !player.hasBet && !player.isSittingOut && (
        <span className="text-xs text-white/40 animate-pulse">betting...</span>
      )}
      {gameState.phase === 'betting' && player.hasBet && (
        <span className="text-xs text-green-400">✓ ready</span>
      )}

      {/* Insurance indicator */}
      {gameState.phase === 'insurance' && player.insuranceBet > 0 && (
        <span className="text-xs text-blue-400">Insured ${player.insuranceBet}</span>
      )}

      {/* Status badge */}
      {overallStatus && overallStatus !== 'active' && overallStatus !== 'sitting-out' && (
        <span className={`badge ${
          overallStatus === 'blackjack' ? 'badge-blackjack' :
          overallStatus === 'bust' ? 'badge-bust' :
          'badge-standing'
        }`}>
          {overallStatus === 'blackjack' ? '♠ Blackjack' :
           overallStatus === 'bust' ? 'Bust' : 'Stand'}
        </span>
      )}

      {/* Turn timer indicator */}
      {isCurrentTurn && gameState.turnTimeLeft <= 10 && (
        <div
          className="timer-ring"
          style={{ '--pct': `${(gameState.turnTimeLeft / 45) * 100}%` } as React.CSSProperties}
        >
          <div className="timer-ring-inner">{gameState.turnTimeLeft}</div>
        </div>
      )}
    </div>
  );
}
