import { useEffect, useState } from 'react';
import { socket } from './lib/socket';
import { useGameStore, loadSession, clearSession, saveSession, loadBalance } from './store/gameStore';
import { AnyGameState } from './types';
import { Lobby } from './components/Lobby';
import { WaitingRoom } from './components/WaitingRoom';
import { Table } from './components/Table';
import { RouletteTable } from './components/RouletteTable';
import { PokerTable } from './components/PokerTable';
import { GameSelect } from './components/GameSelect';
import { ToastContainer } from './components/Toast';
import { playButton } from './lib/sounds';

export function App() {
  const {
    gameState, pokerGameState, roomCode,
    setGameState, setMyId, setRoomCode, setPlayerName, setGameType,
    addToast, setError
  } = useGameStore();
  const error = useGameStore(s => s.error);
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [lobbyMode, setLobbyMode] = useState<'select' | 'home' | 'join'>('select');
  const [selectedGame, setSelectedGame] = useState<'blackjack' | 'roulette' | 'poker' | null>(null);

  useEffect(() => {
    socket.on('connect', () => {
      const id = socket.id!;
      setMyId(id);

      const session = loadSession();
      if (session) {
        socket.emit('rejoinRoom', { roomCode: session.roomCode, name: session.playerName }, (ok: boolean) => {
          if (ok) {
            setRoomCode(session.roomCode);
            setPlayerName(session.playerName);
            setGameType((session.gameType ?? 'blackjack') as 'blackjack' | 'roulette' | 'poker');
          } else {
            clearSession();
          }
        });
      }
    });

    socket.on('gameState', (state: AnyGameState) => {
      setGameState(state);
    });

    socket.on('toast', (msg: string) => {
      addToast(msg, 'info');
    });

    socket.on('error', (msg: string) => {
      setError(msg);
      setTimeout(() => setError(null), 4000);
    });

    socket.on('disconnect', () => {});

    return () => {
      socket.off('connect');
      socket.off('gameState');
      socket.off('toast');
      socket.off('error');
      socket.off('disconnect');
    };
  }, []);

  const connect = (cb: () => void) => {
    if (!socket.connected) {
      socket.connect();
      const timeout = setTimeout(() => {
        socket.off('connect');
        setLoading(false);
        setError('Cannot reach server — it may be waking up. Wait 30s and try again.');
      }, 12000);
      socket.once('connect', () => {
        clearTimeout(timeout);
        setMyId(socket.id!);
        cb();
      });
      socket.once('connect_error', () => {
        clearTimeout(timeout);
        setLoading(false);
        setError('Connection failed. Check your internet and try again.');
      });
    } else {
      cb();
    }
  };

  const handleCreate = () => {
    if (!name.trim()) return setError('Enter your name');
    if (!selectedGame) return setError('Select a game');
    setError(null);
    setLoading(true);
    playButton();
    const trimmed = name.trim();
    const savedBalance = loadBalance(trimmed);
    connect(() => {
      socket.emit('createRoom', { name: trimmed, savedBalance, gameType: selectedGame }, (roomCode: string) => {
        setPlayerName(trimmed);
        setRoomCode(roomCode);
        setGameType(selectedGame);
        saveSession(roomCode, trimmed, selectedGame);
        setLoading(false);
      });
    });
  };

  const handleJoin = () => {
    if (!name.trim()) return setError('Enter your name');
    if (joinCode.trim().length !== 4) return setError('Enter a 4-character room code');
    setError(null);
    setLoading(true);
    playButton();
    const trimmed = name.trim();
    const roomCode = joinCode.trim().toUpperCase();
    const savedBalance = loadBalance(trimmed);
    connect(() => {
      socket.emit(
        'joinRoom',
        { roomCode, name: trimmed, savedBalance },
        (ok: boolean, err?: string) => {
          setLoading(false);
          if (!ok) return setError(err ?? 'Failed to join');
          setPlayerName(trimmed);
          setRoomCode(roomCode);
          saveSession(roomCode, trimmed, selectedGame ?? 'blackjack');
        }
      );
    });
  };

  const handleLeave = () => {
    clearSession();
    socket.disconnect();
    setRoomCode(null);
    setGameType(null);
    useGameStore.setState({ gameState: null, pokerGameState: null, pokerMyCards: null });
    setLobbyMode('select');
    setSelectedGame(null);
    window.location.reload();
  };

  // ─── Poker routing ────────────────────────────────────────────────────────

  if (roomCode && pokerGameState) {
    if (pokerGameState.phase === 'waiting') {
      return (
        <>
          <ToastContainer />
          <PokerWaitingRoom onLeave={handleLeave} />
        </>
      );
    }
    return (
      <>
        <ToastContainer />
        <PokerTable onLeave={handleLeave} />
      </>
    );
  }

  // ─── Roulette routing ─────────────────────────────────────────────────────

  if (roomCode && gameState && (gameState as { gameType?: string }).gameType === 'roulette') {
    return (
      <>
        <ToastContainer />
        <RouletteTable />
      </>
    );
  }

  // ─── Blackjack routing ────────────────────────────────────────────────────

  if (roomCode && gameState) {
    if (gameState.phase === 'waiting') {
      return (
        <>
          <ToastContainer />
          <WaitingRoom />
        </>
      );
    }
    return (
      <>
        <ToastContainer />
        <Table />
      </>
    );
  }

  // ─── Lobby ────────────────────────────────────────────────────────────────

  if (lobbyMode === 'select') {
    return (
      <>
        <ToastContainer />
        <GameSelect onSelectGame={(g) => { setSelectedGame(g); setLobbyMode('home'); }} />
      </>
    );
  }

  return (
    <>
      <ToastContainer />
      <Lobby
        name={name}
        setName={setName}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        mode={lobbyMode === 'join' ? 'join' : 'home'}
        setMode={(m) => setLobbyMode(m as 'home' | 'join')}
        loading={loading}
        error={error}
        selectedGame={selectedGame}
        onBack={() => setLobbyMode('select')}
        onCreate={handleCreate}
        onJoin={handleJoin}
      />
    </>
  );
}

