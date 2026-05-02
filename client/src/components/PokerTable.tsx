import { useState, useEffect } from 'react';
import { socket } from '../lib/socket';
import { useGameStore, clearSession } from '../store/gameStore';
import { PokerPublicGameState, PokerPublicPlayer, Card } from '../types';
import { playButton, playChipClink, playWin, playCardFlip, playDeal } from '../lib/sounds';

interface PokerTableProps {
  onLeave: () => void;
}

// ─── Card renderer ────────────────────────────────────────────────────────────

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const RED_SUITS = new Set(['hearts', 'diamonds']);

function PokerCard({ card, size = 'sm' }: { card: Card; size?: 'sm' | 'lg' }) {
  const isRed = RED_SUITS.has(card.suit);
  const color = isRed ? '#e05555' : '#e8e8e8';
  const sym = SUIT_SYMBOLS[card.suit] ?? '?';
  const w = size === 'lg' ? 56 : 28;
  const h = size === 'lg' ? 80 : 40;
  const fontSize = size === 'lg' ? 14 : 9;
  const symSize = size === 'lg' ? 22 : 12;

  return (
    <div
      style={{
        width: w, height: h,
        background: '#fff',
        borderRadius: size === 'lg' ? 6 : 4,
        border: '1px solid rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: size === 'lg' ? '3px 4px' : '2px 2px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <div style={{ color, fontSize, fontWeight: 'bold', lineHeight: 1 }}>
        {card.rank}
      </div>
      <div style={{ color, fontSize: symSize, textAlign: 'center', lineHeight: 1 }}>
        {sym}
      </div>
      <div style={{ color, fontSize, fontWeight: 'bold', lineHeight: 1, alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>
        {card.rank}
      </div>
    </div>
  );
}

function CardBack({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const w = size === 'lg' ? 56 : 28;
  const h = size === 'lg' ? 80 : 40;
  return (
    <div style={{
      width: w, height: h,
      background: 'linear-gradient(135deg, #1a3a8f 0%, #0d1f4f 100%)',
      borderRadius: size === 'lg' ? 6 : 4,
      border: '1px solid rgba(255,255,255,0.2)',
      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
      flexShrink: 0,
    }} />
  );
}

// ─── Player seat ─────────────────────────────────────────────────────────────

function nameHash(name: string): string {
  const colors = ['#c0392b', '#8e44ad', '#2980b9', '#27ae60', '#d35400', '#16a085'];
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
  myCards: [Card, Card] | null;
  turnTimeLeft: number;
  showCards: boolean;
}

function PlayerSeatOval({
  player, isMe, isActive, isDealer, isSB, isBB,
  myCards, turnTimeLeft, showCards,
}: SeatProps) {
  const isFolded = player.status === 'folded';
  const isAllIn = player.status === 'all-in';
  const cards = isMe ? myCards : (showCards && player.holeCards ? player.holeCards : null);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      opacity: isFolded ? 0.35 : 1,
      filter: isActive ? 'drop-shadow(0 0 8px rgba(201,168,76,0.8))' : 'none',
      minWidth: 72,
    }}>
      {/* Hole cards */}
      <div style={{ display: 'flex', gap: 2 }}>
        {(cards) ? (
          cards.map((c, i) => <PokerCard key={i} card={c} size="sm" />)
        ) : (
          <>
            <CardBack size="sm" />
            <CardBack size="sm" />
          </>
        )}
      </div>

      {/* Avatar */}
      <div style={{
        width: 38, height: 38,
        borderRadius: '50%',
        background: nameHash(player.name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 'bold', color: '#fff',
        border: isActive ? '2px solid #c9a84c' : '2px solid rgba(255,255,255,0.15)',
        position: 'relative',
        flexShrink: 0,
      }}>
        {player.name[0]?.toUpperCase()}
        {isDealer && (
          <div style={{
            position: 'absolute', top: -6, right: -6,
            width: 18, height: 18, borderRadius: '50%',
            background: '#fff', color: '#000',
            fontSize: 9, fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid #ccc',
          }}>D</div>
        )}
        {isSB && !isDealer && (
          <div style={{
            position: 'absolute', top: -6, right: -6,
            width: 18, height: 18, borderRadius: '50%',
            background: '#3498db', color: '#fff',
            fontSize: 8, fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>SB</div>
        )}
        {isBB && !isDealer && (
          <div style={{
            position: 'absolute', top: -6, right: -6,
            width: 18, height: 18, borderRadius: '50%',
            background: '#e74c3c', color: '#fff',
            fontSize: 8, fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>BB</div>
        )}
      </div>

      {/* Name + balance */}
      <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
        <div style={{
          fontSize: 10, color: isMe ? '#c9a84c' : '#e8e8e8',
          fontWeight: isMe ? 'bold' : 'normal',
          maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {player.name}
          {isMe && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 8 }}> (you)</span>}
        </div>
        <div style={{ fontSize: 10, color: '#4caf50', fontWeight: 'bold' }}>
          ${player.balance.toLocaleString()}
        </div>
      </div>

      {/* Bet + status */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        {player.bet > 0 && (
          <div style={{
            fontSize: 9, color: '#c9a84c',
            background: 'rgba(201,168,76,0.15)',
            borderRadius: 3, padding: '1px 4px',
          }}>
            ${player.bet}
          </div>
        )}
        {isAllIn && (
          <div style={{
            fontSize: 8, color: '#fff',
            background: '#e74c3c',
            borderRadius: 3, padding: '1px 4px',
            fontWeight: 'bold',
          }}>ALL IN</div>
        )}
        {isFolded && (
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
            folded
          </div>
        )}
        {isActive && turnTimeLeft > 0 && (
          <div style={{
            fontSize: 11, fontWeight: 'bold',
            color: turnTimeLeft <= 5 ? '#e74c3c' : '#c9a84c',
          }}>
            {turnTimeLeft}s
          </div>
        )}
        {player.lastWin > 0 && (
          <div style={{
            fontSize: 10, color: '#4caf50', fontWeight: 'bold',
            animation: 'none',
          }}>
            +${player.lastWin}
          </div>
        )}
        {player.handResult && (
          <div style={{
            fontSize: 8, color: '#c9a84c',
            background: 'rgba(201,168,76,0.1)',
            borderRadius: 3, padding: '1px 4px',
            maxWidth: 70, textAlign: 'center',
          }}>
            {player.handResult.name}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Action panel ─────────────────────────────────────────────────────────────

interface ActionPanelProps {
  gameState: PokerPublicGameState;
  me: PokerPublicPlayer;
  roomCode: string;
}

function ActionPanel({ gameState, me, roomCode }: ActionPanelProps) {
  const toCall = gameState.currentBet - me.bet;
  const canCheck = toCall <= 0;
  const minRaiseTotal = gameState.currentBet + gameState.minRaise;
  const maxRaise = me.balance + me.bet;
  const [raiseAmt, setRaiseAmt] = useState(Math.min(minRaiseTotal, maxRaise));

  useEffect(() => {
    setRaiseAmt(Math.min(minRaiseTotal, maxRaise));
  }, [minRaiseTotal, maxRaise, gameState.phase]);

  const totalPot = gameState.pots.reduce((s, p) => s + p.amount, 0) + gameState.players.reduce((s, p) => s + p.bet, 0);

  const handleFold = () => { playButton(); socket.emit('pokerFold', roomCode); };
  const handleCheck = () => { playButton(); socket.emit('pokerCheck', roomCode); };
  const handleCall = () => { playChipClink(); socket.emit('pokerCall', roomCode); };
  const handleRaise = () => { playChipClink(); socket.emit('pokerRaise', { roomCode, amount: raiseAmt }); };
  const handleAllIn = () => { playChipClink(); socket.emit('pokerAllIn', roomCode); };

  const potHalf = Math.max(minRaiseTotal, Math.floor(totalPot / 2));
  const potFull = Math.max(minRaiseTotal, totalPot);
  const potDouble = Math.max(minRaiseTotal, totalPot * 2);

  const clampRaise = (v: number) => Math.max(minRaiseTotal, Math.min(maxRaise, v));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: '10px 12px',
      background: 'rgba(0,0,0,0.5)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* Quick raise buttons */}
      {!canCheck && maxRaise > gameState.currentBet && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { label: '½ Pot', val: potHalf },
            { label: 'Pot', val: potFull },
            { label: '2x', val: potDouble },
          ].map(({ label, val }) => {
            const clamped = clampRaise(val);
            if (clamped >= maxRaise) return null;
            return (
              <button
                key={label}
                onClick={() => setRaiseAmt(clamped)}
                style={{
                  padding: '3px 10px', borderRadius: 6,
                  background: raiseAmt === clamped ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#c9a84c', fontSize: 11, cursor: 'pointer',
                }}
              >
                {label} ${clamped}
              </button>
            );
          })}
        </div>
      )}

      {/* Raise slider */}
      {maxRaise > minRaiseTotal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
            ${minRaiseTotal}
          </span>
          <input
            type="range"
            min={minRaiseTotal}
            max={maxRaise}
            step={Math.max(1, Math.floor((maxRaise - minRaiseTotal) / 100))}
            value={raiseAmt}
            onChange={e => setRaiseAmt(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#c9a84c' }}
          />
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
            ${maxRaise}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handleFold}
          style={{
            padding: '10px 20px', borderRadius: 10,
            background: 'rgba(231,76,60,0.2)',
            border: '1px solid rgba(231,76,60,0.4)',
            color: '#e74c3c', fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
          }}
        >
          Fold
        </button>

        {canCheck ? (
          <button
            onClick={handleCheck}
            style={{
              padding: '10px 24px', borderRadius: 10,
              background: 'rgba(52,152,219,0.2)',
              border: '1px solid rgba(52,152,219,0.4)',
              color: '#3498db', fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
            }}
          >
            Check
          </button>
        ) : (
          <button
            onClick={handleCall}
            style={{
              padding: '10px 20px', borderRadius: 10,
              background: 'rgba(52,152,219,0.2)',
              border: '1px solid rgba(52,152,219,0.4)',
              color: '#3498db', fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
            }}
          >
            Call ${Math.min(toCall, me.balance)}
          </button>
        )}

        {maxRaise > minRaiseTotal && (
          <button
            onClick={handleRaise}
            style={{
              padding: '10px 20px', borderRadius: 10,
              background: 'rgba(201,168,76,0.2)',
              border: '1px solid rgba(201,168,76,0.4)',
              color: '#c9a84c', fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
            }}
          >
            Raise ${raiseAmt}
          </button>
        )}

        <button
          onClick={handleAllIn}
          style={{
            padding: '10px 18px', borderRadius: 10,
            background: 'rgba(231,76,60,0.35)',
            border: '1px solid rgba(231,76,60,0.6)',
            color: '#ff6b6b', fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
          }}
        >
          ALL IN ${me.balance}
        </button>
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
  const isMyTurn = state.activePlayerId === myId;
  const isHost = me?.isHost ?? false;
  const totalPot = state.pots.reduce((s, p) => s + p.amount, 0);
  const showCards = state.phase === 'showdown';

  const handleLeave = () => {
    clearSession();
    socket.disconnect();
    onLeave();
    useGameStore.setState({ gameState: null, pokerMyCards: null });
    window.location.reload();
  };

  const handleNextHand = () => {
    playButton();
    socket.emit('pokerNextRound', roomCode);
  };

  // Layout: place players around an oval
  // We position seats using angles around an ellipse
  const seats = state.players;
  const n = seats.length;
  const ovalW = 480;
  const ovalH = 260;
  const cx = ovalW / 2;
  const cy = ovalH / 2;
  const rx = ovalW / 2 - 20;
  const ry = ovalH / 2 - 10;

  // Distribute players evenly around the oval
  // Put "me" at the bottom (angle = PI/2 = 270 degrees)
  const myIndex = seats.findIndex(p => p.id === myId);
  const angleStep = (2 * Math.PI) / n;
  const startAngle = Math.PI / 2; // bottom

  const seatPositions = seats.map((_, i) => {
    const offset = i - myIndex;
    const angle = startAngle + offset * angleStep;
    const x = cx + rx * Math.cos(angle);
    const y = cy + ry * Math.sin(angle);
    return { x, y };
  });

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0a0f14',
      overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.6)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#c9a84c', fontWeight: 'bold', fontSize: 15 }}>♣ Poker</span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#c9a84c', letterSpacing: '0.2em', fontSize: 13 }}>
            {roomCode}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>R{state.round}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {me && (
            <span style={{ fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>$</span>
              <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{me.balance.toLocaleString()}</span>
            </span>
          )}
          <button
            onClick={handleLeave}
            style={{
              padding: '4px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer',
            }}
          >
            Leave
          </button>
        </div>
      </div>

      {/* Message bar */}
      <div style={{
        textAlign: 'center',
        padding: '5px 0',
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        {state.message}
      </div>

      {/* Table area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 8px',
        overflow: 'hidden',
      }}>
        {/* Oval table with players */}
        <div style={{ position: 'relative', width: ovalW, height: ovalH + 120, maxWidth: '100%' }}>
          {/* Felt oval */}
          <div style={{
            position: 'absolute',
            left: 0, top: 40,
            width: ovalW,
            height: ovalH,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at 40% 35%, #1a5c2a 0%, #0d3a18 60%, #082210 100%)',
            border: '6px solid #8B6914',
            boxShadow: '0 0 0 2px #5a4208, inset 0 0 40px rgba(0,0,0,0.4)',
          }} />

          {/* Community cards (centered on table) */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: 40 + ovalH / 2 - 22,
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 4,
            alignItems: 'center',
          }}>
            {state.communityCards.map((c, i) => (
              <PokerCard key={i} card={c} size="sm" />
            ))}
            {Array.from({ length: 5 - state.communityCards.length }).map((_, i) => (
              <div key={`empty-${i}`} style={{
                width: 28, height: 40,
                borderRadius: 4,
                border: '1px dashed rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.2)',
              }} />
            ))}
          </div>

          {/* Pot display */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: 40 + ovalH / 2 + 28,
            transform: 'translateX(-50%)',
            textAlign: 'center',
          }}>
            {totalPot > 0 && (
              <div style={{
                background: 'rgba(0,0,0,0.5)',
                borderRadius: 8, padding: '2px 10px',
                color: '#c9a84c', fontWeight: 'bold', fontSize: 13,
                border: '1px solid rgba(201,168,76,0.3)',
                whiteSpace: 'nowrap',
              }}>
                POT: ${totalPot.toLocaleString()}
              </div>
            )}
          </div>

          {/* Player seats positioned around oval */}
          {seats.map((player, i) => {
            const pos = seatPositions[i];
            if (!pos) return null;
            const isMe = player.id === myId;
            const isActive = player.id === state.activePlayerId;
            const isDealer = i === state.dealerIndex;
            const isSB = i === state.sbIndex;
            const isBB = i === state.bbIndex;

            return (
              <div
                key={player.id}
                style={{
                  position: 'absolute',
                  left: pos.x,
                  top: pos.y + 40,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <PlayerSeatOval
                  player={player}
                  isMe={isMe}
                  isActive={isActive}
                  isDealer={isDealer}
                  isSB={isSB}
                  isBB={isBB}
                  myCards={isMe ? pokerMyCards : null}
                  turnTimeLeft={state.turnTimeLeft}
                  showCards={showCards}
                />
              </div>
            );
          })}
        </div>

        {/* My hole cards (large, below table) */}
        {(pokerMyCards || (showCards && me?.holeCards)) && (
          <div style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'center',
            marginTop: 8,
          }}>
            {(pokerMyCards ?? me?.holeCards ?? []).map((c, i) => (
              <PokerCard key={i} card={c} size="lg" />
            ))}
          </div>
        )}

        {/* Showdown winners */}
        {state.phase === 'showdown' && state.winners && state.winners.length > 0 && (
          <div style={{
            marginTop: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}>
            {state.winners.map((w, i) => (
              <div key={i} style={{
                background: 'rgba(76,175,80,0.2)',
                border: '1px solid rgba(76,175,80,0.4)',
                borderRadius: 8,
                padding: '4px 14px',
                color: '#4caf50',
                fontSize: 12,
                fontWeight: 'bold',
              }}>
                {w.playerName} wins ${w.amount} — {w.handName}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ flexShrink: 0 }}>
        {isMyTurn && me && me.status === 'active' && (
          <ActionPanel gameState={state} me={me} roomCode={roomCode} />
        )}

        {state.phase === 'waiting' && (
          <div style={{
            padding: '12px', textAlign: 'center',
            color: 'rgba(255,255,255,0.4)', fontSize: 13,
          }}>
            Waiting for players... (need 2+)
            {isHost && (
              <button
                onClick={() => { playButton(); socket.emit('startGame', roomCode); }}
                style={{
                  marginLeft: 12,
                  padding: '6px 16px', borderRadius: 8,
                  background: 'rgba(201,168,76,0.2)',
                  border: '1px solid rgba(201,168,76,0.4)',
                  color: '#c9a84c', fontSize: 12, fontWeight: 'bold', cursor: 'pointer',
                }}
              >
                Start Game
              </button>
            )}
          </div>
        )}

        {state.phase === 'showdown' && (
          <div style={{
            padding: '12px', textAlign: 'center',
          }}>
            {isHost ? (
              <button
                onClick={handleNextHand}
                style={{
                  padding: '10px 28px', borderRadius: 10,
                  background: 'rgba(201,168,76,0.2)',
                  border: '1px solid rgba(201,168,76,0.4)',
                  color: '#c9a84c', fontSize: 14, fontWeight: 'bold', cursor: 'pointer',
                }}
              >
                Next Hand →
              </button>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                Waiting for host to start next hand...
              </div>
            )}
          </div>
        )}

        {!isMyTurn && state.activePlayerId && state.phase !== 'showdown' && state.phase !== 'waiting' && (
          <div style={{
            padding: '10px', textAlign: 'center',
            color: 'rgba(255,255,255,0.35)', fontSize: 12,
          }}>
            {state.players.find(p => p.id === state.activePlayerId)?.name}'s turn...
          </div>
        )}

        {(state.phase === 'pre-flop' || state.phase === 'flop' || state.phase === 'turn' || state.phase === 'river') &&
          !state.activePlayerId && (
          <div style={{
            padding: '10px', textAlign: 'center',
            color: 'rgba(255,255,255,0.35)', fontSize: 12,
            animation: 'pulse 1s infinite',
          }}>
            Processing...
          </div>
        )}
      </div>
    </div>
  );
}
