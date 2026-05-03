import { useState, useCallback } from 'react';
import { RouletteBet, RouletteBetType } from '../types';
import { playRouletteChip } from '../lib/sounds';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function col(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED.has(n) ? 'red' : 'black';
}

function makeBetKey(type: RouletteBetType, numbers: number[]): string {
  return `${type}:${numbers.join(',')}`;
}

interface BetEntry { type: RouletteBetType; numbers: number[]; amount: number; }
interface Props { disabled: boolean; onBetsChange: (bets: BetEntry[]) => void; balance: number; cellSize?: number; edgeCellSize?: number; winningNumber?: number | null; }

function isOutsideWin(type: RouletteBetType, n: number): boolean {
  if (n === 0) return false;
  switch (type) {
    case 'red':   return col(n) === 'red';
    case 'black': return col(n) === 'black';
    case 'odd':   return n % 2 !== 0;
    case 'even':  return n % 2 === 0;
    case 'low':   return n >= 1 && n <= 18;
    case 'high':  return n >= 19 && n <= 36;
    default: return false;
  }
}

function isDozenWin(dozenNum: number, n: number): boolean {
  if (n === 0) return false;
  return Math.ceil(n / 12) === dozenNum;
}

function isColumnWin(colNum: number, n: number): boolean {
  if (n === 0) return false;
  return n % 3 === (colNum === 3 ? 0 : colNum);
}

const ROWS = [
  [3,6,9,12,15,18,21,24,27,30,33,36],
  [2,5,8,11,14,17,20,23,26,29,32,35],
  [1,4,7,10,13,16,19,22,25,28,31,34],
];

