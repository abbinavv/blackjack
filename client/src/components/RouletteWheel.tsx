import { useEffect, useRef, useState } from 'react';
import { RoulettePhase } from '../types';
import { playRouletteWheelSpin, playRouletteBallDrop } from '../lib/sounds';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function numberColor(n: number): 'red' | 'black' | 'green' {
  if (n === 0) return 'green';
  return RED.has(n) ? 'red' : 'black';
}

const WHEEL_ORDER = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
];

interface RouletteWheelProps {
  phase: RoulettePhase;
  spinResult: number | null;
  history: number[];
  size?: number;
}

export function RouletteWheel({ phase, spinResult, history, size = 240 }: RouletteWheelProps) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const prevPhase = useRef<RoulettePhase>(phase);
  const rotRef = useRef(0);

  useEffect(() => {
    if (prevPhase.current === phase) return;
    if (phase === 'spinning') {
      setSpinning(true);
      const newRot = rotRef.current + (5 + Math.random() * 5) * 360;
      rotRef.current = newRot;
      setRotation(newRot);
      playRouletteWheelSpin(3000);
    } else if (phase === 'complete') {
      setSpinning(false);
      playRouletteBallDrop();
    }
    prevPhase.current = phase;
  }, [phase]);

  const resultColor = spinResult !== null ? numberColor(spinResult) : null;
  // font size scales with wheel: bigger wheel = bigger text (in SVG units)
  const fontSize = 5.8;
  const textRadius = 37;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Wheel */}
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-full" style={{
          background: 'radial-gradient(circle, #2d1a00 60%, #c9a84c 100%)',
          boxShadow: '0 0 32px rgba(201,168,76,0.3), inset 0 0 16px rgba(0,0,0,0.8)',
        }} />
        {/* Outer number ring (static labels visible even without spin) */}
        <div className="absolute rounded-full overflow-hidden" style={{
          inset: size * 0.035,
          transition: spinning ? 'transform 3s cubic-bezier(0.17,0.67,0.12,1)' : 'none',
          transform: `rotate(${rotation}deg)`,
        }}>
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {WHEEL_ORDER.map((num, i) => {
              const total = WHEEL_ORDER.length;
              const s = (i / total) * 2 * Math.PI - Math.PI / 2;
              const e = ((i + 1) / total) * 2 * Math.PI - Math.PI / 2;
              const x1 = 50 + 48 * Math.cos(s), y1 = 50 + 48 * Math.sin(s);
              const x2 = 50 + 48 * Math.cos(e), y2 = 50 + 48 * Math.sin(e);
              const c = numberColor(num);
              const fill = c === 'green' ? '#166534' : c === 'red' ? '#b91c1c' : '#18181b';
              const mid = (s + e) / 2;
              const tx = 50 + textRadius * Math.cos(mid);
              const ty = 50 + textRadius * Math.sin(mid);
              return (
                <g key={i}>
                  <path d={`M 50 50 L ${x1} ${y1} A 48 48 0 0 1 ${x2} ${y2} Z`}
                    fill={fill} stroke="rgba(201,168,76,0.4)" strokeWidth="0.4" />
                  {/* Separator lines */}
                  <line x1="50" y1="50" x2={x1} y2={y1}
                    stroke="rgba(201,168,76,0.25)" strokeWidth="0.3" />
                  <text
                    x={tx} y={ty}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="white" fontSize={fontSize} fontWeight="bold"
                    fontFamily="Arial, sans-serif"
                    transform={`rotate(${(mid * 180 / Math.PI) + 90}, ${tx}, ${ty})`}
                  >
                    {num}
                  </text>
                </g>
              );
            })}
            {/* Inner decorative rings */}
            <circle cx="50" cy="50" r="20" fill="#1a0e00" stroke="rgba(201,168,76,0.5)" strokeWidth="0.6"/>
            <circle cx="50" cy="50" r="14" fill="#0d0700" stroke="rgba(201,168,76,0.4)" strokeWidth="0.5"/>
            <circle cx="50" cy="50" r="8"  fill="#050300" stroke="rgba(201,168,76,0.6)" strokeWidth="0.8"/>
            <circle cx="50" cy="50" r="4"  fill="#c9a84c"/>
            <circle cx="50" cy="50" r="2"  fill="#7a5f1a"/>
          </svg>
        </div>
        {/* Ball pointer */}
        <div className="absolute left-1/2 -translate-x-1/2 rounded-full z-10"
          style={{
            top: size * 0.025,
            width: size * 0.055,
            height: size * 0.055,
            background: 'radial-gradient(circle at 35% 35%, #ffffff, #cccccc)',
            boxShadow: '0 0 6px rgba(255,255,255,0.9)',
          }} />
      </div>

      {/* Result */}
      <div className="flex flex-col items-center gap-1">
        {phase === 'complete' && spinResult !== null && (
          <>
            <div className="text-white/30 text-[9px] uppercase tracking-widest">Result</div>
            <div className="flex items-center justify-center font-black font-mono rounded-full"
              style={{
                width: size * 0.35, height: size * 0.35,
                fontSize: size * 0.18,
                background: resultColor === 'red' ? '#7f1d1d' : resultColor === 'green' ? '#14532d' : '#1c1c1e',
                border: '2px solid rgba(201,168,76,0.5)',
                boxShadow: '0 0 20px rgba(201,168,76,0.2)',
                color: 'white',
              }}>
              {spinResult}
            </div>
            <div className={`text-[11px] uppercase tracking-widest font-bold ${
              resultColor === 'red' ? 'text-red-400' :
              resultColor === 'green' ? 'text-green-400' : 'text-zinc-300'}`}>
              {resultColor}
            </div>
          </>
        )}
        {phase === 'spinning' && (
          <div className="text-white/40 text-xs animate-pulse tracking-widest uppercase">Spinning...</div>
        )}
        {phase === 'betting' && (
          <div className="text-white/20 text-[10px] tracking-widest uppercase">Place your bets</div>
        )}
      </div>

      {/* History dots */}
      {history.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap justify-center" style={{ maxWidth: size }}>
          {history.slice(0, 10).map((n, i) => {
            const c = numberColor(n);
            return (
              <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                style={{
                  background: c === 'red' ? '#7f1d1d' : c === 'green' ? '#14532d' : '#27272a',
                  opacity: 1 - i * 0.08,
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                {n}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
