import { useEffect, useRef } from 'react';
import { socket } from './lib/socket';
import { useGameStore, loadSession, clearSession } from './store/gameStore';
import { AnyGameState, RoulettePublicGameState } from './types';
import { GameSelect } from './components/GameSelect';
import { Lobby } from './components/Lobby';
import { WaitingRoom } from './components/WaitingRoom';
import { Table } from './components/Table';
import { RouletteTable } from './components/RouletteTable';
import { ToastContainer } from './components/Toast';

export function App() {
  const {
    gameState, roomCode, gameType,
    setGameState, setMyId, setRoomCode, setPlayerName, setGameType,
    addToast, setError,
  } = useGameStore();
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
            setGameType(session.gameType ?? 'blackjack');
          } else {
            clearSession();
          }
        });
      }
    });

    socket.on('gameState', (state: AnyGameState) => {
      setGameState(state);
      // Sync gameType from server state if available (e.g. after rejoin)
      if ((state as RoulettePublicGameState).gameType === 'roulette') {
        setGameType('roulette');
      } else if (!(state as RoulettePublicGameState).gameType) {
        // Only set to blackjack if not already set to something
        const current = useGameStore.getState().gameType;
        if (!current) setGameType('blackjack');
      }
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

  // Determine current screen
  const phase = gameState?.phase;
  const isRouletteState = (gameState as RoulettePublicGameState | null)?.gameType === 'roulette';
  const resolvedGameType = isRouletteState ? 'roulette' : (gameType ?? null);

  // 1. No game type selected → GameSelect
  if (!resolvedGameType) {
    return (
      <>
        <ToastContainer />
        <GameSelect />
      </>
    );
  }

  // 2. No room or no state → Lobby
  if (!roomCode || !gameState) {
    return (
      <>
        <ToastContainer />
        <Lobby gameType={resolvedGameType} />
      </>
    );
  }

  // 3. In waiting room
  if (phase === 'waiting') {
    return (
      <>
        <ToastContainer />
        <WaitingRoom />
      </>
    );
  }

  // 4. Active game
  if (isRouletteState || resolvedGameType === 'roulette') {
    return <RouletteTable />;
  }

  return (
    <>
      <ToastContainer />
      <Table />
    </>
  );
}
