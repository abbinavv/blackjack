import { PublicPlayer, PublicGameState } from '../types';
import { Hand } from './Hand';

interface Props {
  player: PublicPlayer;
  playerIndex: number;
  gameState: PublicGameState;
  isMe: boolean;
  hideCards?: boolean;
}

export function PlayerSeat({ player, playerIndex, gameState, isMe, hideCards = false }: Props) {
  const isCurrentTurn = gameState.phase === 'playing' && gameState.currentPlayerIndex === playerIndex;

  const overallStatus = (() => {
    if (player.isSittingOut) return 'sitting-out';
    if (player.hands.length === 0) return null;
    if (player.hands.every(h => h.status === 'bust')) return 'bust';
    if (player.hands.some(h => h.status === 'blackjack')) return 'blackjack';
    if (player.hands.every(h => h.status === 'standing' || h.status === 'bust')) return 'standing';
    return 'active';
  })();

  // Total score across all active/standing hands (for hidden card view)
  const totalScore = player.hands.reduce((best, h) => {
    if (h.status === 'bust') return best;
    return Math.max(best, h.score);
  }, 0);
  const totalBet = player.hands.reduce((s, h) => s + h.bet, 0);

  if (hideCards) {
    // Compact pill for other players — no cards shown
    return (
      <div className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-all duration-300
        ${isCurrentTurn ? 'active-player' : 'player-seat'}
        ${isMe ? 'my-seat' : ''}
      `} style={{ minWidth: 80 }}>

        {/* Name */}
        <div className="flex items-center gap-1">
          {player.isHost && <span className="text-gold text-[10px]">★</span>}
          <span className="text-[11px] font-bold truncate max-w-[72px] text-white/80">{player.name}</span>
        </div>

        {/* Balance */}
        <span className="text-[10px] text-green-400 font-bold">${player.balance.toLocaleString()}</span>

        {/* Score or state */}
        {player.hands.length > 0 && !player.isSittingOut ? (
          <div className="flex flex-col items-center gap-0.5">
            {player.hands.map((hand, hi) => {
              const label =
                hand.status === 'blackjack' ? '♠ BJ' :
                hand.status === 'bust' ? 'BUST' :
                String(hand.score);
              const color =
                hand.status === 'blackjack' ? 'text-yellow-400' :
                hand.status === 'bust' ? 'text-red-400' :
                hand.status === 'standing' ? 'text-blue-400' : 'text-white';
              return (
                <div key={hi} className="flex items-center gap-1">
                  <span className={`text-sm font-bold tabular-nums ${color}`}>{label}</span>
                  {hand.isDoubled && <span className="text-[9px] text-blue-400">2x</span>}
                  {hand.isSplit && <span className="text-[9px] text-purple-400">sp</span>}
                  {isCurrentTurn && player.activeHandIndex === hi && hand.status === 'active' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                  )}
                </div>
              );
            })}
            {totalBet > 0 && (
              <span className="text-[10px] text-gold font-bold">${totalBet.toLocaleString()}</span>
            )}
          </div>
        ) : (
          <>
            {player.isSittingOut && <span className="text-[10px] text-white/40 italic">out</span>}
            {gameState.phase === 'betting' && !player.hasBet && !player.isSittingOut && (
              <span className="text-[10px] text-white/40 animate-pulse">betting…</span>
            )}
            {gameState.phase === 'betting' && player.hasBet && (
              <span className="text-[10px] text-green-400">✓</span>
            )}
          </>
        )}

        {/* Status badge */}
        {overallStatus && overallStatus !== 'active' && overallStatus !== 'sitting-out' && (
          <span className={`badge text-[9px] px-1 py-0 ${
            overallStatus === 'blackjack' ? 'badge-blackjack' :
            overallStatus === 'bust' ? 'badge-bust' : 'badge-standing'
          }`}>
            {overallStatus === 'blackjack' ? 'BJ' : overallStatus === 'bust' ? 'Bust' : 'Stand'}
          </span>
        )}

        {/* Disconnected indicator */}
        {player.isDisconnected && (
          <span className="text-[9px] text-orange-400 animate-pulse font-bold">⚡ disconnected</span>
        )}

        {/* Turn timer */}
        {isCurrentTurn && gameState.turnTimeLeft <= 10 && (
          <div className="timer-ring scale-75"
            style={{ '--pct': `${(gameState.turnTimeLeft / 45) * 100}%` } as React.CSSProperties}>
            <div className="timer-ring-inner text-[10px]">{gameState.turnTimeLeft}</div>
          </div>
        )}
      </div>
    );
  }

  // Full view — used for "my" seat
  return (
    <div className={`player-seat flex flex-col items-center gap-1.5
      ${isCurrentTurn ? 'active-player' : ''}
      ${isMe ? 'my-seat' : ''}
    `} style={{ minWidth: 110, maxWidth: 160 }}>

      {/* Name */}
      <div className="flex items-center gap-1">
        {player.isHost && <span className="text-gold text-xs">★</span>}
        <span className={`text-xs font-bold truncate max-w-[80px] ${isMe ? 'text-gold' : 'text-white'}`}>
          {player.name}
        </span>
        {isMe && <span className="text-white/30 text-[10px]">(you)</span>}
      </div>

      {/* Balance */}
      <span className="text-[11px] text-green-400 font-bold">${player.balance.toLocaleString()}</span>

      {/* Hands */}
      {player.hands.length > 0 && !player.isSittingOut && (
        <div className="flex gap-2 flex-wrap justify-center">
          {player.hands.map((hand, hi) => (
            <Hand
              key={hi}
              hand={hand}
              isActive={isCurrentTurn && player.activeHandIndex === hi}
              compact={false}
            />
          ))}
        </div>
      )}

      {/* States */}
      {player.isSittingOut && <span className="text-[10px] text-white/40 italic">sitting out</span>}
      {gameState.phase === 'betting' && !player.hasBet && !player.isSittingOut && (
        <span className="text-[10px] text-white/40 animate-pulse">betting...</span>
      )}
      {gameState.phase === 'betting' && player.hasBet && (
        <span className="text-[10px] text-green-400">✓</span>
      )}

      {/* Status badge */}
      {overallStatus && overallStatus !== 'active' && overallStatus !== 'sitting-out' && (
        <span className={`badge text-[10px] px-1.5 py-0.5 ${
          overallStatus === 'blackjack' ? 'badge-blackjack' :
          overallStatus === 'bust' ? 'badge-bust' : 'badge-standing'
        }`}>
          {overallStatus === 'blackjack' ? '♠ BJ' : overallStatus === 'bust' ? 'Bust' : 'Stand'}
        </span>
      )}

      {/* Turn timer */}
      {isCurrentTurn && gameState.turnTimeLeft <= 10 && (
        <div className="timer-ring scale-75"
          style={{ '--pct': `${(gameState.turnTimeLeft / 45) * 100}%` } as React.CSSProperties}>
          <div className="timer-ring-inner text-[10px]">{gameState.turnTimeLeft}</div>
        </div>
      )}
    </div>
  );
}
