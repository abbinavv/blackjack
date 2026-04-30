import { useState } from 'react';
import { socket } from '../lib/socket';
import { useGameStore } from '../store/gameStore';
import { playChipClink, playButton } from '../lib/sounds';

const CHIPS = [
  { value: 10,   label: '$10',   bg: '#e63946', border: '#ff6b6b' },
  { value: 25,   label: '$25',   bg: '#2ecc71', border: '#52e891' },
  { value: 100,  label: '$100',  bg: '#3498db', border: '#5eb8f7' },
  { value: 500,  label: '$500',  bg: '#1a1a2e', border: '#4a4a6e' },
  { value: 1000, label: '$1K',   bg: '#7c3aed', border: '#a855f7' },
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
    if (next > me.balance) return;
    setBet(next);
    playChipClink();
  };

  const placeBet = () => {
    if (bet < 10) return;
    playButton();
    socket.emit('placeBet', { roomCode, amount: bet });
    setBet(0);
  };

  return (
    <div className="animate-slideUp flex flex-col items-center gap-3 p-4 rounded-2xl w-full max-w-sm mx-auto"
         style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>

      {/* Timer */}
      <div className="flex items-center gap-2 w-full justify-between">
        <span className="text-xs text-white/50 uppercase tracking-widest">Place Bet</span>
        <div className="flex items-center gap-2">
          <div className="h-1 w-20 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${pct}%`, background: pct > 50 ? '#c9a84c' : pct > 25 ? '#f59e0b' : '#e63946' }} />
          </div>
          <span className={`text-xs font-bold tabular-nums w-6 ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-gold'}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Bet display */}
      <div className="text-center">
        <div className="text-3xl font-bold font-display" style={{ color: bet > 0 ? '#c9a84c' : 'rgba(255,255,255,0.2)' }}>
          ${bet.toLocaleString()}
        </div>
        <div className="text-xs text-white/40 mt-0.5">Balance: ${me.balance.toLocaleString()}</div>
      </div>

      {/* Chips */}
      <div className="flex gap-2 flex-wrap justify-center">
        {CHIPS.map(chip => {
          const canAdd = bet + chip.value <= me.balance;
          return (
            <button key={chip.value} onClick={() => addChip(chip.value)} disabled={!canAdd}
              className="chip" style={{ background: chip.bg, borderColor: chip.border, color: '#fff', opacity: canAdd ? 1 : 0.3 }}>
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Quick bets */}
      <div className="flex gap-2">
        {[
          { label: 'Min', action: () => setBet(10) },
          { label: '½', action: () => setBet(Math.floor(me.balance / 2)) },
          { label: 'Max', action: () => setBet(me.balance) },
          { label: '✕', action: () => setBet(0) },
        ].map(({ label, action }) => (
          <button key={label} onClick={() => { action(); playChipClink(); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-colors">
            {label}
          </button>
        ))}
      </div>

      <button onClick={placeBet} disabled={bet < 10} className="btn-primary w-full text-sm py-2.5">
        Place Bet — ${bet.toLocaleString()}
      </button>
    </div>
  );
}
