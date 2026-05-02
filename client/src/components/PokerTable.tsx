import { useState, useEffect } from 'react';
import { socket } from '../lib/socket';
import { useGameStore, clearSession, saveBalance } from '../store/gameStore';
import { PokerPublicGameState, PokerPublicPlayer, Card } from '../types';
import { playButton, playChipClink } from '../lib/sounds';

interface PokerTableProps { onLeave: () => void; }

// ─── Card renderer ────────────────────────────────────────────────────────────

const SUIT_SYMBOLS: Record<string, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const RED_SUITS = new Set(['hearts', 'diamonds']);
type CardSize = 'sm' | 'md' | 'lg';
const CARD_DIMS: Record<CardSize, [number, number]> = { sm: [30, 44], md: [46, 66], lg: [70, 100] };

// Realistic casino-quality card — matches blackjack Card.tsx styling
function PokerCard({ card, size = 'sm' }: { card: Card; size?: CardSize }) {
  const [w, h] = CARD_DIMS[size];
  const isRed = RED_SUITS.has(card.suit);
  const color = isRed ? '#C8102E' : '#111111';
  const sym = SUIT_SYMBOLS[card.suit] ?? '?';

  const r             = size === 'lg' ? 7  : size === 'md' ? 6  : 4;
  const cornerRankFs  = size === 'lg' ? 16 : size === 'md' ? 12 : 8;
  const cornerSuitFs  = size === 'lg' ? 11 : size === 'md' ? 8  : 5.5;
  const centerFs      = size === 'lg' ? 32 : size === 'md' ? 22 : 13;
  const cornerPad     = size === 'lg' ? '4px 5px' : size === 'md' ? '3px 4px' : '2px 3px';

  return (
    <div style={{
      width: w, height: h,
      background: 'linear-gradient(145deg, #ffffff 0%, #f9f7f3 100%)',
      borderRadius: r,
      border: '1px solid #c8c0b4',
      position: 'relative', overflow: 'hidden', flexShrink: 0, userSelect: 'none',
      boxShadow: '0 1px 3px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.85)',
    }}>
      {/* Top-left corner: rank + suit */}
      <div style={{
        position: 'absolute', top: 0, left: 0, padding: cornerPad,
        display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1,
        color, fontFamily: 'Georgia, "Playfair Display", serif',
      }}>
        <span style={{ fontSize: cornerRankFs, fontWeight: 700 }}>{card.rank}</span>
        <span style={{ fontSize: cornerSuitFs, marginTop: -1 }}>{sym}</span>
      </div>

      {/* Large center symbol */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, fontSize: centerFs,
        filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))',
      }}>{sym}</div>

      {/* Bottom-right corner: rank + suit, rotated */}
      <div style={{
        position: 'absolute', bottom: 0, right: 0, padding: cornerPad,
        display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1,
        color, fontFamily: 'Georgia, "Playfair Display", serif',
        transform: 'rotate(180deg)',
      }}>
        <span style={{ fontSize: cornerRankFs, fontWeight: 700 }}>{card.rank}</span>
        <span style={{ fontSize: cornerSuitFs, marginTop: -1 }}>{sym}</span>
      </div>
    </div>
  );
}

// Casino-back card — navy with gold border frame
function CardBack({ size = 'sm' }: { size?: CardSize }) {
  const [w, h] = CARD_DIMS[size];
  const r     = size === 'lg' ? 7 : size === 'md' ? 6 : 4;
  const inset = size === 'lg' ? 3 : size === 'md' ? 2.5 : 2;

  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0, position: 'relative', overflow: 'hidden',
      background: '#0c1854',
      backgroundImage: 'repeating-conic-gradient(rgba(255,255,255,0.045) 0deg 90deg, rgba(255,255,255,0.018) 90deg 180deg) 0 0 / 8px 8px',
      border: '1.5px solid #c9a84c',
      boxShadow: '0 1px 3px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.45)',
    }}>
      {/* Inner gold frame */}
      <div style={{
        position: 'absolute',
        top: inset, left: inset, right: inset, bottom: inset,
        border: '1px solid rgba(201,168,76,0.42)',
        borderRadius: Math.max(2, r - 2),
      }} />
    </div>
  );
}

