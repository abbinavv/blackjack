import { useState, useRef } from 'react';
import { socket } from '../lib/socket';
import { useGameStore } from '../store/gameStore';
import type { PublicGameState } from '../types';
import { playChipClink, playButton, playAllIn } from '../lib/sounds';

const MIN_BET = 10;
const MAX_BET = 1000;

const CHIPS = [
  { value: 10,  label: '$10',  bg: '#e63946', border: '#ff6b6b' },
  { value: 25,  label: '$25',  bg: '#2ecc71', border: '#52e891' },
  { value: 100, label: '$100', bg: '#3498db', border: '#5eb8f7' },
  { value: 500, label: '$500', bg: '#c9a84c', border: '#f0d060' },
];

export function BetPanel() {
  const { gameState: _gameState, roomCode, myId } = useGameStore();
  const gameState = _gameState as PublicGameState | null;
  const [bet, setBet] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  if (!gameState || !roomCode) return null;
  const me = gameState.players.find(p => p.id === myId);
  if (!me || me.hasBet) return null;

  const timeLeft = gameState.bettingTimeLeft;
  const pct = (timeLeft / 30) * 100;
  const canAffordMin = me.balance >= MIN_BET;
  const effectiveMax = Math.min(me.balance, MAX_BET);

  const setAndSync = (val: number) => {
    setBet(val);
    setInputVal(val > 0 ? String(val) : '');
  };

  const addChip = (value: number) => {
    const next = Math.min(bet + value, effectiveMax);
    setAndSync(next);
    playChipClink();
  };

  const handleInputChange = (raw: string) => {
    setInputVal(raw);
    const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(n)) {
      setBet(Math.min(n, me.balance)); // allow typing above MAX_BET (will be validated on submit)
    } else if (raw === '') {
      setBet(0);
    }
  };

  const handleInputBlur = () => {
    // Clamp to valid range on blur
    const clamped = Math.max(0, Math.min(bet, me.balance));
    setAndSync(clamped);
  };

  const placeBet = (amount: number, allIn = false) => {
    if (amount < MIN_BET || amount > me.balance) return;
    if (allIn) playAllIn(); else playButton();
    socket.emit('placeBet', { roomCode, amount, allIn });
    setAndSync(0);
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
          <div className="text-green-400 font-bold text-sm mt-1">${me.balance} remaining</div>
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

  const betIsValid = bet >= MIN_BET && bet <= me.balance;

  return (
    <div className="animate-slideUp flex flex-col items-center gap-3 p-4 rounded-2xl w-full max-w-sm mx-auto"
         style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}>

      {/* Header */}
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

      {/* Direct bet amount input — always visible */}
      <div className="w-full">
        <div className="relative flex items-center">
          <span className="absolute left-3 text-xl font-black text-gold pointer-events-none">$</span>
          <input
            ref={inputRef}
            type="number"
            min={MIN_BET}
            max={me.balance}
            value={inputVal}
            onChange={e => handleInputChange(e.target.value)}
            onBlur={handleInputBlur}
            onFocus={e => e.target.select()}
            placeholder="0"
            className="w-full pl-8 pr-4 py-3 rounded-xl text-2xl font-black text-center tabular-nums
                       text-gold focus:outline-none transition-colors"
            style={{
              background: 'rgba(201,168,76,0.08)',
              border: `1px solid ${betIsValid ? 'rgba(201,168,76,0.4)' : 'rgba(255,255,255,0.1)'}`,
            }}
          />
          {bet > 0 && (
            <button onClick={() => setAndSync(0)}
              className="absolute right-3 text-white/30 hover:text-red-400 text-lg leading-none">
              ✕
            </button>
          )}
        </div>
        <div className="flex justify-between text-xs mt-1 px-1">
          <span className="text-white/30">min ${MIN_BET}</span>
          <span className="text-green-400/70">balance ${me.balance.toLocaleString()}</span>
        </div>
      </div>

      {/* Chips */}
      <div className="flex gap-2 justify-center">
        {CHIPS.map(chip => {
          const canAdd = bet + chip.value <= me.balance;
          return (
            <button key={chip.value} onClick={() => addChip(chip.value)} disabled={!canAdd}
              className="chip" style={{ background: chip.bg, borderColor: chip.border, color: '#fff', opacity: canAdd ? 1 : 0.25 }}>
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Quick presets */}
      <div className="flex gap-1.5 justify-center">
        {[
          { label: 'Min', val: MIN_BET },
          { label: '¼', val: Math.floor(effectiveMax / 4) },
          { label: '½', val: Math.floor(effectiveMax / 2) },
          { label: 'Max', val: effectiveMax },
        ].map(({ label, val }) => (
          <button key={label} onClick={() => { setAndSync(val); playChipClink(); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors font-bold">
            {label}
          </button>
        ))}
      </div>

      {/* Place Bet + All In row */}
      <div className="flex gap-2 w-full">
        <button
          onClick={() => placeBet(bet)}
          disabled={!betIsValid}
          className="btn-primary flex-1 text-sm py-2.5 font-bold"
        >
          {betIsValid ? `Bet $${bet.toLocaleString()}` : 'Place Bet'}
        </button>
        <button
          onClick={() => placeBet(me.balance, true)}
          className="px-4 py-2.5 rounded-lg text-sm font-black tracking-wide transition-all active:scale-95
                     border-2 border-red-500 text-red-400 hover:bg-red-500/20"
          title={`All In — $${me.balance.toLocaleString()}`}
        >
          ALL IN<br/>
          <span className="text-[10px] font-bold opacity-70">${me.balance.toLocaleString()}</span>
        </button>
      </div>

      {/* Sit out */}
      <button onClick={sitOut}
        className="text-xs text-white/25 hover:text-white/50 transition-colors">
        Sit out this round
      </button>
    </div>
  );
}
