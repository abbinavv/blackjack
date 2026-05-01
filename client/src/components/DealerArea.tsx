import { PublicGameState } from '../types';
import { DealerHand } from './Hand';

interface Props {
  gameState: PublicGameState;
}

export function DealerArea({ gameState }: Props) {
  const { dealerHand, dealerScore, phase } = gameState;
  const isDealerBust = phase === 'complete' && dealerScore > 21;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Label */}
      <div className="flex items-center gap-3">
        <div className="h-px w-16 bg-white/20" />
        <span className="text-xs tracking-[0.2em] uppercase text-white/50 font-bold">Dealer</span>
        <div className="h-px w-16 bg-white/20" />
      </div>

      <DealerHand cards={dealerHand} score={dealerScore} phase={phase} />

      {isDealerBust && (
        <span className="badge badge-bust animate-slideUp">Dealer Bust</span>
      )}

    </div>
  );
}
