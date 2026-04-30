import { useState } from 'react';
import { socket } from '../lib/socket';
import { useGameStore } from '../store/gameStore';
import { playChipClink, playButton } from '../lib/sounds';

export function InsurancePanel() {
  const { gameState, roomCode, myId } = useGameStore();
  const [amount, setAmount] = useState(0);

  if (!gameState || !roomCode) return null;
  if (gameState.phase !== 'insurance') return null;

  const me = gameState.players.find(p => p.id === myId);
  if (!me || me.hasActedOnInsurance || me.isSittingOut || me.hands.length === 0) return null;

  const maxInsurance = Math.floor(me.hands[0].bet / 2);
  const pct = (gameState.insuranceTimeLeft / 10) * 100;

  const submit = (ins: number) => {
    playButton();
    socket.emit('placeInsurance', { roomCode, amount: ins });
    setAmount(0);
  };

  return (
    <div className="animate-slideUp flex flex-col items-center gap-4 p-5 rounded-2xl max-w-xs w-full"
         style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(201,168,76,0.4)' }}>

      <div className="flex items-center gap-3 w-full justify-between">
        <span className="text-sm font-bold text-gold">Insurance?</span>
        <div className="flex items-center gap-2">
          <div className="h-1 w-20 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${pct}%`, background: pct > 40 ? '#c9a84c' : '#e63946' }}
            />
          </div>
          <span className={`text-xs font-bold ${gameState.insuranceTimeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-gold'}`}>
            {gameState.insuranceTimeLeft}s
          </span>
        </div>
      </div>

      <p className="text-xs text-white/60 text-center leading-relaxed">
        Dealer shows <span className="text-gold font-bold">Ace</span>. Insurance pays{' '}
        <span className="text-white font-bold">2:1</span> if dealer has Blackjack.
        <br />Max bet: <span className="text-gold">${maxInsurance}</span>
      </p>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={maxInsurance}
          step={5}
          value={amount}
          onChange={e => { setAmount(Number(e.target.value)); playChipClink(); }}
          className="w-32 accent-gold"
        />
        <span className="text-gold font-bold text-sm w-12">${amount}</span>
      </div>

      <div className="flex gap-2 w-full">
        <button
          onClick={() => submit(amount)}
          disabled={amount <= 0}
          className="btn-primary flex-1 text-sm py-2"
        >
          Insure ${amount}
        </button>
        <button onClick={() => submit(0)} className="btn-ghost flex-1 text-sm py-2">
          No Thanks
        </button>
      </div>
    </div>
  );
}
