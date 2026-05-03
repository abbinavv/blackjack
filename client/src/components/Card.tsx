import { useEffect, useRef, useState } from 'react';
import { Card as CardType } from '../types';
import { playCardFlip, playDeal } from '../lib/sounds';

const SUIT_SYMBOL: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};

interface Props {
  card: CardType;
  animate?: boolean;
  small?: boolean;
  dealDelay?: number;
}

export function Card({ card, animate = true, small = false, dealDelay = 0 }: Props) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const symbol = SUIT_SYMBOL[card.suit];
  const suitClass = isRed ? 'red-suit' : 'black-suit';
  const ref = useRef<HTMLDivElement>(null);
  const prevFaceUp = useRef(card.faceUp);
  const [flipping, setFlipping] = useState(false);

  // Play deal sound once when a new face-up card is mounted
  useEffect(() => {
    if (card.faceUp && animate) playDeal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!prevFaceUp.current && card.faceUp) {
      playCardFlip();
      setFlipping(true);
      const t = setTimeout(() => setFlipping(false), 400);
      prevFaceUp.current = card.faceUp;
      return () => clearTimeout(t);
    }
    prevFaceUp.current = card.faceUp;
  }, [card.faceUp]);

  useEffect(() => {
    if (!animate) return;
    const el = ref.current;
    if (!el) return;
    el.classList.remove('animate-dealIn');
    if (dealDelay > 0) el.style.animationDelay = `${dealDelay}ms`;
    void el.offsetWidth;
    el.classList.add('animate-dealIn');
  }, [animate]);

  if (!card.faceUp) {
    return <div ref={ref} className={`playing-card face-down ${small ? 'small' : ''}`} />;
  }

  return (
    <div
      ref={ref}
      className={`playing-card ${flipping ? 'animate-flipCard' : animate ? 'animate-dealIn' : ''} ${small ? 'small' : ''}`}
    >
      {/* Top-left corner: rank + suit symbol */}
      <div className={`card-rank-suit ${suitClass}`}>
        <div>{card.rank}</div>
        <div className="suit-tiny">{symbol}</div>
      </div>

      {/* Large center symbol */}
      <div className={`card-center-suit ${suitClass}`}>{symbol}</div>

      {/* Bottom-right corner: rank + suit, rotated */}
      <div className={`card-rank-suit bottom ${suitClass}`}>
        <div>{card.rank}</div>
        <div className="suit-tiny">{symbol}</div>
      </div>
    </div>
  );
}
