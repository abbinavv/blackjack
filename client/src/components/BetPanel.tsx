import { useState } from 'react';
import { socket } from '../lib/socket';
import { useGameStore } from '../store/gameStore';
import { playChipClink, playButton } from '../lib/sounds';

const CHIPS = [
  { value: 10,  label: '$10',  bg: '#e63946', border: '#ff6b6b', text: '#fff' },
  { value: 25,  label: '$25',  bg: '#2ecc71', border: '#52e891', text: '#fff' },
  { value: 50,  label: '$50',  bg: '#3498db', border: '#5eb8f7', text: '#fff' },
  { value: 100, label: '$100', bg: '#1a1a2e', border: '#4a4a6e', text: '#f1faee' },
  { value: 500, label: '$500', bg: '#7c3aed', border: '#a855f7', text: '#fff' },
];

export function BetPanel() {
  const { gameState, roomCode, myId } = useGameStore();
  const [bet, setBet] = useState(0);

  if (!gameState || !roomCode) return null;

  const me = gameState.players.find(p => p.id === myId);
  if (!me || me.hasBet || me.isSittingOut) return null;

  const timeLeft = gameState.bettingTimeLeft;
  const pct = (timeLeft / 30) * 100;

  const addChip = (value: number) => {
    const next = bet + value;
    if (next > 500 || next > me.balance) return;
    setBet(next);
    playChipClink();
  };

  const placeBet = () => {
    if (bet < 10) return;
    playButton();
    socket.emit('placeBet', { roomCode, amount: bet });
    setBet(0);
  };

  const clear = () => {
    setBet(0);
    playButton();
  };

  return (
    <div className="animate-slideUp flex flex-col items-center gap-4 p-5 rounded-2xl"
         style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>

      {/* Timer */}
      <div className="flex items-center gap-3 w-full justify-between">
        <span className="text-xs text-white/50 uppercase tracking-widest">Place your bet</span>
        <div className="flex items-center gap-2">
          <div className="h-1 w-24 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${pct}%`,
                background: pct > 50 ? '#c9a84c' : pct > 25 ? '#f59e0b' : '#e63946',
              }}
            />
          </div>
          <span className={`text-xs font-bold tabular-nums ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-gold'}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Current bet display */}
      <div className="text-center">
        <div className="text-3xl font-bold font-display" style={{ color: bet > 0 ? '#c9a84c' : 'rgba(255,255,255,0.2)' }}>
          ${bet}
        </div>
        <div className="text-xs text-white/40 mt-0.5">Balance: ${me.balance.toLocaleString()}</div>
      </div>

      {/* Chips */}
      <div className="flex gap-2 flex-wrap justify-center">
        {CHIPS.map(chip => {
          const canAdd = bet + chip.value <= 500 && bet + chip.value <= me.balance;
          return (
            <button
              key={chip.value}
              onClick={() => addChip(chip.value)}
              disabled={!canAdd}
              className="chip"
              style={{
                background: chip.bg,
                borderColor: chip.border,
                color: chip.text,
                opacity: canAdd ? 1 : 0.35,
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Quick bet buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => { setBet(0); setBet(Math.min(10, me.balance)); playChipClink(); }}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
        >
          Min
        </button>
        <button
          onClick={() => { const h = Math.floor(Math.min(me.balance, 500) / 2); setBet(h); playChipClink(); }}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
        >
          Half
        </button>
        <button
          onClick={() => { setBet(Math.min(me.balance, 500)); playChipClink(); }}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
        >
          Max
        </button>
        <button onClick={clear} className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-colors">
          Clear
        </button>
      </div>

      {/* Place bet */}
      <button
        onClick={placeBet}
        disabled={bet < 10}
        className="btn-primary w-full text-base"
      >
        Place Bet — ${bet}
      </button>
    </div>
  );
}
