import { EventEmitter } from 'events';
import {
  GameState, Player, PlayerHand, PublicGameState, GamePhase, Card,
} from './types';
import { createShoe, dealCard, getCutCardPosition } from './deck';
import {
  handScore, fullHandScore, isBlackjack, isBust, dealerShouldHit,
  canSplit, canDouble, calculatePayout,
} from './rules';

const MIN_BET = 10;
const MAX_BET = 1000;
const STARTING_BALANCE = 1000;
const REBUY_AMOUNT = 200;
const BETTING_SECONDS = 30;
const INSURANCE_SECONDS = 10;
const TURN_SECONDS = 45;
const DISCONNECT_GRACE_MS = 60_000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeHand(cards: Card[], bet: number, isSplit = false): PlayerHand {
  return { cards, bet, status: 'active', isDoubled: false, isSplit };
}

export class GameRoom extends EventEmitter {
  private state: GameState;
  private pendingBets = new Map<string, number>();
  private bettingTimer: NodeJS.Timeout | null = null;
  private insuranceTimer: NodeJS.Timeout | null = null;
  private turnTimer: NodeJS.Timeout | null = null;
  private bettingInterval: NodeJS.Timeout | null = null;
  private insuranceInterval: NodeJS.Timeout | null = null;
  private turnInterval: NodeJS.Timeout | null = null;
  private disconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor(roomCode: string, hostId: string, hostName: string, savedBalance?: number) {
    super();
    const shoe = createShoe();
    this.state = {
      roomCode,
      phase: 'waiting',
      players: [this.makePlayer(hostId, hostName, savedBalance, true)],
      dealerHand: [],
      currentPlayerIndex: 0,
      deck: shoe,
      cutCardPosition: getCutCardPosition(shoe.length),
      needsReshuffle: false,
      round: 0,
      bettingTimeLeft: BETTING_SECONDS,
      insuranceTimeLeft: INSURANCE_SECONDS,
      turnTimeLeft: TURN_SECONDS,
      message: 'Waiting for players...',
    };
  }

  private makePlayer(id: string, name: string, savedBalance?: number, isHost = false): Player {
    const balance = savedBalance && savedBalance >= 10 && savedBalance <= 50000
      ? savedBalance : STARTING_BALANCE;
    return {
      id, name, balance,
      hands: [], activeHandIndex: 0,
      insuranceBet: 0,
      hasBet: false, hasActedOnInsurance: false,
      isHost, isSittingOut: false, wantsSitOut: false,
      wasRebought: false, isDisconnected: false,
    };
  }

  private emit2(event: string, ...args: unknown[]) {
    this.emit(event, ...args);
  }

  private broadcast(message?: string) {
    if (message) this.state.message = message;
    this.emit2('stateChange', this.getPublicState());
  }

  // ─── Room management ────────────────────────────────────────────────────────

  addPlayer(id: string, name: string, savedBalance?: number): boolean {
    if (this.state.players.length >= 6) return false;
    if (this.state.phase !== 'waiting') return false;
    this.state.players.push(this.makePlayer(id, name, savedBalance));
    return true;
  }

  removePlayer(id: string): void {
    const player = this.getPlayer(id);
    if (!player) return;

    if (this.state.phase === 'playing' || this.state.phase === 'dealer') {
      for (const hand of player.hands) hand.status = 'standing';
    }

    this.state.players = this.state.players.filter(p => p.id !== id);
    if (this.state.players.length === 0) return;

    if (!this.state.players.some(p => p.isHost)) {
      this.state.players[0].isHost = true;
    }

    if (this.state.currentPlayerIndex >= this.state.players.length) {
      this.state.currentPlayerIndex = this.state.players.length - 1;
    }
  }

  // Mark as disconnected during active game — grace period to rejoin
  markDisconnected(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (!player) return;
    player.isDisconnected = true;

    // Clear any existing timer
    const existing = this.disconnectTimers.get(playerId);
    if (existing) clearTimeout(existing);

    // Auto-advance if it's their turn
    if (this.state.phase === 'playing') {
      const cur = this.state.players[this.state.currentPlayerIndex];
      if (cur?.id === playerId) this.autoStand();
    }

    // If disconnected during betting, mark them as sitting out this round
    if (this.state.phase === 'betting' && !player.hasBet) {
      player.hasBet = true;
      player.isSittingOut = true;
      const active = this.state.players.filter(p => !p.isSittingOut);
      if (active.every(p => p.hasBet)) {
        this.clearBettingTimer();
        this.startDealing();
        return;
      }
    }

    this.broadcast(`${player.name} disconnected`);
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

    // Cancel cleanup timer
    const timer = this.disconnectTimers.get(oldId);
    if (timer) { clearTimeout(timer); this.disconnectTimers.delete(oldId); }

    return oldId;
  }

