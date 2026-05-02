import { useState, useEffect, useCallback, useRef } from 'react';
import { socket } from '../lib/socket';
import { useGameStore, clearSession, saveBalance } from '../store/gameStore';
import { RoulettePublicGameState, RouletteBet } from '../types';
import { RouletteWheel } from './RouletteWheel';
import { RouletteBetBoard } from './RouletteBetBoard';
import { ToastContainer } from './Toast';
import { playButton, playWin, playLose } from '../lib/sounds';

// ── Dynamic layout calculation ────────────────────────────────────────────────
// Adapts cell sizes, panel widths to any landscape window — no hardcoded breakpoints
interface Layout {
  cellSize: number;    // px per number cell
  edgeCell: number;   // px for 0 and 2:1 columns
  rightPanel: number; // wheel panel width
  wheelSize: number;  // wheel diameter
  boardPadX: number;  // horizontal padding around board area
}

function calcLayout(): Layout {
  const w = window.innerWidth;
  const h = window.innerHeight;

  const rightPanel = Math.min(280, Math.max(180, Math.round(w * 0.22)));
  const boardPadX  = Math.max(8, Math.round(w * 0.015));
  const edgeCell   = Math.max(28, Math.round(w * 0.032));
  const available  = w - rightPanel - boardPadX * 2;
  const cellSize   = Math.max(30, Math.min(58, Math.floor((available - edgeCell * 2) / 12)));
  const wheelSize  = Math.max(140, Math.min(240, Math.round(h * 0.52)));

  return { cellSize, edgeCell, rightPanel, wheelSize, boardPadX };
}

