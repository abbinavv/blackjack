import { useEffect, useRef, useState } from 'react';
import { Card as CardType } from '../types';
import { playCardFlip } from '../lib/sounds';

const SUIT_SYMBOL: Record<string, string> = {
  hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠',
};

interface Props {
  card: CardType;
  animate?: boolean;
  small?: boolean;
}

export function Card({ card, animate = true, small = false }: Props) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const symbol = SUIT_SYMBOL[card.suit];
  const suitClass = isRed ? 'red-suit' : 'black-suit';
  const ref = useRef<HTMLDivElement>(null);
  const prevFaceUp = useRef(card.faceUp);
  const [flipping, setFlipping] = useState(false);

  // Flip animation: face-down → face-up
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

  // Deal-in animation for new cards
  useEffect(() => {
    if (!animate) return;
    const el = ref.current;
    if (!el) return;
    el.classList.remove('animate-dealIn');
    void el.offsetWidth;
    el.classList.add('animate-dealIn');
  }, [animate]);

  if (!card.faceUp) {
    return (
      <div ref={ref} className={`playing-card face-down ${small ? 'small' : ''}`} />
    );
  }

  return (
    <div
      ref={ref}
      className={`playing-card ${flipping ? 'animate-flipCard' : animate ? 'animate-dealIn' : ''} ${small ? 'small' : ''}`}
    >
      <div className={`card-rank-suit ${suitClass}`}>
        <div>{card.rank}</div>
        <div style={{ fontSize: 10 }}>{symbol}</div>
      </div>
      <div className={`card-center-suit ${suitClass}`}>{symbol}</div>
      <div className={`card-rank-suit bottom ${suitClass}`}>
        <div>{card.rank}</div>
        <div style={{ fontSize: 10 }}>{symbol}</div>
      </div>
    </div>
  );
}
