import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!animate) return;
    playCardFlip();
    const el = ref.current;
    if (!el) return;
    el.classList.remove('animate-dealIn');
    void el.offsetWidth; // reflow
    el.classList.add('animate-dealIn');
  }, [animate]);

  if (!card.faceUp) {
    return (
      <div
        ref={ref}
        className={`playing-card face-down animate-flipCard ${small ? 'scale-75 origin-top-left' : ''}`}
      />
    );
  }

  return (
    <div
      ref={ref}
      className={`playing-card ${animate ? 'animate-dealIn' : ''} ${small ? 'scale-75 origin-top-left' : ''}`}
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
