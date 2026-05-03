interface GameSelectProps {
  onSelectGame: (game: 'blackjack' | 'roulette' | 'poker') => void;
}

const GAMES = [
  {
    id: 'blackjack' as const,
    icon: '♠',
    title: 'Blackjack',
    subtitle: 'Vegas Strip Rules',
    specs: ['2 – 6 Players', '3 : 2 BJ', 'S17'],
    accent: 'rgba(201,168,76,0.18)',
    border: 'rgba(201,168,76,0.35)',
    glow: 'rgba(201,168,76,0.12)',
  },
  {
    id: 'roulette' as const,
    icon: '◉',
    title: 'Roulette',
    subtitle: 'European Wheel',
    specs: ['2 – 8 Players', '37 Numbers', '2.7% Edge'],
    accent: 'rgba(180,30,30,0.18)',
    border: 'rgba(220,60,60,0.35)',
    glow: 'rgba(200,40,40,0.1)',
  },
  {
    id: 'poker' as const,
    icon: '♣',
    title: "Texas Hold'em",
    subtitle: 'No-Limit Poker',
    specs: ['2 – 6 Players', '$10 / $20 Blinds', 'NL Hold\'em'],
    accent: 'rgba(40,120,200,0.18)',
    border: 'rgba(60,140,220,0.35)',
    glow: 'rgba(40,100,200,0.1)',
  },
];

export function GameSelect({ onSelectGame }: GameSelectProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: 'radial-gradient(ellipse at 50% 20%, #0d2118 0%, #050d0a 100%)',
      }}
    >
      {/* Header */}
      <div className="text-center mb-10">
        {/* Decorative suit row */}
        <div className="flex justify-center gap-3 mb-4">
          {['♠', '♥', '♣', '♦'].map((s, i) => (
            <span
              key={s}
              style={{
                fontSize: 22,
                color: i % 2 === 0 ? 'rgba(201,168,76,0.7)' : 'rgba(200,40,40,0.7)',
                filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
              }}
            >{s}</span>
          ))}
        </div>

        <h1
          className="font-display font-black tracking-tight"
          style={{
            fontSize: 'clamp(2.2rem, 6vw, 3.5rem)',
            background: 'linear-gradient(135deg, #e0c068 0%, #c9a84c 45%, #a07830 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '-0.01em',
          }}
        >
          Casino Night
        </h1>
        <p className="text-white/30 text-xs mt-2 tracking-[0.25em] uppercase">
          Choose Your Game
        </p>

        {/* Decorative rule */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/40" />
          <div className="w-1.5 h-1.5 rounded-full bg-gold/40" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/40" />
        </div>
      </div>

      {/* Game cards */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl">
        {GAMES.map((game, index) => (
          <button
            key={game.id}
            onClick={() => onSelectGame(game.id)}
            className="flex-1 rounded-2xl text-left cursor-pointer
                       transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]
                       hover:-translate-y-1 animate-fadeIn"
            style={{
              background: game.accent,
              border: `1px solid ${game.border}`,
              padding: '28px 22px 22px',
              boxShadow: `0 8px 32px ${game.glow}, 0 2px 8px rgba(0,0,0,0.4)`,
              animationDelay: `${index * 120}ms`,
            }}
          >
            {/* Icon */}
            <div
              style={{
                fontSize: 36,
                marginBottom: 14,
                color: game.id === 'roulette' ? '#e05555' : game.id === 'poker' ? '#5b9bd5' : '#c9a84c',
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))',
                lineHeight: 1,
              }}
            >
              {game.icon}
            </div>

            {/* Title */}
            <div className="font-display font-bold text-xl text-white mb-0.5">
              {game.title}
            </div>
            <div className="text-white/40 text-xs mb-4">{game.subtitle}</div>

            {/* Divider */}
            <div className="h-px bg-white/10 mb-3" />

            {/* Specs */}
            <div className="flex flex-col gap-1">
              {game.specs.map(s => (
                <div key={s} className="flex items-center gap-2 text-xs text-white/45">
                  <span style={{ color: game.id === 'roulette' ? '#e05555' : game.id === 'poker' ? '#5b9bd5' : '#c9a84c', fontSize: 8 }}>◆</span>
                  {s}
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>

      <p className="text-white/15 text-xs mt-8 tracking-widest">
        MULTIPLAYER · FREE TO PLAY
      </p>
    </div>
  );
}
