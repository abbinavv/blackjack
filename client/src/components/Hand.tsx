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

  const wrapperAnim = hand.status === 'bust' ? 'animate-shakeX' : hand.status === 'blackjack' ? 'animate-bjGlow' : '';

  return (
    <div className={`flex flex-col items-center gap-1 rounded-lg ${wrapperAnim}`}>
      {/* Cards */}
      <div className="flex">
        {hand.cards.map((card, i) => (
          <div key={`${card.suit}-${card.rank}-${i}`} style={{ marginLeft: i > 0 ? -20 : 0 }}>
            <Card card={card} animate={true} small={compact} dealDelay={i * 80} />
          </div>
        ))}
      </div>

      {showScore && (
        <div className="flex items-center gap-1">
          <span className={`text-xs font-bold ${statusColor}`}>
            {hand.status === 'bust' ? 'BUST' : hand.status === 'blackjack' ? '♠ BJ' : hand.score}
          </span>
          {hand.isDoubled && <span className="text-[10px] text-blue-400 font-bold">2x</span>}
          {hand.isSplit && <span className="text-[10px] text-purple-400 font-bold">split</span>}
          {isActive && hand.status === 'active' && (
            <span className="w-1 h-1 rounded-full bg-gold animate-pulse" />
          )}
        </div>
      )}

      {hand.bet > 0 && (
        <div className="text-[10px] text-gold font-bold">${hand.bet.toLocaleString()}</div>
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
      <div className="flex">
        {cards.map((card, i) => (
          <div key={`d-${card.suit}-${card.rank}-${i}`} style={{ marginLeft: i > 0 ? -20 : 0 }}>
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