// ─── Info modal ───────────────────────────────────────────────────────────────

const HAND_RANKINGS = [
  { name: 'Royal Flush',    example: 'A K Q J 10 ♠',      pays: 'Best hand',    desc: 'A-K-Q-J-10, all same suit' },
  { name: 'Straight Flush', example: '9 8 7 6 5 ♥',       pays: 'Pot',          desc: '5 consecutive, same suit' },
  { name: 'Four of a Kind', example: 'K K K K x',          pays: 'Pot',          desc: '4 cards of the same rank' },
  { name: 'Full House',     example: 'Q Q Q J J',          pays: 'Pot',          desc: '3 of a kind + a pair' },
  { name: 'Flush',          example: 'A J 8 4 2 ♦',        pays: 'Pot',          desc: '5 cards, same suit' },
  { name: 'Straight',       example: '8 7 6 5 4',          pays: 'Pot',          desc: '5 consecutive cards' },
  { name: 'Three of a Kind',example: '7 7 7 x x',          pays: 'Pot',          desc: '3 cards of the same rank' },
  { name: 'Two Pair',       example: 'J J 5 5 x',          pays: 'Pot',          desc: 'Two different pairs' },
  { name: 'One Pair',       example: 'A A x x x',          pays: 'Pot',          desc: '2 cards of the same rank' },
  { name: 'High Card',      example: 'A K 9 6 2',          pays: 'Pot',          desc: 'Highest card wins' },
];

