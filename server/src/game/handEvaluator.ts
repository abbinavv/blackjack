import { Card, Rank } from './types';

export interface HandResult {
  rank: number;
  score: number;
  name: string;
  bestCards: Card[];
}

export const HAND_NAMES = [
  'High Card',
  'One Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
];

const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
  '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

function rankVal(card: Card): number {
  return RANK_VALUES[card.rank];
}

function combos5(cards: Card[]): Card[][] {
  const result: Card[][] = [];
  const n = cards.length;
  for (let a = 0; a < n - 4; a++)
    for (let b = a + 1; b < n - 3; b++)
      for (let cc = b + 1; cc < n - 2; cc++)
        for (let d = cc + 1; d < n - 1; d++)
          for (let e = d + 1; e < n; e++)
            result.push([cards[a], cards[b], cards[cc], cards[d], cards[e]]);
  return result;
}

function evaluate5(hand: Card[]): HandResult {
  const vals = hand.map(rankVal).sort((a, b) => b - a);
  const suits = hand.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);

  const counts: Record<number, number> = {};
  for (const v of vals) counts[v] = (counts[v] ?? 0) + 1;
  const groups = Object.entries(counts)
    .map(([v, c]) => ({ v: Number(v), c }))
    .sort((a, b) => b.c - a.c || b.v - a.v);

  const isStraight = (() => {
    if (vals[0] - vals[4] === 4 && new Set(vals).size === 5) return true;
    // Wheel: A-2-3-4-5
    if (vals[0] === 14 && vals[1] === 5 && vals[2] === 4 && vals[3] === 3 && vals[4] === 2) return true;
    return false;
  })();

  const straightHigh = (() => {
    if (!isStraight) return 0;
    if (vals[0] === 14 && vals[1] === 5) return 5; // wheel
    return vals[0];
  })();

  // Build score with tiebreakers packed into digits
  const pack = (arr: number[]) => arr.reduce((acc, v, i) => acc + v * Math.pow(15, 4 - i), 0);

  if (isStraight && isFlush) {
    const name = straightHigh === 14 ? 'Royal Flush' : HAND_NAMES[8];
    return { rank: 8, score: 8e10 + straightHigh, name, bestCards: hand };
  }

  if (groups[0].c === 4) {
    const kicker = groups[1].v;
    return { rank: 7, score: 7e10 + groups[0].v * 15 + kicker, name: HAND_NAMES[7], bestCards: hand };
  }

  if (groups[0].c === 3 && groups[1].c === 2) {
    return { rank: 6, score: 6e10 + groups[0].v * 15 + groups[1].v, name: HAND_NAMES[6], bestCards: hand };
  }

  if (isFlush) {
    return { rank: 5, score: 5e10 + pack(vals), name: HAND_NAMES[5], bestCards: hand };
  }

  if (isStraight) {
    return { rank: 4, score: 4e10 + straightHigh, name: HAND_NAMES[4], bestCards: hand };
  }

  if (groups[0].c === 3) {
    const kickers = groups.slice(1).map(g => g.v);
    return { rank: 3, score: 3e10 + groups[0].v * 225 + pack(kickers), name: HAND_NAMES[3], bestCards: hand };
  }

  if (groups[0].c === 2 && groups[1].c === 2) {
    const highPair = Math.max(groups[0].v, groups[1].v);
    const lowPair = Math.min(groups[0].v, groups[1].v);
    const kicker = groups[2].v;
    return { rank: 2, score: 2e10 + highPair * 225 + lowPair * 15 + kicker, name: HAND_NAMES[2], bestCards: hand };
  }

  if (groups[0].c === 2) {
    const kickers = groups.slice(1).map(g => g.v);
    return { rank: 1, score: 1e10 + groups[0].v * 3375 + pack(kickers), name: HAND_NAMES[1], bestCards: hand };
  }

  return { rank: 0, score: pack(vals), name: HAND_NAMES[0], bestCards: hand };
}

export function bestHand(cards: Card[]): HandResult {
  const all = combos5(cards);
  let best: HandResult | null = null;
  for (const combo of all) {
    const result = evaluate5(combo);
    if (!best || result.score > best.score) best = result;
  }
  return best!;
}