  getPhase(): GamePhase { return this.state.phase; }

  getPlayer(id: string): Player | undefined {
    return this.state.players.find(p => p.id === id);
  }

  isHost(id: string): boolean {
    return this.getPlayer(id)?.isHost ?? false;
  }

  isEmpty(): boolean { return this.state.players.length === 0; }
  getPlayerCount(): number { return this.state.players.length; }

  // ─── Sit-out management ─────────────────────────────────────────────────────

  setSitOut(playerId: string, sitOut: boolean): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    const allowedPhases: GamePhase[] = ['waiting', 'complete', 'betting'];
    if (!allowedPhases.includes(this.state.phase)) return;

    player.wantsSitOut = sitOut;
    player.isSittingOut = sitOut;

    if (this.state.phase === 'betting') {
      if (sitOut && !player.hasBet) {
        player.hasBet = true; // treated as opted out
        const active = this.state.players.filter(p => !p.isSittingOut);
        if (active.length === 0 || active.every(p => p.hasBet)) {
          this.clearBettingTimer();
          this.startDealing();
          return;
        }
      } else if (!sitOut) {
        player.hasBet = false; // re-enable betting
      }
    }

    this.broadcast(`${player.name} ${sitOut ? 'sits out' : 'is back in'}`);
  }

  // ─── Game flow ──────────────────────────────────────────────────────────────

  startGame(playerId: string): boolean {
    if (!this.isHost(playerId)) return false;
    const active = this.state.players.filter(p => !p.wantsSitOut);
    if (active.length < 2) return false;
    if (this.state.phase !== 'waiting' && this.state.phase !== 'complete') return false;
    this.startBettingPhase();
    return true;
  }

  private startBettingPhase(): void {
    this.clearTimers();
    this.state.phase = 'betting';
    this.state.round++;
    this.state.bettingTimeLeft = BETTING_SECONDS;

    for (const p of this.state.players) {
      if (p.balance === 0) {
        p.balance = REBUY_AMOUNT;
        p.wasRebought = true;
        p.wantsSitOut = false; // rebuy re-enters player
      } else {
        p.wasRebought = false;
      }
      p.isSittingOut = p.wantsSitOut;
      p.hasBet = p.isSittingOut; // sitting-out players skip betting
      p.hands = [];
      p.activeHandIndex = 0;
      p.insuranceBet = 0;
      p.hasActedOnInsurance = false;
    }
    this.state.dealerHand = [];

    if (this.state.needsReshuffle) {
      const shoe = createShoe();
      this.state.deck = shoe;
      this.state.cutCardPosition = getCutCardPosition(shoe.length);
      this.state.needsReshuffle = false;
    }

    this.broadcast('Place your bets!');

    this.bettingInterval = setInterval(() => {
      this.state.bettingTimeLeft--;
      if (this.state.bettingTimeLeft <= 0) {
        this.clearBettingTimer();
        // Auto min-bet for players who can afford it and haven't bet
        for (const p of this.state.players) {
          if (!p.isSittingOut && !p.hasBet && p.balance >= MIN_BET) {
            this.pendingBets.set(p.id, MIN_BET);
            p.hasBet = true;
          }
        }
        this.startDealing();
      } else {
        this.broadcast();
      }
    }, 1000) as unknown as NodeJS.Timeout;
  }

  placeBet(playerId: string, amount: number, forceAllIn = false): boolean {
    if (this.state.phase !== 'betting') return false;
    const player = this.getPlayer(playerId);
    if (!player || player.hasBet || player.isSittingOut) return false;

    const requested = Math.floor(amount);
    // forceAllIn flag from client guarantees server uses real balance (avoids stale-client bug)
    const isAllIn = forceAllIn || requested >= player.balance;
    const bet = isAllIn
      ? player.balance
      : Math.max(MIN_BET, Math.min(MAX_BET, requested));

    if (bet < MIN_BET || bet > player.balance) return false;

    this.pendingBets.set(playerId, bet);
    player.hasBet = true;

    const label = isAllIn
      ? `${player.name} went ALL IN — $${bet}!`
      : `${player.name} bet $${bet}`;
    this.broadcast(label);

    const active = this.state.players.filter(p => !p.isSittingOut);
    if (active.every(p => p.hasBet)) {
      this.clearBettingTimer();
      this.startDealing();
    }
    return true;
  }

  private async startDealing(): Promise<void> {
    this.state.phase = 'dealing';
    this.broadcast('Dealing cards...');

    for (const p of this.state.players) {
      if (p.hasBet && !p.isSittingOut) {
        const bet = this.pendingBets.get(p.id) ?? MIN_BET;
        p.hands = [makeHand([], bet)];
      } else {
        p.isSittingOut = true;
      }
    }
    this.pendingBets.clear();

    const active = this.state.players.filter(p => !p.isSittingOut);

    for (let round = 0; round < 2; round++) {
      for (const player of active) {
        const [card, deck] = dealCard(this.state.deck, true);
        player.hands[0].cards.push(card);
        this.state.deck = deck;
        this.broadcast();
        await delay(280);
      }
      const [dCard, deck2] = dealCard(this.state.deck, round === 0);
      this.state.dealerHand.push(dCard);
      this.state.deck = deck2;
      this.broadcast();
      await delay(280);
    }

    if (this.state.deck.length <= this.state.cutCardPosition) {
      this.state.needsReshuffle = true;
    }

    for (const p of active) {
      if (isBlackjack(p.hands[0].cards)) p.hands[0].status = 'blackjack';
    }

    if (this.state.dealerHand[0].rank === 'A') {
      this.startInsurancePhase();
    } else {
      this.startPlayingPhase();
    }
  }

  // ─── Insurance ──────────────────────────────────────────────────────────────

  private startInsurancePhase(): void {
    this.state.phase = 'insurance';
    this.state.insuranceTimeLeft = INSURANCE_SECONDS;
    this.broadcast('Dealer shows Ace — Insurance? (10s)');

    this.insuranceInterval = setInterval(() => {
      this.state.insuranceTimeLeft--;
      if (this.state.insuranceTimeLeft <= 0) {
        this.clearInsuranceTimer();
        this.startPlayingPhase();
      } else {
        this.broadcast();
        const active = this.state.players.filter(p => !p.isSittingOut);
        if (active.every(p => p.hasActedOnInsurance)) {
          this.clearInsuranceTimer();
          this.startPlayingPhase();
        }
      }
    }, 1000) as unknown as NodeJS.Timeout;
  }

  placeInsurance(playerId: string, amount: number): boolean {
    if (this.state.phase !== 'insurance') return false;
    const player = this.getPlayer(playerId);
    if (!player || player.hasActedOnInsurance || player.isSittingOut) return false;
    const maxInsurance = Math.floor((player.hands[0]?.bet ?? 0) / 2);
    const bet = Math.max(0, Math.min(maxInsurance, Math.floor(amount)));
    if (bet > player.balance) return false;
    player.insuranceBet = bet;
    player.hasActedOnInsurance = true;
    this.broadcast(`${player.name} ${bet > 0 ? `insured $${bet}` : 'declined insurance'}`);
    const active = this.state.players.filter(p => !p.isSittingOut);
    if (active.every(p => p.hasActedOnInsurance)) {
      this.clearInsuranceTimer();
      this.startPlayingPhase();
    }
    return true;
  }

  // ─── Playing phase ──────────────────────────────────────────────────────────

  private startPlayingPhase(): void {
    this.state.phase = 'playing';
    const idx = this.findNextActivePlayer(-1);

    if (idx === -1) {
      this.dealerTurn();
      return;
    }

    this.state.currentPlayerIndex = idx;
    const cur = this.state.players[idx];
    this.broadcast(`${cur.name}'s turn`);
    this.startTurnTimer();
  }

  private startTurnTimer(): void {
    this.clearTurnTimer();
    this.state.turnTimeLeft = TURN_SECONDS;
    this.turnInterval = setInterval(() => {
      this.state.turnTimeLeft--;
      if (this.state.turnTimeLeft <= 0) {
        this.clearTurnTimer();
        this.autoStand();
      } else {
        this.broadcast();
      }
    }, 1000) as unknown as NodeJS.Timeout;
  }

  private autoStand(): void {
    const player = this.state.players[this.state.currentPlayerIndex];
    if (!player) return;
    const hand = player.hands[player.activeHandIndex];
    if (hand && hand.status === 'active') hand.status = 'standing';
    this.advanceTurn();
  }

  private findNextActivePlayer(fromIndex: number): number {
    for (let i = fromIndex + 1; i < this.state.players.length; i++) {
      const p = this.state.players[i];
      if (p.isSittingOut) continue;
      if (p.hands.some(h => h.status === 'active')) return i;
    }
    return -1;
  }

  private getCurrentActiveHand(): PlayerHand | null {
    const p = this.state.players[this.state.currentPlayerIndex];
    if (!p) return null;
    return p.hands[p.activeHandIndex] ?? null;
  }

  hit(playerId: string): boolean {
    if (this.state.phase !== 'playing') return false;
    const player = this.state.players[this.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return false;
    const hand = this.getCurrentActiveHand();
    if (!hand || hand.status !== 'active') return false;

    const [card, deck] = dealCard(this.state.deck, true);
    hand.cards.push(card);
    this.state.deck = deck;

    const score = fullHandScore(hand.cards);
    if (score > 21) {
      hand.status = 'bust';
      this.broadcast(`${player.name} busts!`);
      this.advanceTurn();
    } else if (score === 21) {
      hand.status = 'standing';
      this.broadcast();
      this.advanceTurn();
    } else {
      this.broadcast();
    }
    return true;
  }

  stand(playerId: string): boolean {
    if (this.state.phase !== 'playing') return false;
    const player = this.state.players[this.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return false;
    const hand = this.getCurrentActiveHand();
    if (!hand || hand.status !== 'active') return false;
    hand.status = 'standing';
    this.broadcast();
    this.advanceTurn();
    return true;
  }

  doubleDown(playerId: string): boolean {
    if (this.state.phase !== 'playing') return false;
    const player = this.state.players[this.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return false;
    const hand = this.getCurrentActiveHand();
    if (!hand || !canDouble(hand)) return false;
    if (player.balance < hand.bet * 2) return false;

    hand.bet *= 2;
    hand.isDoubled = true;

    const [card, deck] = dealCard(this.state.deck, true);
    hand.cards.push(card);
    this.state.deck = deck;

    hand.status = isBust(hand.cards) ? 'bust' : 'standing';
    this.broadcast(hand.status === 'bust' ? `${player.name} doubled and busts!` : `${player.name} doubled down`);
    this.advanceTurn();
    return true;
  }

  split(playerId: string): boolean {
    if (this.state.phase !== 'playing') return false;
    const player = this.state.players[this.state.currentPlayerIndex];
    if (!player || player.id !== playerId) return false;
    const hand = this.getCurrentActiveHand();
    if (!hand || !canSplit(hand)) return false;
    if (player.balance < hand.bet) return false;
    if (player.hands.length >= 4) return false;

    const card2 = hand.cards.pop()!;
    const newHand = makeHand([card2], hand.bet, true);
    hand.isSplit = true;
    player.hands.splice(player.activeHandIndex + 1, 0, newHand);

    const [c1, deck1] = dealCard(this.state.deck, true);
    hand.cards.push(c1);
    this.state.deck = deck1;

    const [c2, deck2] = dealCard(this.state.deck, true);
    newHand.cards.push(c2);
    this.state.deck = deck2;

    if (hand.cards[0].rank === 'A') {
      hand.status = 'standing';
      newHand.status = 'standing';
      this.broadcast(`${player.name} split Aces`);
      this.advanceTurn();
      return true;
    }

    this.broadcast(`${player.name} split`);
    return true;
  }

  private advanceTurn(): void {
    this.clearTurnTimer();
    const player = this.state.players[this.state.currentPlayerIndex];

    if (player) {
      const nextHandIdx = player.hands.findIndex(
        (h, i) => i > player.activeHandIndex && h.status === 'active'
      );
      if (nextHandIdx !== -1) {
        player.activeHandIndex = nextHandIdx;
        this.broadcast(`${player.name}'s turn (hand ${nextHandIdx + 1})`);
        this.startTurnTimer();
        return;
      }
    }

    const nextIdx = this.findNextActivePlayer(this.state.currentPlayerIndex);
    if (nextIdx === -1) {
      this.dealerTurn();
    } else {
      this.state.currentPlayerIndex = nextIdx;
      this.state.players[nextIdx].activeHandIndex = 0;
      this.broadcast(`${this.state.players[nextIdx].name}'s turn`);
      this.startTurnTimer();
    }
  }

  // ─── Dealer turn ────────────────────────────────────────────────────────────

  private async dealerTurn(): Promise<void> {
    this.state.phase = 'dealer';

    for (const c of this.state.dealerHand) c.faceUp = true;
    this.broadcast('Dealer reveals...');
    await delay(900);

    if (isBlackjack(this.state.dealerHand)) {
      this.broadcast('Dealer has Blackjack!');
      await delay(600);
      this.settleRound();
      return;
    }

    while (dealerShouldHit(this.state.dealerHand)) {
      const [card, deck] = dealCard(this.state.deck, true);
      this.state.dealerHand.push(card);
      this.state.deck = deck;
      this.broadcast();
      await delay(750);
    }

    const score = fullHandScore(this.state.dealerHand);
    this.broadcast(score > 21 ? 'Dealer busts!' : `Dealer stands on ${score}`);
    await delay(600);
    this.settleRound();
  }

  private settleRound(): void {
    const dealerBJ = isBlackjack(this.state.dealerHand);

    for (const player of this.state.players) {
      if (player.isSittingOut) continue;
      let net = 0;
      for (const hand of player.hands) {
        net += calculatePayout(hand, this.state.dealerHand, player.insuranceBet, dealerBJ);
        player.insuranceBet = 0;
      }
      player.balance = Math.max(0, player.balance + net);
    }

    this.state.phase = 'complete';
    this.broadcast('Round complete!');
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private clearBettingTimer(): void {
    if (this.bettingInterval) { clearInterval(this.bettingInterval); this.bettingInterval = null; }
    if (this.bettingTimer) { clearTimeout(this.bettingTimer); this.bettingTimer = null; }
  }

  private clearInsuranceTimer(): void {
    if (this.insuranceInterval) { clearInterval(this.insuranceInterval); this.insuranceInterval = null; }
    if (this.insuranceTimer) { clearTimeout(this.insuranceTimer); this.insuranceTimer = null; }
  }

  private clearTurnTimer(): void {
    if (this.turnInterval) { clearInterval(this.turnInterval); this.turnInterval = null; }
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
  }

  private clearTimers(): void {
    this.clearBettingTimer();
    this.clearInsuranceTimer();
    this.clearTurnTimer();
  }

  destroy(): void {
    this.clearTimers();
    for (const t of this.disconnectTimers.values()) clearTimeout(t);
    this.disconnectTimers.clear();
  }

  getPublicState(): PublicGameState {
    return {
      roomCode: this.state.roomCode,
      phase: this.state.phase,
      players: this.state.players.map(p => ({
        id: p.id,
        name: p.name,
        balance: p.balance,
        hands: p.hands.map(h => ({
          cards: h.cards,
          bet: h.bet,
          status: h.status,
          isDoubled: h.isDoubled,
          isSplit: h.isSplit,
          score: fullHandScore(h.cards),
        })),
        activeHandIndex: p.activeHandIndex,
        insuranceBet: p.insuranceBet,
        hasBet: p.hasBet,
        hasActedOnInsurance: p.hasActedOnInsurance,
        isHost: p.isHost,
        isSittingOut: p.isSittingOut,
        wantsSitOut: p.wantsSitOut,
        isDisconnected: p.isDisconnected,
      })),
      dealerHand: this.state.dealerHand,
      dealerScore: handScore(this.state.dealerHand),
      currentPlayerIndex: this.state.currentPlayerIndex,
      round: this.state.round,
      bettingTimeLeft: this.state.bettingTimeLeft,
      insuranceTimeLeft: this.state.insuranceTimeLeft,
      turnTimeLeft: this.state.turnTimeLeft,
      message: this.state.message,
      needsReshuffle: this.state.needsReshuffle,
    };
  }
}
