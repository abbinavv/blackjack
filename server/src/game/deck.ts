import { Card, Rank, Suit } from './types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const NUM_DECKS = 6;

export function createShoe(): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < NUM_DECKS; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ suit, rank, faceUp: true });
      }
    }
  }
  return shuffle(cards);
}

export function shuffle(cards: Card[]): Card[] {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Cut card placed at 75% through the shoe
export function getCutCardPosition(deckLength: number): number {
  return Math.floor(deckLength * 0.25); // Cards remaining when cut card is hit
}

export function dealCard(deck: Card[], faceUp = true): [Card, Card[]] {
  const remaining = [...deck];
  const raw = remaining.pop()!;
  const card: Card = { ...raw, faceUp };
  return [card, remaining];
}
