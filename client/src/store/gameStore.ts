import { create } from 'zustand';
import { PublicGameState } from '../types';

interface GameStore {
  gameState: PublicGameState | null;
  myId: string | null;
  roomCode: string | null;
  playerName: string | null;
  error: string | null;
  toasts: string[];
  setGameState: (s: PublicGameState) => void;
  setMyId: (id: string) => void;
  setRoomCode: (code: string | null) => void;
  setPlayerName: (name: string) => void;
  setError: (e: string | null) => void;
  addToast: (msg: string) => void;
  removeToast: (msg: string) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  myId: null,
  roomCode: null,
  playerName: null,
  error: null,
  toasts: [],
  setGameState: (s) => set({ gameState: s }),
  setMyId: (id) => set({ myId: id }),
  setRoomCode: (code) => set({ roomCode: code }),
  setPlayerName: (name) => set({ playerName: name }),
  setError: (e) => set({ error: e }),
  addToast: (msg) => set(st => ({ toasts: [...st.toasts, msg] })),
  removeToast: (msg) => set(st => ({ toasts: st.toasts.filter(t => t !== msg) })),
}));

// localStorage helpers
export function saveBalance(name: string, balance: number) {
  localStorage.setItem(`bj_balance_${name.toLowerCase()}`, String(balance));
}

export function loadBalance(name: string): number {
  const raw = localStorage.getItem(`bj_balance_${name.toLowerCase()}`);
  const n = raw ? parseInt(raw, 10) : NaN;
  return isNaN(n) || n <= 0 ? 1000 : Math.min(n, 50000);
}