function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        width: '100%', maxWidth: 520, maxHeight: '88vh',
        background: '#0d1f14', borderRadius: 16, overflow: 'hidden',
        border: '1px solid rgba(201,168,76,0.3)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: '#c9a84c', fontWeight: 900, fontSize: 17 }}>How to Play Poker</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
              No-Limit Texas Hold'em · $10/$20 Blinds
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontSize: 16,
          }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Game overview */}
          <div>
            <div style={{ color: 'rgba(201,168,76,0.7)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>
              How It Works
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.6 }}>
              Each player gets 2 private hole cards. 5 community cards are dealt face-up in rounds
              (Flop: 3, Turn: 1, River: 1). Make the best 5-card hand using any combo of your 2 cards + 5 community cards.
            </div>
          </div>

          {/* Betting rounds */}
          <div>
            <div style={{ color: 'rgba(201,168,76,0.7)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>
              Betting Rounds
            </div>
            {[
              { phase: 'Pre-Flop', desc: 'After hole cards are dealt. SB posts $10, BB posts $20 automatically.' },
              { phase: 'Flop',     desc: '3 community cards revealed. Betting starts left of dealer.' },
              { phase: 'Turn',     desc: '4th community card revealed. Another round of betting.' },
              { phase: 'River',    desc: '5th and final community card. Last round of betting.' },
              { phase: 'Showdown', desc: 'Remaining players reveal cards. Best hand wins the pot.' },
            ].map(({ phase, desc }) => (
              <div key={phase} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                <span style={{ color: '#c9a84c', fontWeight: 700, fontSize: 12, minWidth: 60 }}>{phase}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{desc}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div>
            <div style={{ color: 'rgba(201,168,76,0.7)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>
              Actions
            </div>
            {[
              { action: 'Check',  desc: 'Pass without betting (only if no one has bet)' },
              { action: 'Call',   desc: 'Match the current bet' },
              { action: 'Raise',  desc: 'Increase the current bet (min 1 BB = $20)' },
              { action: 'All In', desc: 'Bet all your chips' },
              { action: 'Fold',   desc: 'Give up your hand and forfeit your bet' },
            ].map(({ action, desc }) => (
              <div key={action} style={{ display: 'flex', gap: 10, marginBottom: 5 }}>
                <span style={{ color: '#c9a84c', fontWeight: 700, fontSize: 12, minWidth: 52 }}>{action}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{desc}</span>
              </div>
            ))}
          </div>

          {/* Hand rankings */}
          <div>
            <div style={{ color: 'rgba(201,168,76,0.7)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 8 }}>
              Hand Rankings (Best → Worst)
            </div>
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
              {HAND_RANKINGS.map((h, i) => (
                <div key={h.name} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  borderBottom: i < HAND_RANKINGS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, minWidth: 14, textAlign: 'right' }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#e8e8e8', fontSize: 12, fontWeight: 700 }}>{h.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{h.desc}</div>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace' }}>{h.example}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Leave confirmation ───────────────────────────────────────────────────────

function LeaveModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div style={{
        background: '#111', borderRadius: 16, padding: '28px 32px',
        border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', maxWidth: 320,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>🃏</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Leave the table?</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
          You'll fold your current hand and any chips you've bet will stay in the pot.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600,
          }}>Stay</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(229,57,53,0.2)', border: '1px solid rgba(229,57,53,0.5)',
            color: '#ef5350', fontSize: 13, fontWeight: 700,
          }}>Leave</button>
        </div>
      </div>
    </div>
  );
}

// ─── Chip token ───────────────────────────────────────────────────────────────

function BetChip({ amount }: { amount: number }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 40, height: 20, borderRadius: 10, padding: '0 8px',
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
  const isFolded = player.status === 'folded';
  const isAllIn  = player.status === 'all-in';
  const accent   = nameColor(player.name);
  const badge    = isDealer ? { bg: '#f5f5f5', color: '#000', text: 'D' }
                 : isSB     ? { bg: '#2196f3', color: '#fff', text: 'SB' }
                 : isBB     ? { bg: '#e53935', color: '#fff', text: 'BB' }
                 : null;

  const opponentCards = !isMe && showCards && player.holeCards;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      opacity: isFolded ? 0.28 : 1, transition: 'opacity 0.3s',
    }}>
      {/* Opponent cards above avatar */}
      {!isMe && (
        <div style={{ display: 'flex', gap: 3, marginBottom: 2 }}>
          {opponentCards
            ? player.holeCards!.map((c, i) => <PokerCard key={i} card={c} size="sm" />)
            : <><CardBack size="sm" /><CardBack size="sm" /></>}
        </div>
      )}

      {/* Avatar */}
      <div style={{
        width: 46, height: 46, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, ${accent}dd, ${accent}88)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 'bold', color: '#fff',
        border: isActive ? '3px solid #c9a84c' : '2px solid rgba(255,255,255,0.12)',
        boxShadow: isActive
          ? '0 0 20px rgba(201,168,76,0.8), 0 0 6px rgba(201,168,76,0.4)'
          : '0 2px 10px rgba(0,0,0,0.6)',
        position: 'relative', flexShrink: 0,
        transition: 'box-shadow 0.3s, border-color 0.3s',
      }}>
        {player.name[0]?.toUpperCase()}
        {badge && (
          <div style={{
            position: 'absolute', top: -6, right: -6,
            minWidth: 18, height: 18, borderRadius: 9,
            padding: '0 3px',
            background: badge.bg, color: badge.color,
            fontSize: 8, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid rgba(0,0,0,0.25)',
          }}>{badge.text}</div>
        )}
        {isAllIn && (
          <div style={{
            position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
            background: '#e53935', color: '#fff', fontSize: 7, fontWeight: 900,
            padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap',
          }}>ALL IN</div>
        )}
      </div>

      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
        <div style={{
          fontSize: 12, fontWeight: isMe ? 700 : 500,
          color: isMe ? '#c9a84c' : 'rgba(255,255,255,0.85)',
          maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {player.name}
          {isMe && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}> (you)</span>}
        </div>
        <div style={{ fontSize: 11, color: '#4caf50', fontWeight: 700 }}>
          ${player.balance.toLocaleString()}
        </div>
      </div>

      {player.bet > 0 && <BetChip amount={player.bet} />}

      {isActive && turnTimeLeft > 0 && (
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: turnTimeLeft <= 5 ? '#e53935' : '#c9a84c',
        }}>
          {turnTimeLeft}s
        </div>
      )}

      {player.lastWin > 0 && (
        <div style={{ fontSize: 12, color: '#4caf50', fontWeight: 700 }}>+${player.lastWin}</div>
      )}
      {player.handResult && (
        <div style={{
          fontSize: 10, color: '#c9a84c', textAlign: 'center',
          background: 'rgba(201,168,76,0.12)', borderRadius: 4, padding: '2px 6px',
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
      flexShrink: 0, padding: '10px 16px 14px',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 9 }}>

        {canRaise && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>${minRaiseTotal}</span>
              <input type="range"
                min={minRaiseTotal} max={maxRaise}
                step={Math.max(1, Math.floor((maxRaise - minRaiseTotal) / 200))}
                value={raiseAmt}
                onChange={e => setRaiseAmt(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#c9a84c', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>${maxRaise.toLocaleString()}</span>
            </div>
            {presets.length > 0 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                {presets.map(({ label, val }) => (
                  <button key={label} onClick={() => setRaiseAmt(val)} style={{
                    padding: '3px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
                    background: raiseAmt === val ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.07)',
                    border: `1px solid ${raiseAmt === val ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    color: raiseAmt === val ? '#c9a84c' : 'rgba(255,255,255,0.5)',
                  }}>{label} ${val}</button>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { playButton(); socket.emit('pokerFold', roomCode); }} style={{
            padding: '11px 24px', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.4)',
            color: '#e57373', fontSize: 14, fontWeight: 700,
          }}>Fold</button>

          {canCheck ? (
            <button onClick={() => { playButton(); socket.emit('pokerCheck', roomCode); }} style={{
              padding: '11px 28px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(52,152,219,0.15)', border: '1px solid rgba(52,152,219,0.4)',
              color: '#64b5f6', fontSize: 14, fontWeight: 700,
            }}>Check</button>
          ) : (
            <button onClick={() => { playChipClink(); socket.emit('pokerCall', roomCode); }} style={{
              padding: '11px 24px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(52,152,219,0.15)', border: '1px solid rgba(52,152,219,0.4)',
              color: '#64b5f6', fontSize: 14, fontWeight: 700,
            }}>Call ${Math.min(toCall, me.balance).toLocaleString()}</button>
          )}

          {canRaise && (
            <button onClick={() => { playChipClink(); socket.emit('pokerRaise', { roomCode, amount: raiseAmt }); }} style={{
              padding: '11px 24px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.45)',
              color: '#c9a84c', fontSize: 14, fontWeight: 700,
            }}>Raise ${raiseAmt.toLocaleString()}</button>
          )}

          <button onClick={() => { playChipClink(); socket.emit('pokerAllIn', roomCode); }} style={{
            padding: '11px 18px', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(229,57,53,0.2)', border: '1px solid rgba(229,57,53,0.55)',
            color: '#ef5350', fontSize: 14, fontWeight: 900,
          }}>ALL IN ${me.balance.toLocaleString()}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main poker table ─────────────────────────────────────────────────────────

export function PokerTable({ onLeave }: PokerTableProps) {
  const { pokerGameState, roomCode, myId, pokerMyCards } = useGameStore();
  const [showInfo, setShowInfo] = useState(false);
  const [showLeave, setShowLeave] = useState(false);

  if (!pokerGameState || !roomCode) return null;

  const state = pokerGameState;
  const me = state.players.find(p => p.id === myId);
  const isMyTurn = state.activePlayerId === myId && me?.status === 'active';
  const isHost = me?.isHost ?? false;
  const showCards = state.phase === 'showdown';
  const totalPot = state.pots.reduce((s, p) => s + p.amount, 0);
  const myCards = pokerMyCards ?? (showCards ? me?.holeCards ?? null : null);

  const playerName = useGameStore(s => s.playerName);

  useEffect(() => {
    if (state.phase === 'showdown' && me && playerName) {
      saveBalance(playerName, me.balance);
    }
  }, [state.phase, me?.balance, playerName]);

  const handleLeave = () => {
    if (me && playerName) saveBalance(playerName, me.balance);
    clearSession(); socket.disconnect(); onLeave();
    useGameStore.setState({ gameState: null, pokerMyCards: null });
    window.location.reload();
  };

  // ── Oval geometry — fills most of the viewport ──
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const ovalW  = Math.min(Math.round(vw * 0.72), 920);
  const ovalH  = Math.min(Math.round(ovalW * 0.47), Math.round(vh * 0.44));
  const padX   = Math.round(ovalW * 0.14);   // seat space left/right of oval
  const padY   = Math.round(ovalH * 0.55);   // seat space above/below oval
  const canvasW = ovalW + padX * 2;
  const canvasH = ovalH + padY * 2 + CARD_DIMS['lg'][1] + 10;

  const cx = canvasW / 2;
  const cy = padY + ovalH / 2;
  const rx = ovalW / 2 - 12;
  const ry = ovalH / 2 - 8;

  const seats = state.players;
  const n = seats.length;
  const myIndex = seats.findIndex(p => p.id === myId);

  const seatPositions = seats.map((_, i) => {
    const offset = i - (myIndex >= 0 ? myIndex : 0);
    const angle = Math.PI / 2 + offset * ((2 * Math.PI) / Math.max(n, 1));
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
  });

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'radial-gradient(ellipse at 50% 20%, #0d1f0d 0%, #060c06 100%)',
    }}>
      {showInfo  && <InfoModal  onClose={() => setShowInfo(false)} />}
      {showLeave && <LeaveModal onConfirm={handleLeave} onCancel={() => setShowLeave(false)} />}

      {/* ── Top bar ── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px', height: 44,
        background: 'rgba(0,0,0,0.7)', borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#c9a84c', fontWeight: 900, fontSize: 14 }}>♣ Poker</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#c9a84c', letterSpacing: '0.18em', fontSize: 13 }}>{roomCode}</span>
          <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>R{state.round}</span>
          {/* Info button */}
          <button onClick={() => setShowInfo(true)} style={{
            width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>i</button>
        </div>

        {/* Center message */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {state.message}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {me && <span style={{ fontSize: 13, color: '#4caf50', fontWeight: 700 }}>${me.balance.toLocaleString()}</span>}
          <button onClick={() => setShowLeave(true)} style={{
            padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
            background: 'rgba(229,57,53,0.12)', border: '1px solid rgba(229,57,53,0.35)',
            color: '#e57373', fontWeight: 600,
          }}>Leave</button>
        </div>
      </div>

      {/* ── Table canvas ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ position: 'relative', width: canvasW, height: canvasH, flexShrink: 0 }}>

          {/* Felt oval — woven texture + deep green + premium wood rail */}
          <div style={{
            position: 'absolute',
            left: padX, top: padY,
            width: ovalW, height: ovalH,
            borderRadius: '50%',
            background: '#0c3820',
            backgroundImage: [
              'repeating-linear-gradient(0deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent 4px)',
              'repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 4px)',
              'radial-gradient(ellipse 90% 80% at 42% 38%, #216840 0%, #0f4826 52%, #062514 100%)',
            ].join(', '),
            /* Wood rail: dark brown outer + gold highlight line */
            border: '9px solid #3a1c04',
            boxShadow: [
              '0 0 0 1.5px rgba(201,168,76,0.28)',   /* gold highlight line */
              '0 0 0 3px rgba(0,0,0,0.5)',            /* outer dark ring */
              '0 14px 50px rgba(0,0,0,0.75)',
              'inset 0 0 90px rgba(0,0,0,0.42)',
              'inset 0 2px 8px rgba(255,255,255,0.04)',
            ].join(', '),
          }} />

          {/* Community cards */}
          <div style={{
            position: 'absolute',
            left: '50%', top: padY + ovalH / 2 - CARD_DIMS['md'][1] / 2 - 8,
            transform: 'translateX(-50%)',
            display: 'flex', gap: 7, alignItems: 'center',
          }}>
            {state.communityCards.map((c, i) => <PokerCard key={i} card={c} size="md" />)}
            {Array.from({ length: 5 - state.communityCards.length }).map((_, i) => (
              <div key={i} style={{
                width: CARD_DIMS['md'][0], height: CARD_DIMS['md'][1], borderRadius: 6,
                border: '1px dashed rgba(255,255,255,0.12)',
                background: 'rgba(0,0,0,0.18)',
              }} />
            ))}
          </div>

          {/* Pot badge */}
          {totalPot > 0 && (
            <div style={{
              position: 'absolute', left: '50%',
              top: padY + ovalH / 2 + CARD_DIMS['md'][1] / 2 + 6,
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.72)', borderRadius: 20, padding: '5px 20px',
              color: '#c9a84c', fontWeight: 900, fontSize: 15,
              border: '1px solid rgba(201,168,76,0.45)',
              whiteSpace: 'nowrap',
              boxShadow: '0 3px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
              letterSpacing: '0.04em',
            }}>
              POT ${totalPot.toLocaleString()}
            </div>
          )}

          {/* Player seats */}
          {seats.map((player, i) => {
            const pos = seatPositions[i];
            if (!pos) return null;
            return (
              <div key={player.id} style={{
                position: 'absolute', left: pos.x, top: pos.y,
                transform: 'translate(-50%, -50%)',
              }}>
                <PlayerSeat
                  player={player}
                  isMe={player.id === myId}
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

          {/* My hole cards — large, bottom-center of canvas */}
          {myCards && (
            <div style={{
              position: 'absolute', bottom: 2, left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex', gap: 12,
            }}>
              {myCards.map((c, i) => <PokerCard key={i} card={c} size="lg" />)}
            </div>
          )}

          {/* Showdown winners */}
          {state.phase === 'showdown' && state.winners && state.winners.length > 0 && (
            <div style={{
              position: 'absolute', left: '50%',
              top: padY + ovalH / 2 - CARD_DIMS['md'][1] / 2 - 42,
              transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            }}>
              {state.winners.map((w, i) => (
                <div key={i} style={{
                  background: 'linear-gradient(135deg, rgba(40,140,60,0.35), rgba(30,110,50,0.2))',
                  border: '1px solid rgba(76,200,80,0.5)',
                  borderRadius: 10, padding: '6px 18px',
                  color: '#7de882', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                  boxShadow: '0 0 20px rgba(40,160,60,0.25), 0 4px 12px rgba(0,0,0,0.4)',
                  letterSpacing: '0.02em',
                }}>
                  🏆 {w.playerName} — {w.handName} · +${w.amount.toLocaleString()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom controls ── */}
      <div style={{ flexShrink: 0 }}>
        {isMyTurn && me && <ActionPanel state={state} me={me} roomCode={roomCode} />}

        {state.phase === 'showdown' && (
          <div style={{ padding: '10px', textAlign: 'center', background: 'rgba(0,0,0,0.55)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {isHost
              ? <button onClick={() => { playButton(); socket.emit('pokerNextRound', roomCode); }}
                  className="btn-primary" style={{ padding: '10px 36px', fontSize: 14 }}>Next Hand →</button>
              : <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Waiting for host to start next hand...</div>
            }
          </div>
        )}

        {!isMyTurn && state.activePlayerId && state.phase !== 'showdown' && state.phase !== 'waiting' && (
          <div style={{
            padding: '8px', textAlign: 'center', fontSize: 12,
            color: 'rgba(255,255,255,0.3)',
            background: 'rgba(0,0,0,0.45)', borderTop: '1px solid rgba(255,255,255,0.05)',
          }}>
            {state.players.find(p => p.id === state.activePlayerId)?.name}'s turn...
          </div>
        )}
      </div>
    </div>
  );
}
