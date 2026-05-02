import { socket } from '../lib/socket';
import { useGameStore, clearSession } from '../store/gameStore';
import { PublicGameState, RoulettePublicGameState } from '../types';
import { playButton } from '../lib/sounds';

function fallbackCopy(text: string) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
  document.body.appendChild(el);
  el.select();
  try { document.execCommand('copy'); } catch {}
  document.body.removeChild(el);
}

export function WaitingRoom() {
  const { gameState: rawState, roomCode, myId, setRoomCode } = useGameStore();
  if (!rawState || !roomCode) return null;

  const isRoulette = (rawState as RoulettePublicGameState).gameType === 'roulette';

  // For blackjack we need wantsSitOut; for roulette we don't have it
  const bjState = isRoulette ? null : rawState as PublicGameState;
  const players = rawState.players;

  const me = players.find(p => p.id === myId);
  const isHost = me?.isHost ?? false;

  // wantsSitOut only exists on blackjack players
  const meWantsSitOut = bjState ? (bjState.players.find(p => p.id === myId) as PublicGameState['players'][0] | undefined)?.wantsSitOut ?? false : false;
  const activePlayers = bjState
    ? bjState.players.filter(p => !(p as PublicGameState['players'][0]).wantsSitOut)
    : players;
  const canStart = activePlayers.length >= 2;

  const handleStart = () => {
    playButton();
    socket.emit('startGame', roomCode);
  };

  const handleLeave = () => {
    clearSession();
    socket.disconnect();
    setRoomCode(null);
    useGameStore.setState({ gameState: null, gameType: null });
    window.location.reload();
  };

  const copyCode = () => {
    playButton();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomCode).catch(() => fallbackCopy(roomCode));
    } else {
      fallbackCopy(roomCode);
    }
  };

  const toggleSitOut = () => {
    playButton();
    socket.emit('sitOut', { roomCode, sitOut: !meWantsSitOut });
  };

  const gameIcon = isRoulette ? '🎡' : '♠';
  const gameTitle = isRoulette ? 'Roulette' : 'Blackjack';
  const maxPlayers = isRoulette ? 8 : 6;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
         style={{ background: 'radial-gradient(ellipse at 50% 30%, #0d2818 0%, #050d0a 100%)' }}>

      <div className="text-center mb-8">
        <div className="text-4xl mb-2">{gameIcon}</div>
        <h1 className="font-display text-3xl font-bold text-gold">Waiting Room</h1>
        <p className="text-white/30 text-xs mt-1 tracking-widest uppercase">{gameTitle}</p>
      </div>

      {/* Room code */}
      <div
        className="mb-6 px-8 py-5 rounded-2xl text-center cursor-pointer hover:bg-white/10 transition-colors"
        style={{ background: 'rgba(201,168,76,0.1)', border: '2px dashed rgba(201,168,76,0.4)' }}
        onClick={copyCode}
        title="Click to copy"
      >
        <div className="text-xs uppercase tracking-widest text-white/40 mb-1">Room Code</div>
        <div className="font-mono font-black text-5xl text-gold tracking-[0.3em]">{roomCode}</div>
        <div className="text-xs text-white/30 mt-1">Tap to copy</div>
      </div>

      {/* Player list */}
      <div
        className="w-full max-w-sm rounded-2xl p-4 mb-5 space-y-2"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        <div className="text-xs uppercase tracking-widest text-white/40 mb-3">
          Players ({players.length}/{maxPlayers})
        </div>
        {players.map(p => {
          const wantsSitOut = bjState
            ? (bjState.players.find(bp => bp.id === p.id) as PublicGameState['players'][0] | undefined)?.wantsSitOut ?? false
            : false;
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl
                ${p.id === myId ? 'bg-gold/10 border border-gold/20' : 'bg-white/5'}
                ${wantsSitOut ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                {p.isHost && <span className="text-gold text-sm">★</span>}
                <span className="text-sm font-medium text-white">
                  {p.name}
                  {p.id === myId && <span className="text-white/40 text-xs ml-1">(you)</span>}
                </span>
                {wantsSitOut && <span className="text-[10px] text-white/40 italic">sitting out</span>}
              </div>
              <span className="text-xs text-green-400 font-bold">${p.balance.toLocaleString()}</span>
            </div>
          );
        })}

        {players.length < maxPlayers && (
          <div className="flex items-center gap-2 px-3 py-2 text-white/25 text-sm">
            <span className="text-lg">+</span>
            <span>Waiting for players...</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="w-full max-w-sm space-y-3">
        {isHost ? (
          <>
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="btn-primary w-full py-4 text-base"
            >
              {canStart ? 'Start Game →' : `Need ${2 - activePlayers.length} more active player(s)`}
            </button>
            {!canStart && (
              <p className="text-center text-white/30 text-xs">Share the room code to invite friends</p>
            )}
          </>
        ) : (
          <div className="text-center py-3 text-white/40 text-sm animate-pulse">
            Waiting for host to start the game...
          </div>
        )}

        {me && !isRoulette && (
          <button
            onClick={toggleSitOut}
            className={`w-full py-2.5 text-sm rounded-xl transition-colors font-medium ${
              meWantsSitOut
                ? 'bg-gold/15 text-gold border border-gold/25 hover:bg-gold/25'
                : 'btn-ghost'
            }`}
          >
            {meWantsSitOut ? '✓ Sitting out — click to play' : 'Sit Out'}
          </button>
        )}

        <button onClick={handleLeave} className="btn-ghost w-full py-3 text-sm">
          Leave Room
        </button>
      </div>
    </div>
  );
}
