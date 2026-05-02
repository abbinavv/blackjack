interface GameSelectProps {
  onSelectGame: (game: 'blackjack' | 'roulette' | 'poker') => void;
}

export function GameSelect({ onSelectGame }: GameSelectProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0a1a12 0%, #050d0a 100%)' }}
    >
      <div className="text-center mb-12">
        <div className="text-5xl mb-3">♠♣♥♦</div>
        <h1 className="font-display text-4xl font-black text-gold tracking-tight">Casino</h1>
        <p className="text-white/30 text-sm mt-2 tracking-widest uppercase">Choose your game</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 w-full max-w-2xl">
        <button
          onClick={() => onSelectGame('blackjack')}
          className="flex-1 rounded-2xl p-8 text-left transition-all hover:scale-105 active:scale-95 cursor-pointer"
          style={{
            background: 'rgba(201,168,76,0.07)',
            border: '1px solid rgba(201,168,76,0.25)',
          }}
        >
          <div className="text-4xl mb-4">♠</div>
          <div className="text-xl font-bold text-gold font-display">Blackjack</div>
          <div className="text-white/40 text-sm mt-1">Vegas Strip Rules</div>
          <div className="flex gap-3 mt-4 text-xs text-white/30">
            <span>2–6 Players</span>
            <span>3:2 BJ</span>
            <span>S17</span>
          </div>
        </button>

        <button
          onClick={() => onSelectGame('roulette')}
          className="flex-1 rounded-2xl p-8 text-left transition-all hover:scale-105 active:scale-95 cursor-pointer"
          style={{
            background: 'rgba(201,168,76,0.07)',
            border: '1px solid rgba(201,168,76,0.25)',
          }}
        >
          <div className="text-4xl mb-4">🎡</div>
          <div className="text-xl font-bold text-gold font-display">Roulette</div>
          <div className="text-white/40 text-sm mt-1">European Wheel</div>
          <div className="flex gap-3 mt-4 text-xs text-white/30">
            <span>2–6 Players</span>
            <span>37 Numbers</span>
            <span>2.7% Edge</span>
          </div>
        </button>

        <button
          onClick={() => onSelectGame('poker')}
          className="flex-1 rounded-2xl p-8 text-left transition-all hover:scale-105 active:scale-95 cursor-pointer"
          style={{
            background: 'rgba(201,168,76,0.07)',
            border: '1px solid rgba(201,168,76,0.25)',
          }}
        >
          <div className="text-4xl mb-4">♣</div>
          <div className="text-xl font-bold text-gold font-display">Texas Hold'em</div>
          <div className="text-white/40 text-sm mt-1">No-Limit Poker</div>
          <div className="flex gap-3 mt-4 text-xs text-white/30">
            <span>2–6 Players</span>
            <span>$10/$20 Blinds</span>
            <span>NL Hold'em</span>
          </div>
        </button>
      </div>
    </div>
  );
}
