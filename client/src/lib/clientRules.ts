type AnyCard = { rank: string; suit: string; faceUp: boolean };

export function cardValue(rank: string): number {
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank, 10);
}

export function fullHandScore(cards: AnyCard[]): number {
  let score = 0;
  let aces = 0;
  for (const card of cards) {
    score += cardValue(card.rank);
    if (card.rank === 'A') aces++;
  }
  while (score > 21 && aces > 0) { score -= 10; aces--; }
  return score;
}

export function isBlackjack(cards: AnyCard[]): boolean {
  return cards.length === 2 && fullHandScore(cards) === 21;
}
