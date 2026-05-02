import { useGameStore } from '../store/gameStore';
import { playButton } from '../lib/sounds';

function CardIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="w-14 h-14 mx-auto">
      <rect x="8" y="6" width="30" height="42" rx="4" fill="rgba(201,168,76,0.15)" stroke="#c9a84c" strokeWidth="1.5"/>
      <rect x="16" y="14" width="30" height="42" rx="4" fill="rgba(201,168,76,0.1)" stroke="rgba(201,168,76,0.5)" strokeWidth="1.5"/>
      <text x="13" y="26" fill="#c9a84c" fontSize="13" fontWeight="bold" fontFamily="serif">A</text>
      <text x="13" y="38" fill="#c9a84c" fontSize="10" fontFamily="serif">♠</text>
    </svg>
  );
}

function WheelIcon() {
  const segments = 18;
  const radius = 26;
  const cx = 32;
  const cy = 32;
  const paths: JSX.Element[] = [];

  for (let i = 0; i < segments; i++) {
    const startAngle = (i / segments) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((i + 1) / segments) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const isRed = i % 2 === 0 && i !== 0;
    const isGreen = i === 0;
    const fill = isGreen ? '#15803d' : isRed ? '#b91c1c' : '#1c1c1e';

    paths.push(
      <path
        key={i}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`}
        fill={fill}
        stroke="rgba(201,168,76,0.4)"
        strokeWidth="0.5"
      />
    );
  }

  return (
    <svg viewBox="0 0 64 64" fill="none" className="w-14 h-14 mx-auto">
      {paths}
      <circle cx={cx} cy={cy} r="8" fill="#0d1117" stroke="#c9a84c" strokeWidth="1.5"/>
      <circle cx={cx} cy={cy} r="3" fill="#c9a84c"/>
    </svg>
  );
}

function PokerIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" className="w-14 h-14 mx-auto opacity-40">
      <circle cx="32" cy="32" r="22" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" fill="rgba(255,255,255,0.03)"/>
      <text x="32" y="38" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="22" fontFamily="serif">♣</text>
    </svg>
  );
}

export function GameSelect() {
  const { setGameType } = useGameStore();

  const pick = (type: 'blackjack' | 'roulette') => {
    playButton();
    setGameType(type);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'radial-gradient(ellipse at 50% 20%, #0d2818 0%, #050d0a 100%)' }}
    >
      {/* Header */}
      <div className="text-center mb-14">
        <div className="flex justify-center gap-3 text-3xl mb-4 opacity-70">
          <span>♠</span><span className="text-red-500">♥</span><span className="text-red-500">♦</span><span>♣</span>
        </div>
        <h1 className="font-display text-6xl font-black text-gold tracking-tight leading-none">
          Casino Royale
        </h1>
        <p className="text-white/30 text-sm mt-3 tracking-[0.3em] uppercase">Choose Your Game</p>
      </div>

      {/* Game cards */}
      <div className="flex flex-col sm:flex-row gap-5 w-full max-w-2xl mb-5">

        {/* Blackjack */}
        <button
          onClick={() => pick('blackjack')}
          className="group flex-1 text-left rounded-2xl p-7 transition-all duration-300
                     hover:scale-[1.03] hover:-translate-y-1 active:scale-100 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0.03) 100%)',
            border: '1px solid rgba(201,168,76,0.25)',
            boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.border = '1px solid rgba(201,168,76,0.6)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 48px rgba(201,168,76,0.12), 0 0 0 1px rgba(201,168,76,0.1)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.border = '1px solid rgba(201,168,76,0.25)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 32px rgba(0,0,0,0.4)';
          }}
        >
          <CardIcon />
          <div className="mt-5">
            <div className="font-display text-2xl font-bold text-gold mb-1">Blackjack</div>
            <div className="text-white/40 text-sm leading-relaxed">
              Classic 21 — Beat the dealer with Vegas Strip rules. Split, double, insurance.
            </div>
            <div className="mt-5 flex gap-2 flex-wrap">
              {['2–6 Players', '$10–$1K Bets', '3:2 BJ', 'S17'].map(tag => (
                <span key={tag} className="text-[10px] text-gold/60 px-2 py-0.5 rounded-full"
                      style={{ border: '1px solid rgba(201,168,76,0.2)' }}>
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-gold text-sm font-medium group-hover:gap-3 transition-all">
              <span>Play Now</span>
              <span>→</span>
            </div>
          </div>
        </button>

        {/* Roulette */}
        <button
          onClick={() => pick('roulette')}
          className="group flex-1 text-left rounded-2xl p-7 transition-all duration-300
                     hover:scale-[1.03] hover:-translate-y-1 active:scale-100 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(185,28,28,0.10) 0%, rgba(185,28,28,0.04) 100%)',
            border: '1px solid rgba(185,28,28,0.3)',
            boxShadow: '0 4px 32px rgba(0,0,0,0.4)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.border = '1px solid rgba(239,68,68,0.6)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 48px rgba(185,28,28,0.18), 0 0 0 1px rgba(185,28,28,0.15)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.border = '1px solid rgba(185,28,28,0.3)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 32px rgba(0,0,0,0.4)';
          }}
        >
          <WheelIcon />
          <div className="mt-5">
            <div className="font-display text-2xl font-bold text-red-400 mb-1">Roulette</div>
            <div className="text-white/40 text-sm leading-relaxed">
              Spin the wheel — European single-zero roulette. Place inside and outside bets.
            </div>
            <div className="mt-5 flex gap-2 flex-wrap">
              {['2–8 Players', 'European 0–36', '35:1 Straight', '30s Betting'].map(tag => (
                <span key={tag} className="text-[10px] text-red-400/60 px-2 py-0.5 rounded-full"
                      style={{ border: '1px solid rgba(185,28,28,0.3)' }}>
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-red-400 text-sm font-medium group-hover:gap-3 transition-all">
              <span>Play Now</span>
              <span>→</span>
            </div>
          </div>
        </button>

      </div>

      {/* Coming soon: Poker */}
      <div
        className="w-full max-w-2xl rounded-2xl p-5 flex items-center gap-5 opacity-40 cursor-not-allowed"
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <PokerIcon />
        <div>
          <div className="font-display text-xl font-bold text-white/40">Poker</div>
          <div className="text-white/25 text-sm">Texas Hold'em — Coming Soon</div>
        </div>
        <div className="ml-auto">
          <span className="text-[10px] uppercase tracking-widest text-white/25 px-3 py-1 rounded-full"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            Soon
          </span>
        </div>
      </div>
    </div>
  );
}
