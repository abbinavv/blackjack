import { EventEmitter } from 'events';
import {
  RouletteGameState, RoulettePlayer, RouletteBet, RouletteBetType,
  RoulettePublicGameState, RoulettePhase,
} from './types';

const STARTING_BALANCE = 1000;
const BETTING_SECONDS = 30;
const SPIN_DELAY_MS = 3000;
const DISCONNECT_GRACE_MS = 60_000;

const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const BLACK_NUMBERS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

const COLUMN1 = new Set([1,4,7,10,13,16,19,22,25,28,31,34]);
const COLUMN2 = new Set([2,5,8,11,14,17,20,23,26,29,32,35]);
const COLUMN3 = new Set([3,6,9,12,15,18,21,24,27,30,33,36]);

const PAYOUT: Record<RouletteBetType, number> = {
  straight: 35, split: 17, street: 11, corner: 8, sixline: 5,
  dozen: 2, column: 2,
  red: 1, black: 1, odd: 1, even: 1, low: 1, high: 1,
};

function betWins(bet: RouletteBet, result: number): boolean {
  const { type, numbers } = bet;
  switch (type) {
    case 'straight': return result === numbers[0];
    case 'split':
    case 'street':
    case 'corner':
    case 'sixline': return numbers.includes(result);
    case 'dozen': {
      const d = numbers[0];
      if (d === 1) return result >= 1 && result <= 12;
      if (d === 2) return result >= 13 && result <= 24;
      if (d === 3) return result >= 25 && result <= 36;
      return false;
    }
    case 'column': {
      const c = numbers[0];
      if (c === 1) return COLUMN1.has(result);
      if (c === 2) return COLUMN2.has(result);
      if (c === 3) return COLUMN3.has(result);
      return false;
    }
    case 'red': return RED_NUMBERS.has(result);
    case 'black': return BLACK_NUMBERS.has(result);
    case 'odd': return result !== 0 && result % 2 !== 0;
    case 'even': return result !== 0 && result % 2 === 0;
    case 'low': return result >= 1 && result <= 18;
    case 'high': return result >= 19 && result <= 36;
    default: return false;
  }
}

export class RouletteGameRoom extends EventEmitter {
  private state: RouletteGameState;
  private bettingInterval: NodeJS.Timeout | null = null;
  private disconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor(roomCode: string, hostId: string, hostName: string, savedBalance?: number) {
    super();
    this.state = {
      roomCode,
      gameType: 'roulette',
      phase: 'waiting',
      players: [this.makePlayer(hostId, hostName, savedBalance, true)],
      spinResult: null,
      round: 0,
      bettingTimeLeft: BETTING_SECONDS,
      message: 'Waiting for players...',
    };
  }

  private makePlayer(id: string, name: string, savedBalance?: number, isHost = false): RoulettePlayer {
    const balance = savedBalance && savedBalance >= 10 && savedBalance <= 50000
      ? savedBalance : STARTING_BALANCE;
    return { id, name, balance, bets: [], lastWin: 0, isHost, isConnected: true };
  }

  private broadcast(message?: string): void {
    if (message !== undefined) this.state.message = message;
    this.emit('stateChange', this.getPublicState());
  }

  // ─── Room management ──────────────────────────────────────────────────────

  addPlayer(id: string, name: string, savedBalance?: number): boolean {
    if (this.state.players.length >= 8) return false;
    // Allow joining at any phase — new player can bet next round
    this.state.players.push(this.makePlayer(id, name, savedBalance));
    this.broadcast(`${name} joined`);
    return true;
  }

  removePlayer(id: string): void {
    const idx = this.state.players.findIndex(p => p.id === id);
    if (idx === -1) return;
    this.state.players.splice(idx, 1);
    if (this.state.players.length > 0 && !this.state.players.some(p => p.isHost)) {
      this.state.players[0].isHost = true;
    }
  }

  markDisconnected(id: string): void {
    const player = this.state.players.find(p => p.id === id);
    if (!player) return;
    player.isConnected = false;
    this.broadcast(`${player.name} disconnected`);
  }

  scheduleDisconnectCleanup(playerId: string, onCleanup: () => void): void {
    const timer = setTimeout(() => {
      const player = this.state.players.find(p => p.id === playerId);
      if (player && !player.isConnected) {
        this.removePlayer(playerId);
        onCleanup();
      }
      this.disconnectTimers.delete(playerId);
    }, DISCONNECT_GRACE_MS) as unknown as NodeJS.Timeout;
    this.disconnectTimers.set(playerId, timer);
  }