export function RouletteBetBoard({ disabled, onBetsChange, balance, cellSize = 44, edgeCellSize, winningNumber = null }: Props) {
  const N = cellSize;
  const Z = edgeCellSize ?? Math.max(28, Math.round(cellSize * 0.75));
  const C = Z;
  const SM = Math.max(24, Math.round(cellSize * 0.62));
  const TOTAL_W = Z + N * 12 + C;
  const [chipAmt, setChipAmt] = useState(10);
  const [bets, setBets] = useState<Map<string, BetEntry>>(new Map());

  const totalBet = Array.from(bets.values()).reduce((s, b) => s + b.amount, 0);

  const addBet = useCallback((type: RouletteBetType, numbers: number[]) => {
    if (disabled) return;
    const key = makeBetKey(type, numbers);
    setBets(prev => {
      const next = new Map(prev);
      const existing = next.get(key);
      const avail = balance - totalBet + (existing?.amount ?? 0);
      const add = Math.min(chipAmt, avail);
      if (add <= 0) return prev;
      next.set(key, existing
        ? { ...existing, amount: existing.amount + add }
        : { type, numbers, amount: add }
      );
      onBetsChange(Array.from(next.values()));
      playRouletteChip();
      return next;
    });
  }, [disabled, chipAmt, balance, totalBet, onBetsChange]);

  const clearBets = () => { setBets(new Map()); onBetsChange([]); };

  const betOn = (type: RouletteBetType, numbers: number[]) =>
    bets.get(makeBetKey(type, numbers))?.amount ?? 0;

  const Chip = ({ amount }: { amount: number }) => !amount ? null : (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black text-black"
        style={{
          background: 'radial-gradient(circle at 35% 35%, #f0d060, #c9a84c)',
          border: '1.5px solid #fff',
          boxShadow: '0 2px 5px rgba(0,0,0,0.7)',
        }}>
        {amount >= 1000 ? `${(amount / 1000).toFixed(0)}k` : amount}
      </div>
    </div>
  );

  const base = `relative flex items-center justify-center font-bold text-white
                cursor-pointer transition-colors duration-100 select-none
                border border-white/10 text-xs`;
  const dis = disabled ? 'pointer-events-none opacity-60' : '';

  return (
    <div className={`flex flex-col gap-2 select-none ${dis}`} style={{ width: TOTAL_W }}>

      {/* Chip selector */}
      <div className="flex items-center gap-2">
        <span className="text-white/30 text-[10px] uppercase tracking-wider">Chip</span>
        {[5, 10, 25, 50, 100].map(v => (
          <button key={v} onClick={() => setChipAmt(v)}
            className={`w-8 h-8 rounded-full text-[11px] font-black transition-all
              ${chipAmt === v ? 'bg-gold text-black scale-110 shadow-lg' : 'bg-zinc-800 text-white/60 hover:bg-zinc-700'}`}>
            {v}
          </button>
        ))}
        {totalBet > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-gold text-xs font-bold">${totalBet}</span>
            <button onClick={clearBets}
              className="text-white/30 hover:text-white/70 text-[10px] px-2 py-0.5 rounded border border-white/10">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Main grid */}
      <div style={{
        display: 'grid',
        width: TOTAL_W,
        gridTemplateColumns: `${Z}px repeat(12, ${N}px) ${C}px`,
        gridTemplateRows: `repeat(3, ${N}px)`,
        border: '1px solid rgba(201,168,76,0.3)',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        {/* Zero — spans all 3 rows */}
        <button
          onClick={() => addBet('straight', [0])}
          className={`${base} text-base font-black ${winningNumber === 0 ? 'animate-winCell' : ''}`}
          style={{
            gridRow: '1 / 4',
            gridColumn: '1',
            background: winningNumber === 0 ? '#15803d' : '#166534',
            borderRight: '2px solid rgba(201,168,76,0.4)',
            height: N * 3,
            outline: winningNumber === 0 ? '2px solid rgba(201,168,76,0.8)' : undefined,
            zIndex: winningNumber === 0 ? 1 : undefined,
          }}
        >
          0
          <Chip amount={betOn('straight', [0])} />
        </button>

        {/* Number cells */}
        {ROWS.map((row, rowIdx) =>
          row.map((n, colIdx) => {
            const c = col(n);
            const isWinner = winningNumber != null && n === winningNumber;
            const bg  = isWinner ? (c === 'red' ? '#b91c1c' : '#3a3a3e') : (c === 'red' ? '#7f1d1d' : '#1c1c1e');
            const bgH = c === 'red' ? '#991b1b' : '#2d2d30';
            const bet = betOn('straight', [n]);
            return (
              <button key={n}
                onClick={() => addBet('straight', [n])}
                className={`${base} ${isWinner ? 'animate-winCell' : ''}`}
                style={{
                  gridRow: rowIdx + 1, gridColumn: colIdx + 2,
                  background: bg, width: N, height: N,
                  outline: isWinner ? '2px solid rgba(201,168,76,0.8)' : undefined,
                  zIndex: isWinner ? 1 : undefined,
                }}
                onMouseEnter={e => { if (!isWinner) (e.currentTarget as HTMLElement).style.background = bgH; }}
                onMouseLeave={e => { if (!isWinner) (e.currentTarget as HTMLElement).style.background = bg; }}
              >
                {n}
                <Chip amount={bet} />
              </button>
            );
          })
        )}

        {/* 2:1 column bets — one per row */}
        {[
          { label: '2:1', type: 'column' as RouletteBetType, numbers: [3] },
          { label: '2:1', type: 'column' as RouletteBetType, numbers: [2] },
          { label: '2:1', type: 'column' as RouletteBetType, numbers: [1] },
        ].map((cb, i) => {
          const isWinner = winningNumber != null && isColumnWin(cb.numbers[0], winningNumber);
          return (
            <button key={i}
              onClick={() => addBet(cb.type, cb.numbers)}
              className={`${base} text-gold/80 text-[10px] ${isWinner ? 'animate-winCell' : ''}`}
              style={{
                gridRow: i + 1,
                gridColumn: '14',
                background: isWinner ? 'rgba(201,168,76,0.2)' : '#1c2a1c',
                width: C, height: N,
                borderLeft: '2px solid rgba(201,168,76,0.4)',
                outline: isWinner ? '2px solid rgba(201,168,76,0.7)' : undefined,
              }}
            >
              2:1
              <Chip amount={betOn(cb.type, cb.numbers)} />
            </button>
          );
        })}
      </div>

      {/* Dozens row */}
      <div style={{
        display: 'grid',
        width: TOTAL_W,
        gridTemplateColumns: `${Z}px repeat(3, ${N * 4}px) ${C}px`,
        gridTemplateRows: `${SM}px`,
        border: '1px solid rgba(201,168,76,0.2)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{ background: '#0d1f14' }} />
        {[
          { label: '1st 12', type: 'dozen' as RouletteBetType, numbers: [1] },
          { label: '2nd 12', type: 'dozen' as RouletteBetType, numbers: [2] },
          { label: '3rd 12', type: 'dozen' as RouletteBetType, numbers: [3] },
        ].map(db => {
          const isWinner = winningNumber != null && isDozenWin(db.numbers[0], winningNumber);
          return (
            <button key={db.label}
              onClick={() => addBet(db.type, db.numbers)}
              className={`${base} text-white/60 text-[11px] ${isWinner ? 'animate-winCell' : ''}`}
              style={{
                background: isWinner ? 'rgba(201,168,76,0.18)' : '#1a2e1a',
                height: SM, borderRight: '1px solid rgba(255,255,255,0.08)',
                outline: isWinner ? '2px solid rgba(201,168,76,0.7)' : undefined,
              }}
            >
              {db.label}
              <Chip amount={betOn(db.type, db.numbers)} />
            </button>
          );
        })}
        <div style={{ background: '#0d1f14' }} />
      </div>

      {/* Outside bets row */}
      <div style={{
        display: 'grid',
        width: TOTAL_W,
        gridTemplateColumns: `${Z}px repeat(6, ${N * 2}px) ${C}px`,
        gridTemplateRows: `${SM}px`,
        border: '1px solid rgba(201,168,76,0.2)',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        <div style={{ background: '#0d1f14' }} />
        {[
          { label: '1–18',    type: 'low' as RouletteBetType,   bg: '#1a2e1a' },
          { label: 'Even',    type: 'even' as RouletteBetType,  bg: '#1a2e1a' },
          { label: '● Red',   type: 'red' as RouletteBetType,   bg: '#7f1d1d' },
          { label: '● Black', type: 'black' as RouletteBetType, bg: '#1c1c1e' },
          { label: 'Odd',     type: 'odd' as RouletteBetType,   bg: '#1a2e1a' },
          { label: '19–36',   type: 'high' as RouletteBetType,  bg: '#1a2e1a' },
        ].map(ob => {
          const isWinner = winningNumber != null && isOutsideWin(ob.type, winningNumber);
          return (
            <button key={ob.type}
              onClick={() => addBet(ob.type, [])}
              className={`${base} text-white/80 text-[11px] hover:brightness-125 ${isWinner ? 'animate-winCell' : ''}`}
              style={{
                background: isWinner ? (ob.type === 'red' ? '#991b1b' : ob.type === 'black' ? '#3a3a3e' : 'rgba(201,168,76,0.18)') : ob.bg,
                height: SM, borderRight: '1px solid rgba(255,255,255,0.08)',
                outline: isWinner ? '2px solid rgba(201,168,76,0.7)' : undefined,
              }}
            >
              {ob.label}
              <Chip amount={betOn(ob.type, [])} />
            </button>
          );
        })}
        <div style={{ background: '#0d1f14' }} />
      </div>
    </div>
  );
}
