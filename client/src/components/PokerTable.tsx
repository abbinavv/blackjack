import { useState, useEffect } from 'react';
import { socket } from '../lib/socket';
import { useGameStore, clearSession } from '../store/gameStore';
import { PokerPublicGameState, PokerPublicPlayer, Card } from '../types';
import { playButton, playChipClink } from '../lib/sounds';

interface PokerTableProps { onLeave: () => void; }

// ─── Card renderer ────────────────────────────────────────────────────────────

const SUIT_SYMBOLS: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const RED_SUITS = new Set(['hearts', 'diamonds']);

type CardSize = 'sm' | 'md' | 'lg';
const CARD_DIMS: Record<CardSize, [number, number]> = { sm: [26, 38], md: [40, 58], lg: [60, 86] };

function PokerCard({ card, size = 'sm' }: { card: Card; size?: CardSize }) {
  const [w, h] = CARD_DIMS[size];
  const isRed = RED_SUITS.has(card.suit);
  const color = isRed ? '#d93535' : '#1a1a1a';
  const sym = SUIT_SYMBOLS[card.suit] ?? '?';
  const rankFs = size === 'lg' ? 16 : size === 'md' ? 12 : 9;
  const symFs  = size === 'lg' ? 26 : size === 'md' ? 18 : 13;
  const r      = size === 'lg' ? 8  : size === 'md' ? 5  : 4;

  return (
    <div style={{
      width: w, height: h, background: '#fff', borderRadius: r,
      border: '1px solid rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: size === 'lg' ? '4px 5px' : size === 'md' ? '3px 4px' : '2px 3px',
      boxShadow: '0 3px 8px rgba(0,0,0,0.5)', flexShrink: 0, userSelect: 'none',
    }}>
      <div style={{ color, fontSize: rankFs, fontWeight: 900, lineHeight: 1 }}>{card.rank}</div>
      <div style={{ color, fontSize: symFs, textAlign: 'center', lineHeight: 1 }}>{sym}</div>
      <div style={{ color, fontSize: rankFs, fontWeight: 900, lineHeight: 1, alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>{card.rank}</div>
    </div>
  );
}

function CardBack({ size = 'sm' }: { size?: CardSize }) {
  const [w, h] = CARD_DIMS[size];
  const r = size === 'lg' ? 8 : size === 'md' ? 5 : 4;
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(145deg, #1e40af 0%, #0f1f5c 100%)',
      border: '1px solid rgba(255,255,255,0.2)',
      boxShadow: '0 3px 8px rgba(0,0,0,0.5)', flexShrink: 0,
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: r - 1,
        background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 2px, transparent 2px, transparent 8px)',
      }} />
    </div>
  );
}

// ─── Chip token ───────────────────────────────────────────────────────────────

function BetChip({ amount }: { amount: number }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 36, height: 20, borderRadius: 10, padding: '0 6px',
      background: 'rgba(201,168,76,0.2)', border: '1px solid rgba(201,168,76,0.5)',
      color: '#c9a84c', fontSize: 10, fontWeight: 700,
    }}>
      ${amount}
    </div>
  );
}

// ─── Player seat ─────────────────────────────────────────────────────────────