  rejoinPlayer(newSocketId: string, name: string): string | null {
    const player = this.state.players.find(
      p => p.name.toLowerCase() === name.toLowerCase() && !p.isConnected
    );
    if (!player) return null;
    const oldId = player.id;
    player.id = newSocketId;
    player.isConnected = true;
    const timer = this.disconnectTimers.get(oldId);
    if (timer) { clearTimeout(timer); this.disconnectTimers.delete(oldId); }
    return oldId;
  }

  getPlayer(id: string): RoulettePlayer | undefined {
    return this.state.players.find(p => p.id === id);
  }

  getPhase(): RoulettePhase { return this.state.phase; }

  isHost(id: string): boolean { return this.getPlayer(id)?.isHost ?? false; }

  isEmpty(): boolean { return this.state.players.length === 0; }

  // ─── Game flow ─────────────────────────────────────────────────────────────

  startGame(playerId: string): boolean {
    if (!this.isHost(playerId)) return false;
    if (this.state.phase !== 'waiting' && this.state.phase !== 'complete') return false;
    if (this.state.players.length < 2) return false;
    this.startBettingPhase();
    return true;
  }

  private startBettingPhase(): void {
    this.clearBettingTimer();
    this.state.phase = 'betting';
    this.state.round++;
    this.state.bettingTimeLeft = BETTING_SECONDS;
    this.state.spinResult = null;

    for (const p of this.state.players) {
      p.bets = [];
      p.lastWin = 0;
    }

    this.broadcast('Place your bets!');

    this.bettingInterval = setInterval(() => {
      this.state.bettingTimeLeft--;
      if (this.state.bettingTimeLeft <= 0) {
        this.clearBettingTimer();
        this.doSpin();
      } else {
        this.broadcast();
      }
    }, 1000) as unknown as NodeJS.Timeout;
  }

  placeBet(playerId: string, bets: RouletteBet[]): boolean {
    if (this.state.phase !== 'betting') return false;
    const player = this.getPlayer(playerId);
    if (!player) return false;

    const totalAmount = bets.reduce((s, b) => s + b.amount, 0);
    if (totalAmount < 0 || totalAmount > player.balance) return false;
    if (bets.some(b => b.amount <= 0)) return false;

    player.bets = bets;
    this.broadcast(`${player.name} placed bets`);
    return true;
  }

  spin(playerId: string): boolean {
    if (!this.isHost(playerId)) return false;
    if (this.state.phase !== 'betting') return false;
    this.clearBettingTimer();
    this.doSpin();
    return true;
  }

  private doSpin(): void {
    this.state.phase = 'spinning';
    const result = Math.floor(Math.random() * 37); // 0-36
    this.state.spinResult = result;
    this.broadcast('No more bets! Spinning...');

    setTimeout(() => {
      this.settle(result);
    }, SPIN_DELAY_MS);
  }

  private settle(result: number): void {
    for (const player of this.state.players) {
      let net = 0;
      for (const bet of player.bets) {
        if (betWins(bet, result)) {
          net += bet.amount * PAYOUT[bet.type]; // win: get payout + keep stake
        } else {
          net -= bet.amount; // lose stake
        }
      }
      player.lastWin = net;
      player.balance = Math.max(0, player.balance + net);
    }

    const color = RED_NUMBERS.has(result) ? 'Red' : result === 0 ? 'Green' : 'Black';
    this.state.phase = 'complete';
    this.broadcast(`Result: ${result} ${color}`);
  }

  nextRound(playerId: string): boolean {
    if (!this.isHost(playerId)) return false;
    if (this.state.phase !== 'complete') return false;
    this.startBettingPhase();
    return true;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private clearBettingTimer(): void {
    if (this.bettingInterval) { clearInterval(this.bettingInterval); this.bettingInterval = null; }
  }

  destroy(): void {
    this.clearBettingTimer();
    for (const t of this.disconnectTimers.values()) clearTimeout(t);
    this.disconnectTimers.clear();
  }

  getPublicState(): RoulettePublicGameState {
    return {
      roomCode: this.state.roomCode,
      gameType: 'roulette',
      phase: this.state.phase,
      players: this.state.players.map(p => ({ ...p })),
      spinResult: this.state.spinResult,
      round: this.state.round,
      bettingTimeLeft: this.state.bettingTimeLeft,
      message: this.state.message,
    };
  }
}
