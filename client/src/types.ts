export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type GamePhase = 'waiting' | 'betting' | 'dealing' | 'insurance' | 'playing' | 'dealer' | 'complete';
export type HandStatus = 'active' | 'standing' | 'bust' | 'blackjack';

export interface Card {
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export interface PublicPlayerHand {
  cards: Card[];
  bet: number;
  status: HandStatus;
  isDoubled: boolean;
  isSplit: boolean;
  score: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  balance: number;
  hands: PublicPlayerHand[];
  activeHandIndex: number;
  insuranceBet: number;
  hasBet: boolean;
  hasActedOnInsurance: boolean;
  isHost: boolean;
  isSittingOut: boolean;
  wantsSitOut: boolean;
  isDisconnected: boolean;
}

/** Blackjack game state — this is the primary type used by existing components */
export interface PublicGameState {
  gameType?: 'blackjack';
  roomCode: string;
  phase: GamePhase;
  players: PublicPlayer[];
  dealerHand: Card[];
  dealerScore: number;
  currentPlayerIndex: number;
  round: number;
  bettingTimeLeft: number;
  insuranceTimeLeft: number;
  turnTimeLeft: number;
  message: string;
  needsReshuffle: boolean;
}

// ─── Roulette types ───────────────────────────────────────────────────────────

export type RouletteBetType =
  | 'straight' | 'split' | 'street' | 'corner' | 'sixline'
  | 'dozen' | 'column'
  | 'red' | 'black' | 'odd' | 'even' | 'low' | 'high';

export type RoulettePhase = 'waiting' | 'betting' | 'spinning' | 'complete';

export interface RouletteBet {
  type: RouletteBetType;
  numbers: number[];
  amount: number;
}

export interface RoulettePlayer {
  id: string;
  name: string;
  balance: number;
  bets: RouletteBet[];
  lastWin: number;
  isHost: boolean;
  isConnected: boolean;
}

export interface RoulettePublicGameState {
  gameType: 'roulette';
  roomCode: string;
  phase: RoulettePhase;
  players: RoulettePlayer[];
  spinResult: number | null;
  round: number;
  bettingTimeLeft: number;
  message: string;
}

/** Union of all possible game states — use when the game type may be either */
export type AnyGameState = PublicGameState | RoulettePublicGameState;
