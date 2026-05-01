import { create } from 'zustand';
import { PublicGameState } from '../types';

export interface Toast {
  id: number;
  msg: string;
  type: 'win' | 'loss' | 'info';
}

let toastCounter = 0;

interface GameStore {
  gameState: PublicGameState | null;
  myId: string | null;
  roomCode: string | null;
  playerName: string | null;
  error: string | null;
  toasts: Toast[];
  setGameState: (s: PublicGameState) => void;
  setMyId: (id: string) => void;
  setRoomCode: (code: string | null) => void;
  setPlayerName: (name: string) => void;
  setError: (e: string | null) => void;
  addToast: (msg: string, type?: Toast['type']) => void;
  removeToast: (id: number) => void;
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
  addToast: (msg, type = 'info') => {
    const id = ++toastCounter;
    set(st => ({ toasts: [...st.toasts, { id, msg, type }] }));
    setTimeout(() => {
      useGameStore.setState(st => ({ toasts: st.toasts.filter(t => t.id !== id) }));
    }, 3500);
  },
  removeToast: (id) => set(st => ({ toasts: st.toasts.filter(t => t.id !== id) })),
}));

export function saveBalance(name: string, balance: number) {
  localStorage.setItem(`bj_balance_${name.toLowerCase()}`, String(balance));
}

export function loadBalance(name: string): number {
  const raw = localStorage.getItem(`bj_balance_${name.toLowerCase()}`);
  const n = raw ? parseInt(raw, 10) : NaN;
  return isNaN(n) || n <= 0 ? 1000 : Math.min(n, 50000);
}

export function saveSession(roomCode: string, playerName: string) {
  localStorage.setItem('bj_session', JSON.stringify({ roomCode, playerName }));
}

export function clearSession() {
  localStorage.removeItem('bj_session');
}

export function loadSession(): { roomCode: string; playerName: string } | null {
  try {
    const raw = localStorage.getItem('bj_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.roomCode && parsed?.playerName) return parsed;
  } catch {}
  return null;
}
