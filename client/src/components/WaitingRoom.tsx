import { socket } from '../lib/socket';
import { useGameStore, clearSession } from '../store/gameStore';
import { playButton } from '../lib/sounds';

export function WaitingRoom() {
  const { gameState, roomCode, myId, setRoomCode } = useGameStore();
  if (!gameState || !roomCode) return null;

  const me = gameState.players.find(p => p.id === myId);
  const isHost = me?.isHost ?? false;
  const activePlayers = gameState.players.filter(p => !p.wantsSitOut);
  const canStart = activePlayers.length >= 2;

  const handleStart = () => {
    playButton();
    socket.emit('startGame', roomCode);
  };

  const handleLeave = () => {
    clearSession();
    socket.disconnect();
    setRoomCode(null);
    useGameStore.setState({ gameState: null });
    window.location.reload();
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {});
    playButton();
  };

  const toggleSitOut = () => {
    playButton();
    socket.emit('sitOut', { roomCode, sitOut: !me?.wantsSitOut });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
         style={{ background: 'radial-gradient(ellipse at 50% 30%, #0d2818 0%, #050d0a 100%)' }}>

      <div className="text-center mb-8">
        <div className="text-4xl mb-2">♠</div>
        <h1 className="font-display text-3xl font-bold text-gold">Waiting Room</h1>
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
          Players ({gameState.players.length}/6)
        </div>
        {gameState.players.map(p => (
          <div
            key={p.id}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl
              ${p.id === myId ? 'bg-gold/10 border border-gold/20' : 'bg-white/5'}
              ${p.wantsSitOut ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center gap-2">
              {p.isHost && <span className="text-gold text-sm">★</span>}
              <span className="text-sm font-medium text-white">
                {p.name}
                {p.id === myId && <span className="text-white/40 text-xs ml-1">(you)</span>}
              </span>
              {p.wantsSitOut && <span className="text-[10px] text-white/40 italic">sitting out</span>}
            </div>
            <span className="text-xs text-green-400 font-bold">${p.balance.toLocaleString()}</span>
          </div>
        ))}

        {gameState.players.length < 6 && (
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

        {me && (
          <button
            onClick={toggleSitOut}
            className={`w-full py-2.5 text-sm rounded-xl transition-colors font-medium ${
              me.wantsSitOut
                ? 'bg-gold/15 text-gold border border-gold/25 hover:bg-gold/25'
                : 'btn-ghost'
            }`}
          >
            {me.wantsSitOut ? '✓ Sitting out — click to play' : 'Sit Out'}
          </button>
        )}

        <button onClick={handleLeave} className="btn-ghost w-full py-3 text-sm">
          Leave Room
        </button>
      </div>
    </div>
  );
}