function nameColor(name: string): string {
  const colors = ['#c0392b', '#8e44ad', '#2980b9', '#27ae60', '#d35400', '#16a085', '#e91e8c', '#0097a7'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

interface SeatProps {
  player: PokerPublicPlayer;
  isMe: boolean;
  isActive: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  showCards: boolean;
  turnTimeLeft: number;
}

function PlayerSeat({ player, isMe, isActive, isDealer, isSB, isBB, showCards, turnTimeLeft }: SeatProps) {
  const isFolded  = player.status === 'folded';
  const isAllIn   = player.status === 'all-in';
  const accentColor = nameColor(player.name);

  // Cards to show: opponents always get backs unless showdown; never show my cards here (shown separately)
  const showOpponentCards = !isMe && showCards && player.holeCards;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      opacity: isFolded ? 0.3 : 1,
      transition: 'opacity 0.3s',
    }}>
      {/* Cards above avatar (opponents only) */}
      {!isMe && (
        <div style={{ display: 'flex', gap: 3 }}>
          {showOpponentCards
            ? player.holeCards!.map((c, i) => <PokerCard key={i} card={c} size="sm" />)
            : <><CardBack size="sm" /><CardBack size="sm" /></>}
        </div>
      )}

      {/* Avatar */}
      <div style={{
        width: 40, height: 40, borderRadius: '50%', background: accentColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 900, color: '#fff',
        border: isActive ? '2.5px solid #c9a84c' : '2px solid rgba(255,255,255,0.12)',
        boxShadow: isActive ? '0 0 12px rgba(201,168,76,0.6)' : '0 2px 6px rgba(0,0,0,0.4)',
        position: 'relative', flexShrink: 0,
      }}>
        {player.name[0]?.toUpperCase()}

        {/* Dealer / SB / BB badges */}
        {(isDealer || isSB || isBB) && (
          <div style={{
            position: 'absolute', top: -5, right: -5,
            width: 18, height: 18, borderRadius: '50%',
            background: isDealer ? '#f5f5f5' : isSB ? '#2196f3' : '#e53935',
            color: isDealer ? '#000' : '#fff',
            fontSize: 7, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid rgba(0,0,0,0.3)',
          }}>
            {isDealer ? 'D' : isSB ? 'SB' : 'BB'}
          </div>
        )}

        {/* ALL IN badge */}
        {isAllIn && (
          <div style={{
            position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
            background: '#e53935', color: '#fff', fontSize: 7, fontWeight: 900,
            padding: '1px 4px', borderRadius: 3, whiteSpace: 'nowrap',
          }}>ALL IN</div>
        )}
      </div>

      {/* Name */}
      <div style={{
        fontSize: 11, fontWeight: isMe ? 700 : 400,
        color: isMe ? '#c9a84c' : 'rgba(255,255,255,0.8)',
        maxWidth: 72, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {player.name}{isMe && <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}> (you)</span>}
      </div>

      {/* Balance */}
      <div style={{ fontSize: 11, color: '#4caf50', fontWeight: 700 }}>
        ${player.balance.toLocaleString()}
      </div>

      {/* Bet */}
      {player.bet > 0 && <BetChip amount={player.bet} />}

      {/* Active timer */}
      {isActive && turnTimeLeft > 0 && (
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: turnTimeLeft <= 5 ? '#e53935' : '#c9a84c',
          animation: turnTimeLeft <= 5 ? 'pulse 0.5s infinite' : 'none',
        }}>
          {turnTimeLeft}s
        </div>
      )}

      {/* Win result */}
      {player.lastWin > 0 && (
        <div style={{ fontSize: 11, color: '#4caf50', fontWeight: 700 }}>+${player.lastWin}</div>
      )}
      {player.handResult && (
        <div style={{
          fontSize: 9, color: '#c9a84c', textAlign: 'center',
          background: 'rgba(201,168,76,0.1)', borderRadius: 3, padding: '1px 4px',
        }}>
          {player.handResult.name}
        </div>
      )}
    </div>
  );
}

// ─── Action panel ─────────────────────────────────────────────────────────────