// ─── Poker waiting room ───────────────────────────────────────────────────────

function PokerWaitingRoom({ onLeave }: { onLeave: () => void }) {
  const { pokerGameState, roomCode, myId } = useGameStore();
  if (!pokerGameState || !roomCode) return null;

  const me = pokerGameState.players.find(p => p.id === myId);
  const isHost = me?.isHost ?? false;
  const canStart = pokerGameState.players.filter(p => p.status !== 'sitting-out').length >= 2;

  const copyCode = () => {
    playButton();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomCode).catch(() => {});
    }
  };

  const handleStart = () => {
    playButton();
    socket.emit('startGame', roomCode);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
         style={{ background: 'radial-gradient(ellipse at 50% 30%, #0d2818 0%, #050d0a 100%)' }}>
      <div className="text-center mb-8">
        <div className="text-4xl mb-2">♣</div>
        <h1 className="font-display text-3xl font-bold text-gold">Poker — Waiting Room</h1>
        <p className="text-white/40 text-sm mt-1">No-Limit Texas Hold'em · $10/$20 Blinds</p>
      </div>

      <div
        className="mb-6 px-8 py-5 rounded-2xl text-center cursor-pointer hover:bg-white/10 transition-colors"
        style={{ background: 'rgba(201,168,76,0.1)', border: '2px dashed rgba(201,168,76,0.4)' }}
        onClick={copyCode}
        title="Click to copy"
      >
        <div className="text-xs uppercase tracking-widest text-white/40 mb-1">Room Code</div>
        <div className="font-mono font-black text-5xl text-gold tracking-[0.3em]">{roomCode}</div>
        <div className="text-xs text-white/30 mt-1">Tap to copy</div>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl p-4 mb-5 space-y-2"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        <div className="text-xs uppercase tracking-widest text-white/40 mb-3">
          Players ({pokerGameState.players.length}/6)
        </div>
        {pokerGameState.players.map(p => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl
              ${p.id === myId ? 'bg-gold/10 border border-gold/20' : 'bg-white/5'}`}
          >
            <div className="flex items-center gap-2">
              {p.isHost && <span className="text-gold text-sm">★</span>}
              <span className="text-sm font-medium text-white">
                {p.name}
                {p.id === myId && <span className="text-white/40 text-xs ml-1">(you)</span>}
              </span>
            </div>
            <span className="text-xs text-green-400 font-bold">${p.balance.toLocaleString()}</span>
          </div>
        ))}
        {pokerGameState.players.length < 6 && (
          <div className="flex items-center gap-2 px-3 py-2 text-white/25 text-sm">
            <span className="text-lg">+</span>
            <span>Waiting for players... (need at least 2)</span>
          </div>
        )}
      </div>

      <div className="w-full max-w-sm space-y-3">
        {isHost ? (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="btn-primary w-full py-4 text-base"
          >
            {canStart ? 'Start Game →' : `Need ${2 - pokerGameState.players.length} more player(s)`}
          </button>
        ) : (
          <div className="text-center py-3 text-white/40 text-sm animate-pulse">
            Waiting for host to start the game...
          </div>
        )}
        <button onClick={onLeave} className="btn-ghost w-full py-3 text-sm">Leave Room</button>
      </div>
    </div>
  );
}
