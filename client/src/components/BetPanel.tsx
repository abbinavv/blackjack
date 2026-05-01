import { useState } from 'react';
import { socket } from '../lib/socket';
import { useGameStore } from '../store/gameStore';
import { playChipClink, playButton } from '../lib/sounds';

const MIN_BET = 10;
const MAX_BET = 1000;

const CHIPS = [
  { value: 10,  label: '$10',  bg: '#e63946', border: '#ff6b6b' },
  { value: 25,  label: '$25',  bg: '#2ecc71', border: '#52e891' },
  { value: 100, label: '$100', bg: '#3498db', border: '#5eb8f7' },
  { value: 500, label: '$500', bg: '#c9a84c', border: '#f0d060' },
];

export function BetPanel() {
  const { gameState, roomCode, myId } = useGameStore();
  const [bet, setBet] = useState(0);
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  if (!gameState || !roomCode) return null;
  const me = gameState.players.find(p => p.id === myId);
  if (!me || me.hasBet) return null;

  const timeLeft = gameState.bettingTimeLeft;
  const pct = (timeLeft / 30) * 100;
  const canAffordMin = me.balance >= MIN_BET;

  const addChip = (value: number) => {
    const next = Math.min(bet + value, Math.min(me.balance, MAX_BET));
    setBet(next);
    playChipClink();
  };

  const applyQuick = (val: number) => {
    setBet(val);
    playChipClink();
  };

  const applyCustom = () => {
    const parsed = parseInt(customInput.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed) && parsed >= MIN_BET && parsed <= me.balance) {
      setBet(Math.min(parsed, MAX_BET <= me.balance ? MAX_BET : me.balance));
      playChipClink();
    }
    setCustomInput('');
    setShowCustom(false);
  };

  const placeBet = (amount: number) => {
    if (amount < MIN_BET || amount > me.balance) return;
    playButton();
    socket.emit('placeBet', { roomCode, amount });
    setBet(0);
  };

  const goAllIn = () => {
    playButton();
    // allIn: true tells server to use its own player.balance (guards against stale client state)
    socket.emit('placeBet', { roomCode, amount: me.balance, allIn: true });
    setBet(0);
  };

  const sitOut = () => {
    playButton();
    socket.emit('sitOut', { roomCode, sitOut: true });
  };

  // Player can't afford to bet
  if (!canAffordMin) {
    return (
      <div className="animate-slideUp flex flex-col items-center gap-3 p-4 rounded-2xl w-full max-w-xs mx-auto"
           style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="text-center">
          <div className="text-red-400 font-bold text-sm">Insufficient Balance</div>
          <div className="text-white/40 text-xs mt-0.5">Minimum bet is ${MIN_BET}</div>
          <div className="text-xs text-white/50 mt-1">Balance: <span className="text-gold">${me.balance}</span></div>
        </div>
        <button onClick={sitOut} className="btn-ghost w-full text-sm py-2.5">
          Sit Out This Round
        </button>
        <div className="text-xs text-white/30 text-center">You'll receive a $200 rebuy next round</div>
      </div>
    );
  }

  if (me.isSittingOut) {
    return (
      <div className="animate-slideUp flex flex-col items-center gap-2 py-3">
        <div className="text-white/50 text-sm">Sitting out this round</div>
        <button onClick={() => { playButton(); socket.emit('sitOut', { roomCode, sitOut: false }); }}
          className="text-xs text-gold underline hover:text-gold-light">
          Back In
        </button>
      </div>
    );
  }

  return (
    <div className="animate-slideUp flex flex-col items-center gap-3 p-4 rounded-2xl w-full max-w-sm mx-auto"
         style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>

      {/* Header row */}
      <div className="flex items-center justify-between w-full">
        <span className="text-xs text-white/50 uppercase tracking-widest font-bold">Place Bet</span>
        <div className="flex items-center gap-2">
          <div className="h-1 w-20 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${pct}%`, background: pct > 50 ? '#c9a84c' : pct > 25 ? '#f59e0b' : '#e63946' }} />
          </div>
          <span className={`text-xs font-bold tabular-nums w-6 text-right ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-gold'}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Bet amount display */}
      <div className="text-center leading-none">
        <div className="text-4xl font-black font-display tabular-nums"
             style={{ color: bet > 0 ? '#c9a84c' : 'rgba(255,255,255,0.15)' }}>
          ${bet.toLocaleString()}
        </div>
        <div className="text-xs text-white/35 mt-1">
          Balance: <span className="text-green-400 font-bold">${me.balance.toLocaleString()}</span>
          {me.balance > MAX_BET && <span className="text-white/25"> · max regular ${MAX_BET}</span>}
        </div>
      </div>

      {/* Chips */}
      <div className="flex gap-2 justify-center">
        {CHIPS.map(chip => {
          const canAdd = bet + chip.value <= Math.min(me.balance, MAX_BET);
          return (
            <button key={chip.value} onClick={() => addChip(chip.value)} disabled={!canAdd}
              className="chip" style={{ background: chip.bg, borderColor: chip.border, color: '#fff', opacity: canAdd ? 1 : 0.25 }}>
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Quick presets */}
      <div className="flex gap-1.5 flex-wrap justify-center">
        {[
          { label: 'Min', val: MIN_BET },
          { label: '¼', val: Math.floor(Math.min(me.balance, MAX_BET) / 4) },
          { label: '½', val: Math.floor(Math.min(me.balance, MAX_BET) / 2) },
          { label: 'Max', val: Math.min(me.balance, MAX_BET) },
        ].map(({ label, val }) => (
          <button key={label} onClick={() => applyQuick(val)}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors font-bold">
            {label}
          </button>
        ))}
        <button onClick={() => setShowCustom(v => !v)}
          className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors font-bold ${showCustom ? 'bg-gold/20 text-gold' : 'bg-white/10 hover:bg-white/20 text-white/70'}`}>
          #
        </button>
        <button onClick={() => { setBet(0); playChipClink(); }}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/50 hover:text-red-400 transition-colors">
          ✕
        </button>
      </div>

      {/* Custom amount input */}
      {showCustom && (
        <div className="flex gap-2 w-full animate-slideUp">
          <input
            type="number"
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyCustom()}
            placeholder={`${MIN_BET}–${Math.min(me.balance, MAX_BET).toLocaleString()}`}
            className="flex-1 px-3 py-2 rounded-lg text-sm text-white text-center font-bold
                       focus:outline-none focus:border-gold/50 transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
          />
          <button onClick={applyCustom}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-white/15 hover:bg-white/25 text-white transition-colors">
            Set
          </button>
        </div>
      )}

      {/* Place Bet + All In */}
      <div className="flex gap-2 w-full">
        <button onClick={() => placeBet(bet)} disabled={bet < MIN_BET}
          className="btn-primary flex-1 text-sm py-2.5 font-bold">
          Bet ${bet > 0 ? bet.toLocaleString() : '—'}
        </button>
        {me.balance > 0 && (
          <button onClick={goAllIn}
            className="px-4 py-2.5 rounded-lg text-sm font-black tracking-wide transition-all active:scale-95
                       border-2 border-red-500 text-red-400 hover:bg-red-500/20"
            title={`All In — $${me.balance.toLocaleString()}`}>
            ALL IN
          </button>
        )}
      </div>

      {/* Sit out link */}
      <button onClick={sitOut}
        className="text-xs text-white/30 hover:text-white/60 transition-colors">
        Sit out this round
      </button>
    </div>
  );
}
