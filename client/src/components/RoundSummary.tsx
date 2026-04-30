import { useEffect } from 'react';
import { socket } from '../lib/socket';
import { useGameStore, saveBalance } from '../store/gameStore';
import { playWin, playLose, playBlackjack } from '../lib/sounds';
import { fullHandScore, isBlackjack as bjCheck } from '../lib/clientRules';

// Minimal client-side rule helpers for display only
function getHandResult(
  hand: { cards: { rank: string; suit: string; faceUp: boolean }[]; bet: number; status: string; isSplit: boolean },
  dealerCards: { rank: string; suit: string; faceUp: boolean }[],
  dealerBJ: boolean
): { label: string; net: number; color: string } {
  const dealerScore = fullHandScore(dealerCards);
  const playerScore = fullHandScore(hand.cards as any);
  const playerBJ = bjCheck(hand.cards as any) && !hand.isSplit;

  if (hand.status === 'bust') return { label: 'Bust', net: -hand.bet, color: 'text-red-400' };
  if (playerBJ && dealerBJ) return { label: 'Push (Both BJ)', net: 0, color: 'text-gray-400' };
  if (playerBJ) return { label: 'Blackjack! 🎉', net: Math.floor(hand.bet * 1.5), color: 'text-yellow-400' };
  if (dealerBJ) return { label: 'Dealer BJ', net: -hand.bet, color: 'text-red-400' };
  if (dealerScore > 21) return { label: 'Dealer Bust — Win!', net: hand.bet, color: 'text-green-400' };
  if (playerScore > dealerScore) return { label: 'Win!', net: hand.bet, color: 'text-green-400' };
  if (playerScore === dealerScore) return { label: 'Push', net: 0, color: 'text-gray-400' };
  return { label: 'Loss', net: -hand.bet, color: 'text-red-400' };
}

export function RoundSummary() {
  const { gameState, roomCode, myId, playerName } = useGameStore();

  useEffect(() => {
    if (!gameState || gameState.phase !== 'complete') return;
    const me = gameState.players.find(p => p.id === myId);
    if (!me || !playerName) return;

    // Save balance
    saveBalance(playerName, me.balance);

    // Play sound based on net result
    let net = 0;
    const dealerBJ = bjCheck(gameState.dealerHand as any);
    for (const hand of me.hands) {
      const r = getHandResult(hand as any, gameState.dealerHand as any, dealerBJ);
      net += r.net;
    }
    if (me.hands.some(h => bjCheck(h.cards as any) && !h.isSplit)) playBlackjack();
    else if (net > 0) playWin();
    else if (net < 0) playLose();
  }, [gameState?.phase]);

  if (!gameState || gameState.phase !== 'complete') return null;

  const me = gameState.players.find(p => p.id === myId);
  const isHost = me?.isHost ?? false;
  const dealerScore = gameState.dealerScore;
  const dealerBust = dealerScore > 21;
  const dealerBJ = bjCheck(gameState.dealerHand as any);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-lg rounded-2xl p-6 animate-slideUp"
        style={{ background: '#0d1f14', border: '1px solid rgba(201,168,76,0.3)' }}
      >
        {/* Header */}
        <div className="text-center mb-5">
          <h2 className="font-display text-2xl text-gold font-bold">Round {gameState.round} Results</h2>
          <div className="text-sm text-white/50 mt-1">
            Dealer: {dealerBJ ? 'Blackjack' : dealerBust ? 'Bust' : dealerScore}
            {gameState.needsReshuffle && (
              <span className="ml-2 text-yellow-400">⟳ Reshuffling next round</span>
            )}
          </div>
        </div>

        {/* Player rows */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
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
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-white">
                    {player.isHost && <span className="text-gold mr-1">★</span>}
                    {player.name}
                    {player.id === myId && <span className="text-white/40 text-xs ml-1">(you)</span>}
                  </span>
                  <span className="text-sm text-green-400 font-bold">${player.balance.toLocaleString()}</span>
                </div>

                <div className="space-y-1.5">
                  {player.hands.map((hand, hi) => {
                    const result = getHandResult(hand as any, gameState.dealerHand as any, dealerBJ);
                    totalNet += result.net;
                    return (
                      <div key={hi} className="flex items-center justify-between text-xs">
                        <span className="text-white/60">
                          Hand {hi + 1}: {fullHandScore(hand.cards as any)}
                          {hand.isSplit && <span className="text-purple-400 ml-1">split</span>}
                          {hand.isDoubled && <span className="text-blue-400 ml-1">2x</span>}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={result.color}>{result.label}</span>
                          <span className={`font-bold ${result.net > 0 ? 'text-green-400' : result.net < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            {result.net > 0 ? `+$${result.net}` : result.net < 0 ? `-$${Math.abs(result.net)}` : 'Push'}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Insurance line */}
                  {player.insuranceBet > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-blue-400">Insurance (${player.insuranceBet})</span>
                      <span className={`font-bold ${dealerBJ ? 'text-green-400' : 'text-red-400'}`}>
                        {dealerBJ ? `+$${player.insuranceBet * 2}` : `-$${player.insuranceBet}`}
                      </span>
                    </div>
                  )}

                  {/* Net */}
                  <div className="flex items-center justify-between text-xs border-t border-white/10 pt-1 mt-1">
                    <span className="text-white/40">Net</span>
                    <span className={`font-bold ${totalNet > 0 ? 'text-green-400' : totalNet < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {totalNet > 0 ? `+$${totalNet}` : totalNet < 0 ? `-$${Math.abs(totalNet)}` : '$0'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-5 flex gap-3 justify-center">
          {isHost ? (
            <button
              onClick={() => socket.emit('nextRound', roomCode)}
              className="btn-primary px-8"
            >
              Next Round →
            </button>
          ) : (
            <p className="text-white/40 text-sm animate-pulse">Waiting for host to start next round...</p>
          )}
        </div>
      </div>
    </div>
  );
}
