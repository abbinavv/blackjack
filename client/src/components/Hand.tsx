import { Card as CardType, PublicPlayerHand } from '../types';
import { Card } from './Card';

interface HandProps {
  hand: PublicPlayerHand;
  isActive: boolean;
  showScore?: boolean;
  compact?: boolean;
}

export function Hand({ hand, isActive, showScore = true, compact = false }: HandProps) {
  const statusColor = {
    active: 'text-white',
    standing: 'text-blue-400',
    bust: 'text-red-400',
    blackjack: 'text-yellow-400',
  }[hand.status];

  return (
    <div className={`flex flex-col items-center gap-1 ${compact ? 'scale-90 origin-top' : ''}`}>
      {/* Cards row */}
      <div className="flex gap-[-8px]">
        {hand.cards.map((card, i) => (
          <div key={`${card.suit}-${card.rank}-${i}`} style={{ marginLeft: i > 0 ? -18 : 0 }}>
            <Card card={card} animate={true} />
          </div>
        ))}
      </div>

      {/* Score + status */}
      {showScore && (
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`text-sm font-bold ${statusColor}`}>
            {hand.status === 'bust' ? 'BUST' :
             hand.status === 'blackjack' ? '♠ BJ' :
             hand.score}
          </span>
          {hand.isDoubled && (
            <span className="text-xs text-blue-400 font-bold">2x</span>
          )}
          {hand.isSplit && (
            <span className="text-xs text-purple-400 font-bold">Split</span>
          )}
          {isActive && hand.status === 'active' && (
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
          )}
        </div>
      )}

      {/* Bet */}
      {hand.bet > 0 && (
        <div className="text-xs text-gold font-bold">${hand.bet}</div>
      )}
    </div>
  );
}

interface DealerHandProps {
  cards: CardType[];
  score: number;
  phase: string;
}

export function DealerHand({ cards, score, phase }: DealerHandProps) {
  const showScore = phase !== 'playing' && phase !== 'insurance' && phase !== 'dealing';
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {cards.map((card, i) => (
          <div key={`d-${card.suit}-${card.rank}-${i}`} style={{ marginLeft: i > 0 ? -18 : 0 }}>
            <Card card={card} animate={true} />
          </div>
        ))}
      </div>
      {showScore && cards.length > 0 && (
        <div className="text-sm font-bold text-white/80">
          {score > 21 ? 'BUST' : score}
        </div>
      )}
    </div>
  );
}
