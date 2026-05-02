interface LobbyProps {
  name: string;
  setName: (n: string) => void;
  joinCode: string;
  setJoinCode: (c: string) => void;
  mode: 'home' | 'join';
  setMode: (m: 'home' | 'join') => void;
  loading: boolean;
  error: string | null;
  selectedGame: 'blackjack' | 'roulette' | 'poker' | null;
  onBack: () => void;
  onCreate: () => void;
  onJoin: () => void;
}

export function Lobby({
  name, setName, joinCode, setJoinCode,
  mode, setMode, loading, error,
  selectedGame, onBack, onCreate, onJoin,
}: LobbyProps) {
  const gameIcon = selectedGame === 'poker' ? '♣' : selectedGame === 'roulette' ? '🎡' : '♠';
  const gameLabel = selectedGame === 'poker' ? "Texas Hold'em" : selectedGame === 'roulette' ? 'Roulette' : 'Blackjack';
  const gameSubtitle = selectedGame === 'poker' ? 'No-Limit Poker' : selectedGame === 'roulette' ? 'European Wheel' : 'Vegas Strip Rules';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
         style={{ background: 'radial-gradient(ellipse at 50% 30%, #0d2818 0%, #050d0a 100%)' }}>

      <div className="text-center mb-10">
        <div className="text-6xl mb-3">{gameIcon}</div>
        <h1 className="font-display text-5xl font-black text-gold tracking-tight">{gameLabel}</h1>
        <p className="text-white/30 text-sm mt-2 tracking-widest uppercase">{gameSubtitle}</p>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl p-7 space-y-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        <div>
          <label className="text-xs uppercase tracking-widest text-white/40 mb-1.5 block">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') mode === 'join' ? onJoin() : onCreate(); }}
            placeholder="Enter your name..."
            maxLength={20}
            className="w-full px-4 py-3 rounded-xl text-white placeholder-white/25
                       focus:outline-none focus:border-gold/50 transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
          />
        </div>

        {mode === 'join' && (
          <div className="animate-slideUp">
            <label className="text-xs uppercase tracking-widest text-white/40 mb-1.5 block">Room Code</label>
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              onKeyDown={e => { if (e.key === 'Enter') onJoin(); }}
              placeholder="ABCD"
              maxLength={4}
              className="w-full px-4 py-3 rounded-xl text-center text-2xl font-mono font-bold
                         text-gold tracking-[0.3em] placeholder-white/20
                         focus:outline-none focus:border-gold/50 transition-colors"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm text-center animate-slideUp">{error}</div>
        )}

        {mode === 'home' ? (
          <div className="space-y-3">
            <button onClick={onCreate} disabled={loading} className="btn-primary w-full text-base py-3.5">
              {loading ? 'Creating...' : '+ Create Room'}
            </button>
            <button onClick={() => { setMode('join'); }} className="btn-ghost w-full text-base py-3.5">
              Join Room
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={onJoin} disabled={loading} className="btn-primary w-full text-base py-3.5">
              {loading ? 'Joining...' : 'Join Game'}
            </button>
            <button onClick={() => setMode('home')} className="btn-ghost w-full text-base py-3.5">
              ← Back
            </button>
          </div>
        )}

        <button onClick={onBack} className="w-full text-center text-xs text-white/25 hover:text-white/50 transition-colors py-1">
          ← Change game
        </button>
      </div>

      <div className="mt-8 flex gap-6 text-white/25 text-xs">
        {selectedGame === 'poker' ? (
          <>
            <span>2–6 Players</span>
            <span>$10/$20 Blinds</span>
            <span>NL Hold'em</span>
          </>
        ) : selectedGame === 'roulette' ? (
          <>
            <span>2–6 Players</span>
            <span>37 Numbers</span>
            <span>2.7% Edge</span>
          </>
        ) : (
          <>
            <span>2–6 Players</span>
            <span>$10–$1K Bets</span>
            <span>3:2 Blackjack</span>
            <span>S17</span>
          </>
        )}
      </div>
    </div>
  );
}
