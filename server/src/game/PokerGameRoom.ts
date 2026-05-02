import { EventEmitter } from 'events';
import { Card, Rank, Suit, PokerPhase, PokerPublicGameState, PokerPublicPlayer, PokerPot, PokerWinner } from './types';
import { bestHand } from './handEvaluator';

const STARTING_BALANCE = 1000;
const REBUY_AMOUNT = 200;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const TURN_SECONDS = 30;
const DISCONNECT_GRACE_MS = 60_000;
const SHOWDOWN_DELAY_MS = 6_000;

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function createDeck(): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ suit, rank, faceUp: true });
    }
  }
  return shuffle(cards);
}

function shuffle(cards: Card[]): Card[] {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

interface PokerPlayerInternal {
  id: string;
  name: string;
  balance: number;
  holeCards: [Card, Card] | null;
  bet: number;
  totalBet: number;
  status: 'active' | 'folded' | 'all-in' | 'sitting-out';
  isHost: boolean;
  isConnected: boolean;
  lastWin: number;
  isDisconnected: boolean;
}

interface PokerGameStateInternal {
  roomCode: string;
  phase: PokerPhase;
  players: PokerPlayerInternal[];
  deck: Card[];
  communityCards: Card[];
  pots: PokerPot[];
  currentBet: number;
  minRaise: number;
  activeIndex: number;
  dealerIndex: number;
  lastAggressorIndex: number;
  toAct: string[];
  round: number;
  turnTimeLeft: number;
  message: string;
  winners: PokerWinner[] | null;
}

export class PokerGameRoom extends EventEmitter {
  private state: PokerGameStateInternal;
  private turnInterval: NodeJS.Timeout | null = null;
  private showdownTimeout: NodeJS.Timeout | null = null;
  private disconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor(roomCode: string, hostId: string, hostName: string, savedBalance?: number) {
    super();
    this.state = {
      roomCode,
      phase: 'waiting',
      players: [this.makePlayer(hostId, hostName, savedBalance, true)],
      deck: [],
      communityCards: [],
      pots: [],
      currentBet: 0,
      minRaise: BIG_BLIND,
      activeIndex: -1,
      dealerIndex: 0,
      lastAggressorIndex: -1,
      toAct: [],
      round: 0,
      turnTimeLeft: TURN_SECONDS,
      message: 'Waiting for players...',
      winners: null,
    };
  }

  private makePlayer(id: string, name: string, savedBalance?: number, isHost = false): PokerPlayerInternal {
    const balance = savedBalance && savedBalance >= 10 && savedBalance <= 50000
      ? savedBalance : STARTING_BALANCE;
    return {
      id, name, balance,
      holeCards: null,
      bet: 0, totalBet: 0,
      status: 'active',
      isHost, isConnected: true, lastWin: 0,
      isDisconnected: false,
    };
  }

  private broadcastState(message?: string) {
    if (message) this.state.message = message;
    this.emit('stateChange', this.getPublicState());
    // Emit private hole cards
    const cardsMap = new Map<string, [Card, Card]>();
    for (const p of this.state.players) {
      if (p.holeCards) cardsMap.set(p.id, p.holeCards);
    }
    if (cardsMap.size > 0) {
      this.emit('privateCards', cardsMap);
    }
  }

  // ─── Room management ────────────────────────────────────────────────────────

  addPlayer(id: string, name: string, savedBalance?: number): boolean {
    if (this.state.players.length >= 6) return false;
    // Allow joining between hands (waiting/showdown); block during active hand
    if (this.isActivePhase()) return false;
    this.state.players.push(this.makePlayer(id, name, savedBalance));
    this.broadcastState(`${this.state.players[this.state.players.length - 1].name} joined`);
    return true;
  }

  removePlayer(id: string): void {
    const player = this.getPlayer(id);
    if (!player) return;

    if (this.isActivePhase() && player.status === 'active') {
      player.status = 'folded';
      if (this.state.players[this.state.activeIndex]?.id === id) {
        this.removeFromToAct(id);
        this.advanceAction();
      } else {
        this.removeFromToAct(id);
      }
    }

    this.state.players = this.state.players.filter(p => p.id !== id);
    if (this.state.players.length === 0) return;

    if (!this.state.players.some(p => p.isHost)) {
      this.state.players[0].isHost = true;
    }

    if (this.state.activeIndex >= this.state.players.length) {
      this.state.activeIndex = this.state.players.length - 1;
    }

    this.broadcastState();
  }

  markDisconnected(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (!player) return;
    player.isDisconnected = true;
    player.isConnected = false;

    const existing = this.disconnectTimers.get(playerId);
    if (existing) clearTimeout(existing);

    if (this.isActivePhase() && this.state.players[this.state.activeIndex]?.id === playerId) {
      this.autoAction(playerId);
    }

    this.broadcastState(`${player.name} disconnected`);
  }

  scheduleDisconnectCleanup(playerId: string, onCleanup: () => void): void {
    const timer = setTimeout(() => {
      const player = this.getPlayer(playerId);
      if (player?.isDisconnected) {
        this.removePlayer(playerId);
        onCleanup();
      }
      this.disconnectTimers.delete(playerId);
    }, DISCONNECT_GRACE_MS) as unknown as NodeJS.Timeout;
    this.disconnectTimers.set(playerId, timer);
  }

  rejoinPlayer(newSocketId: string, name: string): string | null {
    const player = this.state.players.find(
      p => p.name.toLowerCase() === name.toLowerCase() && p.isDisconnected
    );
    if (!player) return null;
    const oldId = player.id;
    player.id = newSocketId;
    player.isDisconnected = false;
    player.isConnected = true;

    const timer = this.disconnectTimers.get(oldId);
    if (timer) { clearTimeout(timer); this.disconnectTimers.delete(oldId); }

    // Update toAct list with new id
    const idx = this.state.toAct.indexOf(oldId);
    if (idx !== -1) this.state.toAct[idx] = newSocketId;

    return oldId;
  }

  getPhase(): PokerPhase { return this.state.phase; }
  getPlayer(id: string): PokerPlayerInternal | undefined {
    return this.state.players.find(p => p.id === id);
  }
  getPlayerHoleCards(id: string): [Card, Card] | null {
    return this.getPlayer(id)?.holeCards ?? null;
  }
  isHost(id: string): boolean { return this.getPlayer(id)?.isHost ?? false; }
  isEmpty(): boolean { return this.state.players.length === 0; }
  getPlayerCount(): number { return this.state.players.length; }

  destroy(): void {
    this.clearTurnTimer();
    if (this.showdownTimeout) { clearTimeout(this.showdownTimeout); this.showdownTimeout = null; }
    for (const t of this.disconnectTimers.values()) clearTimeout(t);
    this.disconnectTimers.clear();
  }

  private isActivePhase(): boolean {
    const ap: PokerPhase[] = ['pre-flop', 'flop', 'turn', 'river'];
    return ap.includes(this.state.phase);
  }

  // ─── Game start ─────────────────────────────────────────────────────────────

  startGame(hostId: string): boolean {
    if (!this.isHost(hostId)) return false;
    const activePlayers = this.state.players.filter(p => p.status !== 'sitting-out');
    if (activePlayers.length < 2) return false;
    if (this.state.phase !== 'waiting' && this.state.phase !== 'showdown') return false;
    this.dealNewHand();
    return true;
  }

  private dealNewHand(): void {
    this.clearTurnTimer();
    if (this.showdownTimeout) { clearTimeout(this.showdownTimeout); this.showdownTimeout = null; }

    this.state.round++;
    this.state.communityCards = [];
    this.state.pots = [];
    this.state.winners = null;
    this.state.currentBet = BIG_BLIND;
    this.state.minRaise = BIG_BLIND;

    // Reset player states
    for (const p of this.state.players) {
      p.holeCards = null;
      p.bet = 0;
      p.totalBet = 0;
      p.lastWin = 0;
      if (p.balance === 0) {
        p.balance = REBUY_AMOUNT;
      }
      if (p.status === 'sitting-out') continue;
      p.status = 'active';
    }

    const activePlayers = this.state.players.filter(p => p.status !== 'sitting-out');
    if (activePlayers.length < 2) {
      this.state.phase = 'waiting';
      this.broadcastState('Not enough players');
      return;
    }

    // Advance dealer
    this.state.dealerIndex = this.nextActiveIndex(this.state.dealerIndex);

    const numActive = activePlayers.length;
    let sbIdx: number;
    let bbIdx: number;

    if (numActive === 2) {
      // Heads-up: dealer is SB
      sbIdx = this.state.dealerIndex;
      bbIdx = this.nextActiveIndex(sbIdx);
    } else {
      sbIdx = this.nextActiveIndex(this.state.dealerIndex);
      bbIdx = this.nextActiveIndex(sbIdx);
    }

    // Create fresh deck and deal hole cards
    this.state.deck = createDeck();
    for (const p of activePlayers) {
      const c1 = this.state.deck.pop()!;
      const c2 = this.state.deck.pop()!;
      p.holeCards = [{ ...c1, faceUp: true }, { ...c2, faceUp: true }];
    }

    // Post blinds
    const sbPlayer = this.state.players[sbIdx];
    const bbPlayer = this.state.players[bbIdx];

    const sbAmount = Math.min(SMALL_BLIND, sbPlayer.balance);
    sbPlayer.balance -= sbAmount;
    sbPlayer.bet = sbAmount;
    sbPlayer.totalBet = sbAmount;
    if (sbPlayer.balance === 0) sbPlayer.status = 'all-in';

    const bbAmount = Math.min(BIG_BLIND, bbPlayer.balance);
    bbPlayer.balance -= bbAmount;
    bbPlayer.bet = bbAmount;
    bbPlayer.totalBet = bbAmount;
    if (bbPlayer.balance === 0) bbPlayer.status = 'all-in';

    this.state.currentBet = bbAmount;

    // UTG is left of BB, acts first pre-flop
    const utgIdx = this.nextActiveIndex(bbIdx);
    this.state.activeIndex = utgIdx;
    this.state.lastAggressorIndex = bbIdx;

    // toAct: all active players from UTG → BB order; BB acts last (option to raise)
    // Build by going UTG → ... → SB, then append BB separately to avoid duplicates
    this.state.toAct = [];
    let cur = utgIdx;
    const seen = new Set<number>();
    while (!seen.has(cur)) {
      seen.add(cur);
      const p = this.state.players[cur];
      if (p.status === 'active' && p.id !== bbPlayer.id) this.state.toAct.push(p.id);
      cur = this.nextActiveIndex(cur);
      if (cur === utgIdx) break;
    }
    if (bbPlayer.status === 'active') {
      this.state.toAct.push(bbPlayer.id);
    }

    this.state.phase = 'pre-flop';
    this.broadcastState(`Round ${this.state.round} — Pre-Flop`);
    this.startTurnTimer();
  }

  private nextActiveIndex(fromIndex: number): number {
    const n = this.state.players.length;
    let idx = (fromIndex + 1) % n;
    let tries = 0;
    while (tries < n) {
      const p = this.state.players[idx];
      if (p.status !== 'sitting-out' && p.status !== 'folded') return idx;
      idx = (idx + 1) % n;
      tries++;
    }
    return fromIndex;
  }

  private nextActingIndex(fromIndex: number): number {
    const n = this.state.players.length;
    let idx = (fromIndex + 1) % n;
    let tries = 0;
    while (tries < n) {
      const p = this.state.players[idx];
      if (p.status === 'active') return idx;
      idx = (idx + 1) % n;
      tries++;
    }
    return -1;
  }

  private removeFromToAct(playerId: string): void {
    this.state.toAct = this.state.toAct.filter(id => id !== playerId);
  }

  // ─── Betting actions ─────────────────────────────────────────────────────────

  fold(playerId: string): boolean {
    if (!this.isActivePhase()) return false;
    const player = this.getPlayer(playerId);
    if (!player || player.status !== 'active') return false;
    if (this.state.players[this.state.activeIndex]?.id !== playerId) return false;

    player.status = 'folded';
    this.removeFromToAct(playerId);
    this.broadcastState(`${player.name} folds`);
    this.advanceAction();
    return true;
  }

  check(playerId: string): boolean {
    if (!this.isActivePhase()) return false;
    const player = this.getPlayer(playerId);
    if (!player || player.status !== 'active') return false;
    if (this.state.players[this.state.activeIndex]?.id !== playerId) return false;
    if (player.bet < this.state.currentBet) return false;

    this.removeFromToAct(playerId);
    this.broadcastState(`${player.name} checks`);
    this.advanceAction();
    return true;
  }

  call(playerId: string): boolean {
    if (!this.isActivePhase()) return false;
    const player = this.getPlayer(playerId);
    if (!player || player.status !== 'active') return false;
    if (this.state.players[this.state.activeIndex]?.id !== playerId) return false;

    const toCall = this.state.currentBet - player.bet;
    const amount = Math.min(toCall, player.balance);
    player.balance -= amount;
    player.bet += amount;
    player.totalBet += amount;

    if (player.balance === 0) player.status = 'all-in';

    this.removeFromToAct(playerId);
    this.broadcastState(`${player.name} calls $${player.bet}`);
    this.advanceAction();
    return true;
  }

  raise(playerId: string, totalAmount: number): boolean {
    if (!this.isActivePhase()) return false;
    const player = this.getPlayer(playerId);
    if (!player || player.status !== 'active') return false;
    if (this.state.players[this.state.activeIndex]?.id !== playerId) return false;

    const minTotal = this.state.currentBet + this.state.minRaise;
    const maxTotal = player.balance + player.bet;
    const actualTotal = Math.max(minTotal, Math.min(maxTotal, totalAmount));

    const additional = actualTotal - player.bet;
    if (additional <= 0 || additional > player.balance) return false;

    const raiseSize = actualTotal - this.state.currentBet;
    this.state.minRaise = raiseSize;
    this.state.currentBet = actualTotal;

    player.balance -= additional;
    player.bet = actualTotal;
    player.totalBet += additional;

    if (player.balance === 0) player.status = 'all-in';

    // All other active players must act again
    const aggressorIdx = this.state.players.findIndex(p => p.id === playerId);
    this.state.lastAggressorIndex = aggressorIdx;
    this.state.toAct = [];
    for (const p of this.state.players) {
      if (p.id !== playerId && p.status === 'active') {
        this.state.toAct.push(p.id);
      }
    }

    this.removeFromToAct(playerId);
    this.broadcastState(`${player.name} raises to $${actualTotal}`);
    this.advanceAction();
    return true;
  }

  allIn(playerId: string): boolean {
    if (!this.isActivePhase()) return false;
    const player = this.getPlayer(playerId);
    if (!player || player.status !== 'active') return false;
    if (this.state.players[this.state.activeIndex]?.id !== playerId) return false;

    const totalAmount = player.balance + player.bet;
    if (totalAmount > this.state.currentBet + this.state.minRaise - 1) {
      // It's a raise
      return this.raise(playerId, totalAmount);
    } else {
      // It's a call or partial call
      player.totalBet += player.balance;
      player.bet += player.balance;
      player.balance = 0;
      player.status = 'all-in';
      this.removeFromToAct(playerId);
      this.broadcastState(`${player.name} is ALL IN — $${player.bet}`);
      this.advanceAction();
      return true;
    }
  }

  private autoAction(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (!player) return;
    if (player.bet < this.state.currentBet) {
      // Must fold
      player.status = 'folded';
      this.removeFromToAct(playerId);
      this.broadcastState(`${player.name} auto-folds`);
      this.advanceAction();
    } else {
      // Can check
      this.removeFromToAct(playerId);
      this.broadcastState(`${player.name} auto-checks`);
      this.advanceAction();
    }
  }

  private advanceAction(): void {
    this.clearTurnTimer();

    // Check if only one player remains
    const remaining = this.state.players.filter(
      p => p.status === 'active' || p.status === 'all-in'
    );
    const activeOnly = this.state.players.filter(p => p.status === 'active');

    if (remaining.length === 1 && activeOnly.length <= 1) {
      // Everyone else folded
      if (activeOnly.length === 1) {
        this.awardPotFoldWin(remaining[0]);
        return;
      }
    }

    if (remaining.length === 0) {
      this.awardPotFoldWin(this.state.players.find(p => p.status !== 'folded' && p.status !== 'sitting-out')!);
      return;
    }

    // If toAct is empty, betting round is over
    if (this.state.toAct.length === 0) {
      this.endBettingRound();
      return;
    }

    // Move to next player in toAct
    const nextId = this.state.toAct[0];
    const nextPlayer = this.getPlayer(nextId);
    if (!nextPlayer || nextPlayer.status !== 'active') {
      this.removeFromToAct(nextId);
      this.advanceAction();
      return;
    }

    const nextIdx = this.state.players.findIndex(p => p.id === nextId);
    this.state.activeIndex = nextIdx;
    this.broadcastState(`${nextPlayer.name}'s turn`);
    this.startTurnTimer();
  }

  private awardPotFoldWin(winner: PokerPlayerInternal): void {
    this.clearTurnTimer();
    const totalPot = this.collectPot();
    winner.balance += totalPot;
    winner.lastWin = totalPot;
    this.state.winners = [{
      playerId: winner.id,
      playerName: winner.name,
      amount: totalPot,
      handName: 'Last player standing',
    }];
    this.state.phase = 'showdown';
    this.broadcastState(`${winner.name} wins $${totalPot}!`);
    this.scheduleNextHand();
  }

  private collectPot(): number {
    return this.state.players.reduce((sum, p) => sum + p.totalBet, 0);
  }

  private endBettingRound(): void {
    // Move bets into pots
    this.collectBetsIntoPots();

    // Reset per-round bets
    for (const p of this.state.players) p.bet = 0;
    this.state.currentBet = 0;
    this.state.minRaise = BIG_BLIND;

    const nextPhase = this.nextPhase();
    if (nextPhase === 'showdown') {
      this.runShowdown();
    } else if (nextPhase === 'flop' || nextPhase === 'turn' || nextPhase === 'river') {
      this.dealCommunityCards(nextPhase);
    }
  }

  private nextPhase(): PokerPhase {
    switch (this.state.phase) {
      case 'pre-flop': return 'flop';
      case 'flop': return 'turn';
      case 'turn': return 'river';
      case 'river': return 'showdown';
      default: return 'showdown';
    }
  }

  private dealCommunityCards(phase: 'flop' | 'turn' | 'river'): void {
    this.state.phase = phase;
    const count = phase === 'flop' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const card = this.state.deck.pop()!;
      this.state.communityCards.push({ ...card, faceUp: true });
    }

    // Setup new betting round
    this.state.toAct = [];
    const activePlayers = this.state.players.filter(p => p.status === 'active');

    // Start from left of dealer going clockwise
    let startIdx = this.nextActingIndex(this.state.dealerIndex - 1 < 0 ? this.state.players.length - 1 : this.state.dealerIndex - 1);
    if (startIdx === -1) {
      this.runShowdown();
      return;
    }

    const seen = new Set<number>();
    let cur = startIdx;
    while (!seen.has(cur)) {
      seen.add(cur);
      const p = this.state.players[cur];
      if (p.status === 'active') this.state.toAct.push(p.id);
      const next = this.nextActingIndex(cur);
      if (next === -1 || next === startIdx || seen.has(next)) break;
      cur = next;
    }

    if (activePlayers.length === 0 || this.state.toAct.length === 0) {
      // All remaining players are all-in, run to showdown
      if (phase === 'river') {
        this.runShowdown();
      } else {
        this.endBettingRound();
      }
      return;
    }

    this.state.activeIndex = this.state.players.findIndex(p => p.id === this.state.toAct[0]);
    this.broadcastState(`${phase.charAt(0).toUpperCase() + phase.slice(1)}`);
    this.startTurnTimer();
  }

  private collectBetsIntoPots(): void {
    // Rebuild pots from scratch using totalBet contributions
    // We track pots incrementally — just add current round bets to a main pot for simplicity
    // Full side-pot calculation happens at showdown
    const roundBets = this.state.players.reduce((sum, p) => sum + p.bet, 0);
    if (roundBets === 0) return;

    if (this.state.pots.length === 0) {
      const eligible = this.state.players
        .filter(p => p.status !== 'sitting-out' && p.totalBet > 0)
        .map(p => p.id);
      this.state.pots.push({ amount: roundBets, eligible });
    } else {
      this.state.pots[0].amount += roundBets;
      // Update eligible: add any new contributors
      const eligible = new Set(this.state.pots[0].eligible);
      for (const p of this.state.players) {
        if (p.bet > 0 && p.status !== 'sitting-out') eligible.add(p.id);
      }
      this.state.pots[0].eligible = Array.from(eligible);
    }
  }

  private runShowdown(): void {
    this.state.phase = 'showdown';

    // Calculate side pots properly
    const pots = this.calculateSidePots();
    this.state.pots = pots;

    const allCards = this.state.communityCards;
    this.state.winners = [];

    for (const pot of pots) {
      const eligible = this.state.players.filter(
        p => pot.eligible.includes(p.id) && p.status !== 'folded' && p.holeCards !== null
      );
      if (eligible.length === 0) continue;

      if (eligible.length === 1) {
        eligible[0].balance += pot.amount;
        eligible[0].lastWin += pot.amount;
        this.state.winners.push({
          playerId: eligible[0].id,
          playerName: eligible[0].name,
          amount: pot.amount,
          handName: 'Last player standing',
        });
        continue;
      }

      // Evaluate hands
      const results = eligible.map(p => ({
        player: p,
        result: bestHand([...p.holeCards!, ...allCards]),
      }));

      results.sort((a, b) => b.result.score - a.result.score);
      const bestScore = results[0].result.score;
      const winners = results.filter(r => r.result.score === bestScore);

      const share = Math.floor(pot.amount / winners.length);
      const remainder = pot.amount - share * winners.length;

      for (let i = 0; i < winners.length; i++) {
        const award = share + (i === 0 ? remainder : 0);
        winners[i].player.balance += award;
        winners[i].player.lastWin += award;
        this.state.winners.push({
          playerId: winners[i].player.id,
          playerName: winners[i].player.name,
          amount: award,
          handName: winners[i].result.name,
        });
      }
    }

    const winMsg = this.state.winners.map(w => `${w.playerName} wins $${w.amount}`).join(', ');
    this.broadcastState(winMsg || 'Showdown!');
    this.scheduleNextHand();
  }

  private calculateSidePots(): PokerPot[] {
    const contributors = this.state.players
      .filter(p => p.totalBet > 0 && p.status !== 'sitting-out')
      .sort((a, b) => a.totalBet - b.totalBet);

    if (contributors.length === 0) return [];

    const pots: PokerPot[] = [];
    let prev = 0;

    const uniqueLevels = [...new Set(contributors.map(c => c.totalBet))];

    for (const level of uniqueLevels) {
      const amount = (level - prev) * this.state.players.filter(p => p.totalBet >= level && p.status !== 'sitting-out').length;
      const eligible = this.state.players
        .filter(p => p.totalBet >= level && p.status !== 'sitting-out')
        .map(p => p.id);
      if (amount > 0) pots.push({ amount, eligible });
      prev = level;
    }

    return pots;
  }

  private scheduleNextHand(): void {
    this.showdownTimeout = setTimeout(() => {
      this.showdownTimeout = null;
      const activePlayers = this.state.players.filter(p => p.status !== 'sitting-out');
      if (activePlayers.length < 2) {
        this.state.phase = 'waiting';
        this.broadcastState('Waiting for players...');
      }
      // else: stay in showdown — host clicks "Next Hand" to continue
    }, SHOWDOWN_DELAY_MS) as unknown as NodeJS.Timeout;
  }

  // ─── Turn timer ──────────────────────────────────────────────────────────────

  private startTurnTimer(): void {
    this.clearTurnTimer();
    this.state.turnTimeLeft = TURN_SECONDS;
    this.turnInterval = setInterval(() => {
      this.state.turnTimeLeft--;
      if (this.state.turnTimeLeft <= 0) {
        this.clearTurnTimer();
        const activePlayer = this.state.players[this.state.activeIndex];
        if (activePlayer) this.autoAction(activePlayer.id);
      } else {
        this.broadcastState();
      }
    }, 1000) as unknown as NodeJS.Timeout;
  }

  private clearTurnTimer(): void {
    if (this.turnInterval) { clearInterval(this.turnInterval); this.turnInterval = null; }
  }

  // ─── Public state ────────────────────────────────────────────────────────────

  getPublicState(): PokerPublicGameState {
    const isShowdown = this.state.phase === 'showdown';
    const activePlayer = this.state.players[this.state.activeIndex];

    const numActive = this.state.players.filter(p => p.status !== 'sitting-out' && p.status !== 'folded').length;
    const sbRelIdx = numActive === 2 ? 0 : 1;
    let sbIdx = this.state.dealerIndex;
    let bbIdx = this.state.dealerIndex;
    if (numActive >= 2) {
      if (numActive === 2) {
        sbIdx = this.state.dealerIndex;
        bbIdx = this.nextActiveIndex(this.state.dealerIndex);
      } else {
        sbIdx = this.nextActiveIndex(this.state.dealerIndex);
        bbIdx = this.nextActiveIndex(sbIdx);
      }
    }

    return {
      gameType: 'poker',
      roomCode: this.state.roomCode,
      phase: this.state.phase,
      players: this.state.players.map((p, i) => {
        let holeCards: [Card, Card] | null = null;
        if (isShowdown && p.status !== 'folded' && p.holeCards) {
          holeCards = p.holeCards;
        }
        const result = isShowdown && p.holeCards && this.state.communityCards.length > 0
          ? bestHand([...p.holeCards, ...this.state.communityCards])
          : null;
        return {
          id: p.id,
          name: p.name,
          balance: p.balance,
          holeCards,
          bet: p.bet,
          totalBet: p.totalBet,
          status: p.status,
          isHost: p.isHost,
          isConnected: p.isConnected,
          isDisconnected: p.isDisconnected,
          lastWin: p.lastWin,
          position: i,
          handResult: result ? { name: result.name, score: result.score } : undefined,
        } satisfies PokerPublicPlayer;
      }),
      communityCards: this.state.communityCards,
      pots: this.state.pots,
      currentBet: this.state.currentBet,
      minRaise: this.state.minRaise,
      activePlayerId: activePlayer?.id ?? null,
      dealerIndex: this.state.dealerIndex,
      sbIndex: sbIdx,
      bbIndex: bbIdx,
      round: this.state.round,
      turnTimeLeft: this.state.turnTimeLeft,
      message: this.state.message,
      winners: this.state.winners,
    };
  }
}