function ActionPanel({ state, me, roomCode }: { state: PokerPublicGameState; me: PokerPublicPlayer; roomCode: string }) {
  const toCall = state.currentBet - me.bet;
  const canCheck = toCall <= 0;
  const minRaiseTotal = state.currentBet + state.minRaise;
  const maxRaise = me.balance + me.bet;
  const canRaise = maxRaise > state.currentBet;
  const [raiseAmt, setRaiseAmt] = useState(Math.min(minRaiseTotal, maxRaise));

  useEffect(() => {
    setRaiseAmt(Math.min(minRaiseTotal, maxRaise));
  }, [minRaiseTotal, maxRaise, state.phase]);

  const totalPot = state.pots.reduce((s, p) => s + p.amount, 0) + state.players.reduce((s, p) => s + p.bet, 0);
  const clamp = (v: number) => Math.max(minRaiseTotal, Math.min(maxRaise, v));

  const presets = canRaise ? [
    { label: '½ Pot', val: clamp(Math.floor(totalPot / 2)) },
    { label: 'Pot',   val: clamp(totalPot) },
    { label: '2×',    val: clamp(totalPot * 2) },
  ].filter(p => p.val < maxRaise) : [];

  return (
    <div style={{
      flexShrink: 0,
      padding: '10px 16px 12px',
      background: 'rgba(0,0,0,0.65)',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ maxWidth: 580, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Raise controls */}
        {canRaise && (
          <>
            {/* Slider row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                ${minRaiseTotal}
              </span>
              <input
                type="range"
                min={minRaiseTotal}
                max={maxRaise}
                step={Math.max(1, Math.floor((maxRaise - minRaiseTotal) / 200))}
                value={raiseAmt}
                onChange={e => setRaiseAmt(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#c9a84c', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                ${maxRaise.toLocaleString()}
              </span>
            </div>

            {/* Preset buttons */}
            {presets.length > 0 && (
              <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                {presets.map(({ label, val }) => (
                  <button key={label} onClick={() => setRaiseAmt(val)}
                    style={{
                      padding: '3px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                      background: raiseAmt === val ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${raiseAmt === val ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.12)'}`,
                      color: raiseAmt === val ? '#c9a84c' : 'rgba(255,255,255,0.55)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={() => { playButton(); socket.emit('pokerFold', roomCode); }}
            className="btn-ghost"
            style={{ padding: '10px 22px', background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.4)', color: '#e57373', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Fold
          </button>

          {canCheck ? (
            <button onClick={() => { playButton(); socket.emit('pokerCheck', roomCode); }}
              style={{ padding: '10px 26px', background: 'rgba(52,152,219,0.15)', border: '1px solid rgba(52,152,219,0.4)', color: '#64b5f6', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Check
            </button>
          ) : (
            <button onClick={() => { playChipClink(); socket.emit('pokerCall', roomCode); }}
              style={{ padding: '10px 22px', background: 'rgba(52,152,219,0.15)', border: '1px solid rgba(52,152,219,0.4)', color: '#64b5f6', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Call ${Math.min(toCall, me.balance).toLocaleString()}
            </button>
          )}

          {canRaise && (
            <button onClick={() => { playChipClink(); socket.emit('pokerRaise', { roomCode, amount: raiseAmt }); }}
              style={{ padding: '10px 22px', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.4)', color: '#c9a84c', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Raise ${raiseAmt.toLocaleString()}
            </button>
          )}

          <button onClick={() => { playChipClink(); socket.emit('pokerAllIn', roomCode); }}
            style={{ padding: '10px 16px', background: 'rgba(229,57,53,0.2)', border: '1px solid rgba(229,57,53,0.5)', color: '#ef5350', borderRadius: 10, fontWeight: 900, fontSize: 13, cursor: 'pointer' }}>
            ALL IN<br />
            <span style={{ fontSize: 10, opacity: 0.8 }}>${me.balance.toLocaleString()}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main poker table ─────────────────────────────────────────────────────────

export function PokerTable({ onLeave }: PokerTableProps) {
  const { pokerGameState, roomCode, myId, pokerMyCards } = useGameStore();
  if (!pokerGameState || !roomCode) return null;

  const state = pokerGameState;
  const me = state.players.find(p => p.id === myId);
  const isMyTurn = state.activePlayerId === myId && me?.status === 'active';
  const isHost = me?.isHost ?? false;
  const showCards = state.phase === 'showdown';
  const totalPot = state.pots.reduce((s, p) => s + p.amount, 0);
  const myCards = pokerMyCards ?? (showCards ? me?.holeCards ?? null : null);

  const handleLeave = () => {
    clearSession(); socket.disconnect(); onLeave();
    useGameStore.setState({ gameState: null, pokerMyCards: null });
    window.location.reload();
  };

  // ── Oval geometry ──
  const ovalW = Math.min(typeof window !== 'undefined' ? window.innerWidth - 120 : 560, 600);
  const ovalH = Math.round(ovalW * 0.48);
  const padX  = 90;   // horizontal space outside oval for seats
  const padY  = 80;   // vertical space outside oval for seats
  const canvasW = ovalW + padX * 2;
  const canvasH = ovalH + padY * 2 + 100; // +100 for my cards below

  const cx = canvasW / 2;
  const cy = padY + ovalH / 2;  // oval center y
  const rx = ovalW / 2 - 10;
  const ry = ovalH / 2 - 8;

  const seats = state.players;
  const n = seats.length;
  const myIndex = seats.findIndex(p => p.id === myId);
  const angleStep = (2 * Math.PI) / n;

  const seatPositions = seats.map((_, i) => {
    const offset = i - (myIndex >= 0 ? myIndex : 0);
    const angle = (Math.PI / 2) + offset * angleStep; // bottom = π/2
    return {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    };
  });

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'radial-gradient(ellipse at 50% 30%, #0e1a0e 0%, #080d08 100%)',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 44,
        background: 'rgba(0,0,0,0.7)', borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#c9a84c', fontWeight: 900, fontSize: 15, letterSpacing: '0.03em' }}>♣ Poker</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#c9a84c', letterSpacing: '0.2em', fontSize: 13 }}>{roomCode}</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>R{state.round}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {state.message}
          </span>
          {me && <span style={{ fontSize: 13, color: '#4caf50', fontWeight: 700 }}>${me.balance.toLocaleString()}</span>}
          <button onClick={handleLeave} style={{
            padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.5)',
          }}>Leave</button>
        </div>
      </div>

      {/* ── Table canvas ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ position: 'relative', width: canvasW, height: canvasH, flexShrink: 0 }}>

          {/* Felt oval */}
          <div style={{
            position: 'absolute',
            left: padX, top: padY,
            width: ovalW, height: ovalH,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at 42% 38%, #1e6b30 0%, #0f3d1a 55%, #071f0d 100%)',
            border: '7px solid #7a5a0a',
            boxShadow: '0 0 0 2px #4a3606, 0 8px 32px rgba(0,0,0,0.6), inset 0 0 50px rgba(0,0,0,0.35)',
          }} />

          {/* Community cards */}
          <div style={{
            position: 'absolute',
            left: '50%', top: padY + ovalH / 2 - 33,
            transform: 'translateX(-50%)',
            display: 'flex', gap: 5, alignItems: 'center',
          }}>
            {state.communityCards.map((c, i) => <PokerCard key={i} card={c} size="md" />)}
            {Array.from({ length: 5 - state.communityCards.length }).map((_, i) => (
              <div key={i} style={{
                width: 40, height: 58, borderRadius: 5,
                border: '1px dashed rgba(255,255,255,0.12)',
                background: 'rgba(0,0,0,0.18)',
              }} />
            ))}
          </div>

          {/* Pot */}
          {totalPot > 0 && (
            <div style={{
              position: 'absolute',
              left: '50%', top: padY + ovalH / 2 + 34,
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              borderRadius: 20, padding: '4px 16px',
              color: '#c9a84c', fontWeight: 900, fontSize: 14,
              border: '1px solid rgba(201,168,76,0.35)',
              whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}>
              POT: ${totalPot.toLocaleString()}
            </div>
          )}

          {/* Player seats */}
          {seats.map((player, i) => {
            const pos = seatPositions[i];
            if (!pos) return null;
            const isMe = player.id === myId;
            return (
              <div key={player.id} style={{
                position: 'absolute',
                left: pos.x, top: pos.y,
                transform: 'translate(-50%, -50%)',
              }}>
                <PlayerSeat
                  player={player}
                  isMe={isMe}
                  isActive={player.id === state.activePlayerId}
                  isDealer={i === state.dealerIndex}
                  isSB={i === state.sbIndex}
                  isBB={i === state.bbIndex}
                  showCards={showCards}
                  turnTimeLeft={state.turnTimeLeft}
                />
              </div>
            );
          })}

          {/* My hole cards — centered below my seat, at bottom of canvas */}
          {myCards && (
            <div style={{
              position: 'absolute',
              left: '50%',
              bottom: 4,
              transform: 'translateX(-50%)',
              display: 'flex', gap: 10,
            }}>
              {myCards.map((c, i) => <PokerCard key={i} card={c} size="lg" />)}
            </div>
          )}

          {/* Showdown winners banner */}
          {state.phase === 'showdown' && state.winners && state.winners.length > 0 && (
            <div style={{
              position: 'absolute',
              left: '50%', top: padY + ovalH / 2 - 68,
              transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            }}>
              {state.winners.map((w, i) => (
                <div key={i} style={{
                  background: 'rgba(76,175,80,0.25)', border: '1px solid rgba(76,175,80,0.5)',
                  borderRadius: 8, padding: '4px 14px',
                  color: '#81c784', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                  🏆 {w.playerName} wins ${w.amount.toLocaleString()} — {w.handName}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom controls ── */}
      <div style={{ flexShrink: 0 }}>
        {isMyTurn && me && (
          <ActionPanel state={state} me={me} roomCode={roomCode} />
        )}

        {state.phase === 'showdown' && (
          <div style={{ padding: '10px', textAlign: 'center', background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {isHost ? (
              <button onClick={() => { playButton(); socket.emit('pokerNextRound', roomCode); }}
                className="btn-primary" style={{ padding: '10px 32px', fontSize: 14 }}>
                Next Hand →
              </button>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                Waiting for host to start next hand...
              </div>
            )}
          </div>
        )}

        {!isMyTurn && state.activePlayerId && state.phase !== 'showdown' && state.phase !== 'waiting' && (
          <div style={{
            padding: '8px', textAlign: 'center', fontSize: 12,
            color: 'rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)',
          }}>
            {state.players.find(p => p.id === state.activePlayerId)?.name}'s turn...
          </div>
        )}
      </div>
    </div>
  );
}
