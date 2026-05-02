import { useEffect } from 'react';
import { socket } from '../lib/socket';
import { useGameStore, saveBalance } from '../store/gameStore';
import { playWin, playLose, playBlackjack } from '../lib/sounds';
import { fullHandScore, isBlackjack as bjCheck } from '../lib/clientRules';
import type { PublicGameState } from '../types';

function getHandResult(
  hand: { cards: { rank: string; suit: string; faceUp: boolean }[]; bet: number; status: string; isSplit: boolean },
  dealerCards: { rank: string; suit: string; faceUp: boolean }[],
  dealerBJ: boolean
): { label: string; net: number; color: string } {
  const dealerScore = fullHandScore(dealerCards);
  const playerBJ = bjCheck(hand.cards as any) && !hand.isSplit;

  if (hand.status === 'bust') return { label: 'Bust', net: -hand.bet, color: 'text-red-400' };
  if (playerBJ && dealerBJ) return { label: 'Push (Both BJ)', net: 0, color: 'text-gray-400' };
  if (playerBJ) return { label: 'Blackjack! 🎉', net: Math.floor(hand.bet * 1.5), color: 'text-yellow-400' };
  if (dealerBJ) return { label: 'Dealer BJ', net: -hand.bet, color: 'text-red-400' };
  if (dealerScore > 21) return { label: 'Dealer Bust — Win!', net: hand.bet, color: 'text-green-400' };

  const playerScore = fullHandScore(hand.cards as any);
  if (playerScore > dealerScore) return { label: 'Win!', net: hand.bet, color: 'text-green-400' };
  if (playerScore === dealerScore) return { label: 'Push', net: 0, color: 'text-gray-400' };
  return { label: 'Loss', net: -hand.bet, color: 'text-red-400' };
}

export function RoundSummary() {
  const { gameState: _gameState, roomCode, myId, playerName, addToast } = useGameStore();
  const gameState = _gameState as PublicGameState | null;

  useEffect(() => {
    if (!gameState || gameState.phase !== 'complete') return;
    const me = gameState.players.find(p => p.id === myId);
    if (!me || !playerName || me.isSittingOut) return;

    saveBalance(playerName, me.balance);

    let net = 0;
    const dealerBJ = bjCheck(gameState.dealerHand as any);
    for (const hand of me.hands) {
      const r = getHandResult(hand as any, gameState.dealerHand as any, dealerBJ);
      net += r.net;
    }

    const hasBJ = me.hands.some(h => bjCheck(h.cards as any) && !h.isSplit);
    if (hasBJ) {
      playBlackjack();
      addToast('♠ Blackjack! +$' + Math.floor(me.hands[0].bet * 1.5), 'win');
    } else if (net > 0) {
      playWin();
      addToast(`+$${net} — Win!`, 'win');
    } else if (net < 0) {
      playLose();
      addToast(`-$${Math.abs(net)} — Loss`, 'loss');
    } else {
      addToast('Push — bet returned', 'info');
    }
  }, [gameState?.phase]);

  if (!gameState || gameState.phase !== 'complete') return null;

  const me = gameState.players.find(p => p.id === myId);
  const isHost = me?.isHost ?? false;
  const dealerScore = gameState.dealerScore;
  const dealerBust = dealerScore > 21;
  const dealerBJ = bjCheck(gameState.dealerHand as any);

  const toggleSitOut = () => {
    socket.emit('sitOut', { roomCode, sitOut: !me?.wantsSitOut });
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-lg rounded-2xl p-5 animate-slideUp flex flex-col gap-4"
        style={{ background: '#0d1f14', border: '1px solid rgba(201,168,76,0.3)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="text-center">
          <h2 className="font-display text-xl text-gold font-bold">Round {gameState.round}</h2>
          <div className="text-sm text-white/50 mt-0.5">
            Dealer: <span className="font-bold text-white/70">{dealerBJ ? '♠ Blackjack' : dealerBust ? 'BUST' : dealerScore}</span>
            {gameState.needsReshuffle && <span className="ml-2 text-yellow-400 text-xs">⟳ Reshuffling</span>}
          </div>
        </div>

        {/* Player rows */}
        <div className="space-y-2">
          {gameState.players.filter(p => !p.isSittingOut && p.hands.length > 0).map(player => {
            let totalNet = 0;
            if (player.insuranceBet > 0) {
              totalNet += dealerBJ ? player.insuranceBet * 2 : -player.insuranceBet;
            }

            return (
              <div
                key={player.id}
                className={`rounded-xl p-3 ${player.id === myId ? 'bg-gold/10 border border-gold/30' : 'bg-white/5'}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-white">
                    {player.isHost && <span className="text-gold mr-1">★</span>}
                    {player.name}
                    {player.id === myId && <span className="text-white/40 text-xs ml-1">(you)</span>}
                  </span>
                  <span className="text-sm text-green-400 font-bold">${player.balance.toLocaleString()}</span>
                </div>

                <div className="space-y-1">
                  {player.hands.map((hand, hi) => {
                    const result = getHandResult(hand as any, gameState.dealerHand as any, dealerBJ);
                    totalNet += result.net;
                    return (
                      <div key={hi} className="flex items-center justify-between text-xs">
                        <span className="text-white/50">
                          Hand {hi + 1}: {fullHandScore(hand.cards as any)}
                          {hand.isSplit && <span className="text-purple-400 ml-1">split</span>}
                          {hand.isDoubled && <span className="text-blue-400 ml-1">2x</span>}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={result.color}>{result.label}</span>
                          <span className={`font-bold tabular-nums ${result.net > 0 ? 'text-green-400' : result.net < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {result.net > 0 ? `+$${result.net}` : result.net < 0 ? `-$${Math.abs(result.net)}` : '±$0'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {player.insuranceBet > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-blue-400">Insurance (${player.insuranceBet})</span>
                      <span className={`font-bold ${dealerBJ ? 'text-green-400' : 'text-red-400'}`}>
                        {dealerBJ ? `+$${player.insuranceBet * 2}` : `-$${player.insuranceBet}`}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs border-t border-white/10 pt-1 mt-0.5">
                    <span className="text-white/40 font-bold">NET</span>
                    <span className={`font-black text-sm tabular-nums ${totalNet > 0 ? 'text-green-400' : totalNet < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {totalNet > 0 ? `+$${totalNet}` : totalNet < 0 ? `-$${Math.abs(totalNet)}` : '±$0'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Sitting-out players */}
          {gameState.players.filter(p => p.isSittingOut).length > 0 && (
            <div className="text-xs text-white/30 text-center">
              Sitting out: {gameState.players.filter(p => p.isSittingOut).map(p => p.name).join(', ')}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          {me && (
            <button
              onClick={toggleSitOut}
              className={`text-xs py-2 rounded-lg transition-colors font-medium ${
                me.wantsSitOut
                  ? 'bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30'
                  : 'bg-white/8 text-white/50 hover:text-white/70 border border-white/10'
              }`}
            >
              {me.wantsSitOut ? '✓ Sitting out next round — click to re-join' : 'Sit out next round'}
            </button>
          )}

          {isHost ? (
            <button
              onClick={() => socket.emit('nextRound', roomCode)}
              className="btn-primary py-3 text-base font-bold"
            >
              Next Round →
            </button>
          ) : (
            <p className="text-white/40 text-sm text-center animate-pulse py-1">
              Waiting for host to start next round...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
