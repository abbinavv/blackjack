import { useEffect, useRef } from 'react';
import { socket } from './lib/socket';
import { useGameStore, loadSession, clearSession } from './store/gameStore';
import { PublicGameState } from './types';
import { Lobby } from './components/Lobby';
import { WaitingRoom } from './components/WaitingRoom';
import { Table } from './components/Table';
import { ToastContainer } from './components/Toast';

export function App() {
  const { gameState, roomCode, setGameState, setMyId, setRoomCode, setPlayerName, addToast, setError } = useGameStore();
  const prevPhase = useRef<string | null>(null);

  useEffect(() => {
    socket.on('connect', () => {
      const id = socket.id!;
      setMyId(id);

      // Attempt to rejoin a previous session after page refresh
      const session = loadSession();
      if (session) {
        socket.emit('rejoinRoom', { roomCode: session.roomCode, name: session.playerName }, (ok: boolean) => {
          if (ok) {
            setRoomCode(session.roomCode);
            setPlayerName(session.playerName);
          } else {
            clearSession();
          }
        });
      }
    });

    socket.on('gameState', (state: PublicGameState) => {
      setGameState(state);
    });

    socket.on('toast', (msg: string) => {
      addToast(msg, 'info');
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

  return (
    <>
      <ToastContainer />
      {(!roomCode || !gameState) && <Lobby />}
      {roomCode && gameState?.phase === 'waiting' && <WaitingRoom />}
      {roomCode && gameState && gameState.phase !== 'waiting' && <Table />}
    </>
  );
}
