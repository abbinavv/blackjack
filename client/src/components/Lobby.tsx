import { useState } from 'react';
import { socket } from '../lib/socket';
import { useGameStore, loadBalance } from '../store/gameStore';
import { playButton } from '../lib/sounds';

export function Lobby() {
  const { setMyId, setRoomCode, setPlayerName, setError, error } = useGameStore();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'home' | 'join'>('home');
  const [loading, setLoading] = useState(false);

  const connect = (cb: () => void) => {
    if (!socket.connected) {
      socket.connect();
      socket.once('connect', () => { setMyId(socket.id!); cb(); });
    } else {
      cb();
    }
  };

  const handleCreate = () => {
    if (!name.trim()) return setError('Enter your name');
    setError(null);
    setLoading(true);
    playButton();
    const savedBalance = loadBalance(name.trim());
    connect(() => {
      socket.emit('createRoom', { name: name.trim(), savedBalance }, (roomCode: string) => {
        setPlayerName(name.trim());
        setRoomCode(roomCode);
        setLoading(false);
      });
    });
  };

  const handleJoin = () => {
    if (!name.trim()) return setError('Enter your name');
    if (code.trim().length !== 4) return setError('Enter a 4-character room code');
    setError(null);
    setLoading(true);
    playButton();
    const savedBalance = loadBalance(name.trim());
    connect(() => {
      socket.emit(
        'joinRoom',
        { roomCode: code.trim().toUpperCase(), name: name.trim(), savedBalance },
        (ok: boolean, err?: string) => {
          setLoading(false);
          if (!ok) return setError(err ?? 'Failed to join');
          setPlayerName(name.trim());
          setRoomCode(code.trim().toUpperCase());
        }
      );
    });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
         style={{ background: 'radial-gradient(ellipse at 50% 30%, #0d2818 0%, #050d0a 100%)' }}>

      {/* Logo */}
      <div className="text-center mb-10">
        <div className="text-6xl mb-3">♠</div>
        <h1 className="font-display text-5xl font-black text-gold tracking-tight">
          Blackjack
        </h1>
        <p className="text-white/30 text-sm mt-2 tracking-widest uppercase">Vegas Strip Rules</p>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-7 space-y-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        {/* Name */}
        <div>
          <label className="text-xs uppercase tracking-widest text-white/40 mb-1.5 block">
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') mode === 'join' ? handleJoin() : handleCreate(); }}
            placeholder="Enter your name..."
            maxLength={20}
            className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/12 text-white
                       placeholder-white/25 focus:outline-none focus:border-gold/50 transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)' }}
          />
        </div>

        {mode === 'join' && (
          <div className="animate-slideUp">
            <label className="text-xs uppercase tracking-widest text-white/40 mb-1.5 block">
              Room Code
            </label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().slice(0, 4))}
              onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
              placeholder="ABCD"
              maxLength={4}
              className="w-full px-4 py-3 rounded-xl text-center text-2xl font-mono font-bold
                         text-gold tracking-[0.3em] bg-white/7 border border-white/12
                         placeholder-white/20 focus:outline-none focus:border-gold/50 transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)' }}
            />
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm text-center animate-slideUp">{error}</div>
        )}

        {mode === 'home' ? (
          <div className="space-y-3">
            <button onClick={handleCreate} disabled={loading} className="btn-primary w-full text-base py-3.5">
              {loading ? 'Creating...' : '+ Create Room'}
            </button>
            <button onClick={() => { setMode('join'); setError(null); }} className="btn-ghost w-full text-base py-3.5">
              Join Room
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={handleJoin} disabled={loading} className="btn-primary w-full text-base py-3.5">
              {loading ? 'Joining...' : 'Join Game'}
            </button>
            <button onClick={() => { setMode('home'); setCode(''); setError(null); }} className="btn-ghost w-full text-base py-3.5">
              ← Back
            </button>
          </div>
        )}
      </div>

      {/* Footer rules */}
      <div className="mt-8 flex gap-6 text-white/25 text-xs">
        <span>2–6 Players</span>
        <span>$10–$500 Bets</span>
        <span>3:2 Blackjack</span>
        <span>S17</span>
      </div>
    </div>
  );
}
