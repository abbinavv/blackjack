import { useEffect, useRef, useState } from 'react';
import { socket } from '../lib/socket';
import { useGameStore, clearSession, saveBalance } from '../store/gameStore';
import { PublicGameState } from '../types';
import { DealerArea } from './DealerArea';
import { PlayerSeat } from './PlayerSeat';
import { BetPanel } from './BetPanel';
import { InsurancePanel } from './InsurancePanel';
import { GameControls } from './GameControls';
import { RoundSummary } from './RoundSummary';
import { playShuffle, playButton } from '../lib/sounds';

// ─── Info modal ───────────────────────────────────────────────────────────────

function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0d1f14', border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: 16, padding: '24px 24px 20px', maxWidth: 420, width: '100%',
          maxHeight: '85vh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ color: '#c9a84c', fontWeight: 700, fontSize: 18 }}>♠ Blackjack Rules</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <Section title="Objective">
          Beat the dealer by getting closer to 21 without going over. Cards 2–10 are face value; J, Q, K = 10; Ace = 1 or 11.
        </Section>

        <Section title="Actions">
          <Row label="Hit" desc="Take another card." />
          <Row label="Stand" desc="Keep your hand, end your turn." />
          <Row label="Double Down" desc="Double your bet, receive exactly one more card." />
          <Row label="Split" desc="Split a pair into two separate hands (equal bet on each)." />
          <Row label="Insurance" desc="Side bet (half your bet) when dealer shows an Ace. Pays 2:1 if dealer has Blackjack." />
        </Section>

        <Section title="Payouts">
          <Row label="Blackjack (A + 10)" desc="Pays 3:2" />
          <Row label="Win" desc="Pays 1:1" />
          <Row label="Insurance win" desc="Pays 2:1" />
          <Row label="Push (tie)" desc="Bet returned" />
        </Section>

        <Section title="Dealer Rules">
          Dealer must hit until reaching 17 or higher. Dealer stands on soft 17. If dealer busts, all active players win.
        </Section>

        <Section title="Sitting Out">
          Toggle "Sit Out" in the waiting room to skip rounds without leaving the game.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: '#c9a84c', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{title}</div>
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function Row({ label, desc }: { label: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
      <span style={{ color: '#c9a84c', fontWeight: 600, minWidth: 120, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.6)' }}>{desc}</span>
    </div>
  );
}

// ─── Leave confirmation modal ─────────────────────────────────────────────────

function LeaveModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#0d1f14', border: '1px solid rgba(255,80,80,0.25)',
          borderRadius: 16, padding: '28px 24px', maxWidth: 340, width: '100%',
          textAlign: 'center',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>🃏</div>
        <div style={{ color: 'white', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Leave the table?</div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
          Any active bet will be forfeited. Your balance will be saved.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >Stay</button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
              background: 'rgba(200,50,50,0.75)', color: 'white',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}
          >Leave</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main table ───────────────────────────────────────────────────────────────

export function Table() {
  const { gameState: rawState, roomCode, myId, playerName } = useGameStore();
  const [showInfo, setShowInfo] = useState(false);
  const [showLeave, setShowLeave] = useState(false);

  if (!rawState || !roomCode) return null;
  const gameState = rawState as PublicGameState;

  const prevReshuffle = useRef(false);
  useEffect(() => {
    if (gameState.needsReshuffle && !prevReshuffle.current) playShuffle();
    prevReshuffle.current = !!gameState.needsReshuffle;
  }, [gameState.needsReshuffle]);

  const me = gameState.players.find(p => p.id === myId);
  const myIndex = gameState.players.findIndex(p => p.id === myId);
  const others = gameState.players.filter(p => p.id !== myId);

  const handleLeave = () => {
    if (me && playerName) saveBalance(playerName, me.balance);
    clearSession();
    socket.disconnect();
    useGameStore.setState({ gameState: null, pokerGameState: null, pokerMyCards: null, gameType: null, roomCode: null });
    window.location.reload();
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0a0f14' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 flex-shrink-0"
           style={{ background: 'rgba(0,0,0,0.6)' }}>
        <div className="flex items-center gap-2">
          <span className="text-gold font-display font-bold text-base">♠ Blackjack</span>
          <span className="text-white/20 hidden sm:block">|</span>
          <span className="text-xs text-white/40 hidden sm:block">Room:</span>
          <span className="font-mono font-bold text-gold tracking-widest text-sm">{roomCode}</span>

          {/* Info button */}
          <button
            onClick={() => { playButton(); setShowInfo(true); }}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              border: '1px solid rgba(201,168,76,0.4)',
              background: 'rgba(201,168,76,0.1)',
              color: '#c9a84c', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
            title="Rules & Info"
          >i</button>
        </div>

        <div className="flex items-center gap-2">
          {gameState.needsReshuffle && (
            <span className="text-xs text-yellow-400 hidden sm:block">⟳ Reshuffling</span>
          )}
          {me && (
            <span className="text-xs">
              <span className="text-white/40">$</span>
              <span className="text-green-400 font-bold">{me.balance.toLocaleString()}</span>
            </span>
          )}
          <span className="text-xs text-white/30">R{gameState.round}</span>

          {/* Leave button */}
          <button
            onClick={() => { playButton(); setShowLeave(true); }}
            style={{
              padding: '3px 10px', borderRadius: 8,
              border: '1px solid rgba(200,50,50,0.35)',
              background: 'rgba(200,50,50,0.15)',
              color: 'rgba(255,120,120,0.85)', fontSize: 11,
              fontWeight: 600, cursor: 'pointer',
            }}
          >Leave</button>
        </div>
      </div>

      {/* Felt table */}
      <div className="flex-1 flex flex-col felt-table mx-2 my-2 rounded-2xl overflow-hidden min-h-0">

        {/* Message bar */}
        <div className="text-center py-1.5 text-xs tracking-[0.18em] text-white/35 uppercase border-b border-white/5 flex-shrink-0"
             style={{ background: 'rgba(0,0,0,0.12)' }}>
          {gameState.message}
        </div>

        {/* Other players — compact pill row at top */}
        {others.length > 0 && (
          <div className="flex-shrink-0 border-b border-white/5 px-2 py-1.5"
               style={{ background: 'rgba(0,0,0,0.1)' }}>
            <div className="flex gap-2 justify-center flex-wrap">
              {gameState.players.map((player, i) => {
                if (player.id === myId) return null;
                return (
                  <PlayerSeat
                    key={player.id}
                    player={player}
                    playerIndex={i}
                    gameState={gameState}
                    isMe={false}
                    hideCards={true}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Dealer zone */}
        <div className="flex-1 flex flex-col items-center justify-center py-3 px-2 min-h-0">
          <DealerArea gameState={gameState} />

          {/* Divider — gold rule with center diamond */}
          <div className="flex items-center gap-2 w-full max-w-xs my-3" style={{ opacity: 0.28 }}>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.7))' }} />
            <div className="w-1.5 h-1.5 rotate-45 bg-gold/70" />
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(201,168,76,0.7))' }} />
          </div>

          {/* My seat */}
          {me && myIndex !== -1 && (
            <div className="flex justify-center">
              <PlayerSeat
                key={me.id}
                player={me}
                playerIndex={myIndex}
                gameState={gameState}
                isMe={true}
                hideCards={false}
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="border-t border-white/8 px-3 py-3 flex-shrink-0 flex justify-center"
             style={{ background: 'rgba(0,0,0,0.18)' }}>
          {gameState.phase === 'betting' && <BetPanel />}
          {gameState.phase === 'insurance' && <InsurancePanel />}
          {gameState.phase === 'playing' && <GameControls />}
          {gameState.phase === 'dealer' && (
            <div className="text-white/40 text-sm animate-pulse py-2 tracking-wider">Dealer playing...</div>
          )}
          {gameState.phase === 'dealing' && (
            <div className="text-white/40 text-sm animate-pulse py-2 tracking-wider">Dealing...</div>
          )}
        </div>
      </div>

      <RoundSummary />

      {showInfo  && <InfoModal  onClose={() => setShowInfo(false)} />}
      {showLeave && <LeaveModal onConfirm={handleLeave} onCancel={() => setShowLeave(false)} />}
    </div>
  );
}
