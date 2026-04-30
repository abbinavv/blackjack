import { useEffect, useRef } from 'react';
import { socket } from './lib/socket';
import { useGameStore } from './store/gameStore';
import { PublicGameState } from './types';
import { Lobby } from './components/Lobby';
import { WaitingRoom } from './components/WaitingRoom';
import { Table } from './components/Table';
import { ToastContainer } from './components/Toast';

export function App() {
  const { gameState, roomCode, setGameState, setMyId, addToast, setError } = useGameStore();
  const prevPhase = useRef<string | null>(null);

  useEffect(() => {
    socket.on('connect', () => setMyId(socket.id!));

    socket.on('gameState', (state: PublicGameState) => {
      setGameState(state);
    });

    socket.on('toast', (msg: string) => {
      addToast(msg);
      setTimeout(() => useGameStore.getState().removeToast(msg), 3500);
    });

    socket.on('error', (msg: string) => {
      setError(msg);
      setTimeout(() => setError(null), 4000);
    });

    socket.on('disconnect', () => {
      // handled gracefully
    });

    return () => {
      socket.off('connect');
      socket.off('gameState');
      socket.off('toast');
      socket.off('error');
      socket.off('disconnect');
    };
  }, []);

  // Render
  return (
    <>
      <ToastContainer />
      {(!roomCode || !gameState) && <Lobby />}
      {roomCode && gameState?.phase === 'waiting' && <WaitingRoom />}
      {roomCode && gameState && gameState.phase !== 'waiting' && <Table />}
    </>
  );
}