function useLayout() {
  const [layout, setLayout] = useState(calcLayout);
  useEffect(() => {
    const fn = () => setLayout(calcLayout());
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return layout;
}

function useIsPortrait() {
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth);
  useEffect(() => {
    const fn = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return portrait;
}

// ── Rotate prompt ─────────────────────────────────────────────────────────────
function RotatePrompt() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5"
      style={{ background: '#0b1d10' }}>
      <div className="text-7xl" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>📱</div>
      <div className="font-display text-2xl text-gold font-bold text-center px-8">Rotate to Landscape</div>
      <div className="text-white/40 text-sm text-center px-10 leading-relaxed max-w-xs">
        Roulette needs landscape mode so the full betting table is visible
      </div>
      <div className="text-white/20 text-xs tracking-widest">↺ Turn your device sideways</div>
    </div>
  );
}

// ── How-to-play modal ─────────────────────────────────────────────────────────
const RULES = [
  { title: 'Objective', body: 'Predict where the ball lands on the wheel (0–36). Place bets before the spin — win based on your prediction.' },
  { title: 'The Wheel', body: 'European roulette: 37 pockets — 0 (green) and 1–36 (red or black). House edge 2.7%.' },
  {
    title: 'Bet Types & Payouts',
    list: [
      ['Straight',  '1 number',           '35 : 1'],
      ['Split',     '2 adjacent numbers', '17 : 1'],
      ['Street',    '3 in a row',         '11 : 1'],
      ['Corner',    '4 in a square',       '8 : 1'],
      ['Six Line',  '6 numbers (2 rows)',  '5 : 1'],
      ['Dozen',     '1–12, 13–24, 25–36', '2 : 1'],
      ['Column',    'Column of 12',        '2 : 1'],
      ['Red/Black', 'Color bet',           '1 : 1'],
      ['Odd/Even',  'Parity bet',          '1 : 1'],
      ['Low/High',  '1–18 or 19–36',       '1 : 1'],
    ],
  },
  { title: 'How to Bet', body: 'Pick a chip size, then tap any cell. Confirm before time runs out.' },
  { title: 'Tip', body: 'Red/Black win ~48.6% — best for steady play. Straight is 35× but rare.' },
];

function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-5 flex flex-col gap-4 overflow-y-auto"
        style={{ maxHeight: '88vh', background: '#0d1f14', border: '1px solid rgba(201,168,76,0.3)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-gold font-bold">How to Play Roulette</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 text-xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        {RULES.map(r => (
          <div key={r.title}>
            <div className="text-gold/70 text-[10px] uppercase tracking-widest font-bold mb-1">{r.title}</div>
            {r.body && <p className="text-white/60 text-sm leading-relaxed">{r.body}</p>}
            {r.list && (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                <table className="w-full text-xs">
                  <thead><tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <th className="text-left px-3 py-1.5 text-white/40 font-medium">Bet</th>
                    <th className="text-left px-3 py-1.5 text-white/40 font-medium">Covers</th>
                    <th className="text-right px-3 py-1.5 text-white/40 font-medium">Payout</th>
                  </tr></thead>
                  <tbody>
                    {r.list.map(([bet, covers, payout], i) => (
                      <tr key={bet} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td className="px-3 py-1.5 text-white/80 font-medium">{bet}</td>
                        <td className="px-3 py-1.5 text-white/50">{covers}</td>
                        <td className="px-3 py-1.5 text-gold font-bold text-right">{payout}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function RouletteTable() {
  const { gameState: rawState, roomCode, myId, playerName, setRoomCode } = useGameStore();
  const state = rawState as RoulettePublicGameState | null;
  const [pendingBets, setPendingBets] = useState<RouletteBet[]>([]);
  const [betsSubmitted, setBetsSubmitted] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const prevPhase = useRef<string | null>(null);
  const layout = useLayout();
  const isPortrait = useIsPortrait();

  // Derive before early return so hooks are never called conditionally
  const me = state?.players.find(p => p.id === myId);

  useEffect(() => {
    if (!state) return;
    if (state.phase === 'complete' && state.spinResult !== null && prevPhase.current === 'spinning') {
      setHistory(h => [state.spinResult!, ...h].slice(0, 20));
    }
    if (state.phase === 'betting') { setBetsSubmitted(false); setPendingBets([]); }
    prevPhase.current = state.phase;
  }, [state?.phase, state?.spinResult]);

  useEffect(() => {
    if (state?.phase === 'complete' && me && playerName) {
      saveBalance(playerName, me.balance);
      if (me.lastWin > 0) playWin();
      else if (me.lastWin < 0) playLose();
    }
  }, [state?.phase]);

  const handleBetsChange = useCallback((bets: RouletteBet[]) => {
    setPendingBets(bets);
    setBetsSubmitted(false);
  }, []);

  if (!state || !roomCode) return null;

  // Portrait → ask to rotate
  if (isPortrait) return <RotatePrompt />;

  const isHost = me?.isHost ?? false;

  const confirmBets = () => {
    playButton();
    socket.emit('rouletteBet', { roomCode, bets: pendingBets });
    setBetsSubmitted(true);
  };

  const handleLeave = () => {
    clearSession(); socket.disconnect(); setRoomCode(null);
    useGameStore.setState({ gameState: null, gameType: null });
    window.location.reload();
  };

  // Compact top bar height to reclaim vertical space on small screens
  const topBarH = window.innerHeight < 450 ? 40 : 44;

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#0b1d10' }}>
      <ToastContainer />
      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-3"
        style={{ height: topBarH, background: 'rgba(0,0,0,0.55)', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
        <div className="flex items-center gap-2">
          <span className="font-display text-gold font-bold text-sm tracking-wide">Roulette</span>
          <span className="font-mono text-[10px] font-black text-gold/60 px-1.5 py-0.5 rounded tracking-widest"
            style={{ border: '1px solid rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.06)' }}>
            {roomCode}
          </span>
          <span className="text-white/20 text-[10px]">R{state.round}</span>
          <button onClick={() => setShowInfo(true)}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white/40 hover:text-gold transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.2)' }}>i</button>
        </div>
        <div className="flex items-center gap-3">
          {me && <span className="text-green-400 font-bold text-sm">${me.balance.toLocaleString()}</span>}
          <button onClick={handleLeave}
            className="text-[11px] px-2.5 py-1 rounded-lg font-medium text-white/40 hover:text-red-400 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Leave</button>
        </div>
      </div>

      {/* ── Body: board (left) + wheel panel (right) ── */}
      <div className="flex-1 overflow-hidden flex min-h-0">

        {/* Left — betting board, centered */}
        <div className="flex-1 overflow-hidden flex flex-col items-center justify-center gap-1.5 min-h-0"
          style={{ padding: `4px ${layout.boardPadX}px` }}>

          {/* Status row */}
          <div className="flex items-center justify-between w-full" style={{ maxWidth: layout.cellSize * 12 + layout.edgeCell * 2 }}>
            <div className="text-[10px] text-white/30 truncate">
              {state.phase === 'betting' && !betsSubmitted && 'Select chip → tap to bet'}
              {state.phase === 'betting' && betsSubmitted && <span className="text-green-400 font-medium">✓ Bets confirmed</span>}
              {state.phase === 'spinning' && <span className="text-white/50 animate-pulse">Spinning — no more bets!</span>}
              {state.phase === 'complete' && <span className="text-white/30">Round {state.round} complete</span>}
              {state.phase === 'waiting' && 'Waiting for host...'}
            </div>
            {state.phase === 'betting' && <span className="text-white/20 text-[10px] ml-2 flex-shrink-0">{state.bettingTimeLeft}s</span>}
          </div>

          {/* Bet board */}
          {(state.phase === 'betting' || state.phase === 'complete') && me ? (
            <div className="flex flex-col gap-1.5 w-full items-center">
              {/* overflow-x:auto handles any remaining overflow */}
              <div className="overflow-x-auto w-full flex justify-center" style={{ WebkitOverflowScrolling: 'touch' }}>
                <RouletteBetBoard
                  disabled={state.phase !== 'betting' || betsSubmitted}
                  onBetsChange={handleBetsChange}
                  balance={me.balance}
                  cellSize={layout.cellSize}
                  edgeCellSize={layout.edgeCell}
                />
              </div>
              {state.phase === 'betting' && pendingBets.length > 0 && !betsSubmitted && (
                <button onClick={confirmBets} className="btn-primary py-2 text-sm font-bold w-full"
                  style={{ maxWidth: layout.cellSize * 12 + layout.edgeCell * 2 }}>
                  Confirm — ${pendingBets.reduce((s, b) => s + b.amount, 0)} →
                </button>
              )}
              {state.phase === 'betting' && betsSubmitted && (
                <div className="text-green-400/50 text-[10px] animate-pulse">Bets locked — waiting for spin</div>
              )}
            </div>
          ) : state.phase === 'spinning' ? (
            <div className="flex flex-col items-center gap-2">
              <div className="text-4xl animate-spin" style={{ animationDuration: '0.7s' }}>◎</div>
              <div className="font-display text-lg text-white/20">Spinning...</div>
            </div>
          ) : (
            <div className="text-white/15 text-xs">Waiting for host to start...</div>
          )}

          {/* Results strip */}
          {state.phase === 'complete' && (
            <div className="flex items-center gap-4 px-4 py-1.5 rounded-xl flex-wrap"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', maxWidth: layout.cellSize * 12 + layout.edgeCell * 2 }}>
              <span className="text-[9px] uppercase tracking-widest text-white/20">Results</span>
              {state.players.map(p => (
                <div key={p.id} className="flex items-center gap-1 text-[11px]">
                  <span className="text-white/40">{p.name}</span>
                  <span className={`font-bold ${p.lastWin > 0 ? 'text-green-400' : p.lastWin < 0 ? 'text-red-400' : 'text-white/20'}`}>
                    {p.lastWin === 0 ? '—' : (p.lastWin > 0 ? '+' : '') + p.lastWin}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — wheel panel */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center gap-2 overflow-hidden"
          style={{
            width: layout.rightPanel,
            padding: '8px 10px',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.2)',
          }}>
          <RouletteWheel phase={state.phase} spinResult={state.spinResult} history={history} size={layout.wheelSize} />

          {/* Phase label */}
          {state.phase === 'betting' && (
            <div className="text-gold/60 text-[11px] animate-pulse">{state.bettingTimeLeft}s to bet</div>
          )}

          {/* Host controls */}
          {isHost && state.phase === 'betting' && (
            <button onClick={() => { playButton(); socket.emit('rouletteSpin', roomCode); }} className="btn-primary py-1.5 text-xs w-full">Spin Now →</button>
          )}
          {isHost && state.phase === 'complete' && (
            <button onClick={() => { playButton(); socket.emit('rouletteNextRound', roomCode); }} className="btn-primary py-1.5 text-xs w-full">Next Round →</button>
          )}
          {!isHost && state.phase === 'complete' && (
            <div className="text-white/20 text-[10px] animate-pulse text-center">Waiting for host...</div>
          )}

          {/* Player list */}
          <div className="w-full space-y-1 overflow-y-auto">
            <div className="text-[9px] uppercase tracking-widest text-white/20">Players ({state.players.length})</div>
            {state.players.map(p => {
              const bet = p.bets.reduce((s, b) => s + b.amount, 0);
              const isMe = p.id === myId;
              return (
                <div key={p.id} className={`flex items-center justify-between px-2 py-1 rounded-lg text-[10px] ${isMe ? 'bg-gold/10 border border-gold/20' : 'bg-white/5'}`}>
                  <div className="flex items-center gap-1 min-w-0">
                    {p.isHost && <span className="text-gold text-[9px]">★</span>}
                    <span className="text-white truncate">{p.name}{isMe && <span className="text-white/30"> (you)</span>}</span>
                  </div>
                  <div className="flex flex-col items-end ml-1 flex-shrink-0">
                    <span className="text-green-400 font-bold text-[10px]">${p.balance.toLocaleString()}</span>
                    {bet > 0 && state.phase === 'betting' && <span className="text-gold/50 text-[9px]">bet ${bet}</span>}
                    {state.phase === 'complete' && p.lastWin !== 0 && (
                      <span className={`text-[9px] font-bold ${p.lastWin > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {p.lastWin > 0 ? '+' : ''}{p.lastWin}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
