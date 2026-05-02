export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type GamePhase = 'waiting' | 'betting' | 'dealing' | 'insurance' | 'playing' | 'dealer' | 'complete';

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

export interface RouletteGameState {
  roomCode: string;
  gameType: 'roulette';
  phase: RoulettePhase;
  players: RoulettePlayer[];
  spinResult: number | null;
  round: number;
  bettingTimeLeft: number;
  message: string;
}

export interface RoulettePublicGameState {
  roomCode: string;
  gameType: 'roulette';
  phase: RoulettePhase;
  players: RoulettePlayer[];
  spinResult: number | null;
  round: number;
  bettingTimeLeft: number;
  message: string;
}
export type HandStatus = 'active' | 'standing' | 'bust' | 'blackjack';

export interface Card {
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export interface PlayerHand {
  cards: Card[];
  bet: number;
  status: HandStatus;
  isDoubled: boolean;
  isSplit: boolean;
}

export interface Player {
  id: string;
  name: string;
  balance: number;
  hands: PlayerHand[];
  activeHandIndex: number;
  insuranceBet: number;
  hasBet: boolean;
  hasActedOnInsurance: boolean;
  isHost: boolean;
  isSittingOut: boolean;
  wantsSitOut: boolean;
  wasRebought: boolean;
  isDisconnected: boolean;
}

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  dealerHand: Card[];
  currentPlayerIndex: number;
  deck: Card[];
  cutCardPosition: number;
  needsReshuffle: boolean;
  round: number;
  bettingTimeLeft: number;
  insuranceTimeLeft: number;
  turnTimeLeft: number;
  message: string;
}

// What the client receives — dealer hole card hidden during play
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

export interface PublicGameState {
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
