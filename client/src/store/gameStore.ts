import { create } from 'zustand';
import { PublicGameState, PokerPublicGameState, AnyGameState, Card } from '../types';
import { socket } from '../lib/socket';

export interface Toast {
  id: number;
  msg: string;
  type: 'win' | 'loss' | 'info';
}

let toastCounter = 0;

interface GameStore {
  gameState: PublicGameState | null;
  pokerGameState: PokerPublicGameState | null;
  myId: string | null;
  roomCode: string | null;
  playerName: string | null;
  gameType: 'blackjack' | 'roulette' | 'poker' | null;
  error: string | null;
  toasts: Toast[];
  pokerMyCards: [Card, Card] | null;
  setGameState: (s: AnyGameState) => void;
  setMyId: (id: string) => void;
  setRoomCode: (code: string | null) => void;
  setPlayerName: (name: string) => void;
  setGameType: (t: 'blackjack' | 'roulette' | 'poker' | null) => void;
  setError: (e: string | null) => void;
  addToast: (msg: string, type?: Toast['type']) => void;
  removeToast: (id: number) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  pokerGameState: null,
  myId: null,
  roomCode: null,
  playerName: null,
  gameType: null,
  error: null,
  toasts: [],
  pokerMyCards: null,
  setGameState: (s) => set((prev) => {
    if ('gameType' in s && s.gameType === 'poker') {
      const ps = s as PokerPublicGameState;
      const wasPreFlop = prev.pokerGameState?.phase !== 'pre-flop';
      const nowPreFlop = ps.phase === 'pre-flop';
      return {
        pokerGameState: ps,
        gameState: null,
        pokerMyCards: (wasPreFlop && nowPreFlop) ? null : prev.pokerMyCards,
      };
    }
    if ('gameType' in s && (s as { gameType: string }).gameType === 'roulette') {
      return { gameState: s as unknown as PublicGameState, pokerGameState: null };
    }
    return { gameState: s as PublicGameState, pokerGameState: null };
  }),
  setMyId: (id) => set({ myId: id }),
  setRoomCode: (code) => set({ roomCode: code }),
  setPlayerName: (name) => set({ playerName: name }),
  setGameType: (t) => set({ gameType: t }),
  setError: (e) => set({ error: e }),
  addToast: (msg, type = 'info') => {
    const id = ++toastCounter;
    set(st => ({ toasts: [...st.toasts, { id, msg, type }] }));
    setTimeout(() => {
      useGameStore.setState(st => ({ toasts: st.toasts.filter(t => t.id !== id) }));
    }, 3500);
  },
  removeToast: (id) => set(st => ({ toasts: st.toasts.filter(t => t.id !== id) })),
}));

// Listen for private poker cards
socket.on('pokerYourCards', (cards: [Card, Card]) => {
  useGameStore.setState({ pokerMyCards: cards });
});

export function saveBalance(name: string, balance: number) {
  localStorage.setItem(`bj_balance_${name.toLowerCase()}`, String(balance));
}

export function loadBalance(name: string): number {
  const raw = localStorage.getItem(`bj_balance_${name.toLowerCase()}`);
  const n = raw ? parseInt(raw, 10) : NaN;
  return isNaN(n) || n <= 0 ? 1000 : Math.min(n, 50000);
}

export function saveSession(roomCode: string, playerName: string, gameType: 'blackjack' | 'roulette' | 'poker' = 'blackjack') {
  localStorage.setItem('bj_session', JSON.stringify({ roomCode, playerName, gameType }));
}

export function clearSession() {
  localStorage.removeItem('bj_session');
}

export function loadSession(): { roomCode: string; playerName: string; gameType?: 'blackjack' | 'roulette' | 'poker' } | null {
  try {
    const raw = localStorage.getItem('bj_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.roomCode && parsed?.playerName) return parsed;
  } catch {}
  return null;
}
