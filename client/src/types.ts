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
