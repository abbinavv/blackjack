import { Card, PlayerHand } from './types';

export function cardValue(rank: string): number {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank, 10);
}

export function isTenValue(rank: string): boolean {
  return ['10', 'J', 'Q', 'K'].includes(rank);
}

export function handScore(cards: Card[]): number {
  const visible = cards.filter(c => c.faceUp);
  let score = 0;
  let aces = 0;
  for (const card of visible) {
    score += cardValue(card.rank);
    if (card.rank === 'A') aces++;
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }
  return score;
}

export function fullHandScore(cards: Card[]): number {
  // Count all cards regardless of faceUp
  let score = 0;
  let aces = 0;
  for (const card of cards) {
    score += cardValue(card.rank);
    if (card.rank === 'A') aces++;
  }
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }
  return score;
}

export function isSoft(cards: Card[]): boolean {
  let score = 0;
  let aces = 0;
  for (const card of cards) {
    score += cardValue(card.rank);
    if (card.rank === 'A') aces++;
  }
  // Soft if we have an ace counted as 11 (score <= 21)
  return aces > 0 && score <= 21;
}

export function isBlackjack(cards: Card[]): boolean {
  return (
    cards.length === 2 &&
    fullHandScore(cards) === 21
  );
}

export function isBust(cards: Card[]): boolean {
  return fullHandScore(cards) > 21;
}

// S17: dealer stands on soft 17 and above
export function dealerShouldHit(cards: Card[]): boolean {
  const score = fullHandScore(cards);
  if (score > 17) return false;
  if (score < 17) return true;
  // score === 17: stand on soft 17 (S17 rule)
  return false;
}

export function canSplit(hand: PlayerHand): boolean {
  if (hand.cards.length !== 2) return false;
  return cardValue(hand.cards[0].rank) === cardValue(hand.cards[1].rank);
}

export function canDouble(hand: PlayerHand): boolean {
  return hand.cards.length === 2;
}

export function calculatePayout(
  hand: PlayerHand,
  dealerCards: Card[],
  insuranceBet: number,
  dealerHasBlackjack: boolean
): number {
  let net = 0;
  const dealerScore = fullHandScore(dealerCards);
  const playerScore = fullHandScore(hand.cards);
  const playerBJ = isBlackjack(hand.cards) && !hand.isSplit; // Split aces 21 ≠ BJ

  // Insurance payout
  if (insuranceBet > 0) {
    net += dealerHasBlackjack ? insuranceBet * 2 : -insuranceBet;
  }

  if (hand.status === 'bust') {
    net -= hand.bet;
  } else if (playerBJ && dealerHasBlackjack) {
    // Push — no change to net from main bet
  } else if (playerBJ) {
    net += Math.floor(hand.bet * 1.5); // 3:2
  } else if (dealerHasBlackjack) {
    net -= hand.bet;
  } else if (dealerScore > 21) {
    // Dealer bust
    net += hand.bet;
  } else if (playerScore > dealerScore) {
    net += hand.bet;
  } else if (playerScore === dealerScore) {
    // Push
  } else {
    net -= hand.bet;
  }

  return net;
}
