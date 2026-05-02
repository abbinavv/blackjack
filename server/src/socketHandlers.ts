import { Server, Socket } from 'socket.io';
import { GameRoom } from './game/GameRoom';
import { RouletteGameRoom } from './game/RouletteGameRoom';
import { PokerGameRoom } from './game/PokerGameRoom';
import { RouletteBet, Card } from './game/types';

type AnyRoom = GameRoom | RouletteGameRoom | PokerGameRoom;

const rooms = new Map<string, AnyRoom>();
const playerRoom = new Map<string, string>(); // socketId → roomCode

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? genCode() : code;
}

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`+ ${socket.id}`);

    socket.on('createRoom', (
      { name, savedBalance, gameType }: { name: string; savedBalance?: number; gameType?: string },
      cb: (code: string) => void
    ) => {
      const code = genCode();
      let room: AnyRoom;

      if (gameType === 'poker') {
        room = new PokerGameRoom(code, socket.id, name, savedBalance);
        room.on('stateChange', (state) => io.to(code).emit('gameState', state));
        room.on('privateCards', (cardsMap: Map<string, [Card, Card]>) => {
          for (const [pid, cards] of cardsMap) {
            io.to(pid).emit('pokerYourCards', cards);
          }
        });
      } else if (gameType === 'roulette') {
        room = new RouletteGameRoom(code, socket.id, name, savedBalance);
        room.on('stateChange', (state) => io.to(code).emit('gameState', state));
      } else {
        room = new GameRoom(code, socket.id, name, savedBalance);
        room.on('stateChange', (state) => io.to(code).emit('gameState', state));
      }

      rooms.set(code, room);
      playerRoom.set(socket.id, code);
      socket.join(code);
      cb(code);
      io.to(code).emit('gameState', room.getPublicState());
    });

    socket.on('joinRoom', (
      { roomCode, name, savedBalance }: { roomCode: string; name: string; savedBalance?: number },
      cb: (ok: boolean, err?: string) => void
    ) => {
      const room = rooms.get(roomCode);
      if (!room) return cb(false, 'Room not found');
      if (!room.addPlayer(socket.id, name, savedBalance)) return cb(false, 'Room full or game in progress');

      if (room instanceof PokerGameRoom) {
        room.on('privateCards', (cardsMap: Map<string, [Card, Card]>) => {
          for (const [pid, cards] of cardsMap) {
            io.to(pid).emit('pokerYourCards', cards);
          }
        });
      }

      playerRoom.set(socket.id, roomCode);
      socket.join(roomCode);
      cb(true);
      io.to(roomCode).emit('gameState', room.getPublicState());
    });

    // Rejoin mid-game after refresh
    socket.on('rejoinRoom', (
      { roomCode, name }: { roomCode: string; name: string },
      cb: (ok: boolean) => void
    ) => {
      const room = rooms.get(roomCode);
      if (!room) return cb(false);
      const oldId = room.rejoinPlayer(socket.id, name);
      if (!oldId) return cb(false);
      playerRoom.delete(oldId);
      playerRoom.set(socket.id, roomCode);
      socket.join(roomCode);
      cb(true);
      socket.emit('gameState', room.getPublicState());
      io.to(roomCode).emit('gameState', room.getPublicState());
      io.to(roomCode).emit('toast', `${name} reconnected`);

      // Re-send private hole cards on rejoin (public state hides them during play)
      if (room instanceof PokerGameRoom) {
        const holeCards = room.getPlayerHoleCards(socket.id);
        if (holeCards) socket.emit('pokerYourCards', holeCards);
      }
    });

    socket.on('startGame', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!room.startGame(socket.id)) {
        socket.emit('error', 'Need at least 2 active players to start');
      }
    });

    socket.on('placeBet', ({ roomCode, amount, allIn }: { roomCode: string; amount: number; allIn?: boolean }) => {
      const room = rooms.get(roomCode);
      if (room instanceof GameRoom) room.placeBet(socket.id, amount, allIn);
    });

    socket.on('placeInsurance', ({ roomCode, amount }: { roomCode: string; amount: number }) => {
      const room = rooms.get(roomCode);
      if (room instanceof GameRoom) room.placeInsurance(socket.id, amount);
    });

    socket.on('sitOut', ({ roomCode, sitOut }: { roomCode: string; sitOut: boolean }) => {
      const room = rooms.get(roomCode);
      if (room instanceof GameRoom) room.setSitOut(socket.id, sitOut);
    });

    socket.on('hit', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (room instanceof GameRoom) room.hit(socket.id);
    });
    socket.on('stand', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (room instanceof GameRoom) room.stand(socket.id);
    });
    socket.on('doubleDown', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (room instanceof GameRoom) room.doubleDown(socket.id);
    });
    socket.on('split', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (room instanceof GameRoom) room.split(socket.id);
    });

    socket.on('nextRound', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!room.startGame(socket.id)) {
        socket.emit('error', 'Only the host can start a new round');
      }
    });

    // ─── Roulette events ─────────────────────────────────────────────────────

    socket.on('rouletteBet', ({ roomCode, bets }: { roomCode: string; bets: RouletteBet[] }) => {
      const room = rooms.get(roomCode);
      if (room instanceof RouletteGameRoom) {
        if (!room.placeBet(socket.id, bets)) socket.emit('error', 'Invalid bet');
      }
    });

    socket.on('rouletteSpin', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (room instanceof RouletteGameRoom) {
        if (!room.spin(socket.id)) socket.emit('error', 'Only the host can spin');
      }
    });

    socket.on('rouletteNextRound', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (room instanceof RouletteGameRoom) {
        if (!room.nextRound(socket.id)) socket.emit('error', 'Only the host can start a new round');
      }
    });

    // ─── Poker events ────────────────────────────────────────────────────────

    socket.on('pokerFold', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (room instanceof PokerGameRoom) room.fold(socket.id);
    });

    socket.on('pokerCheck', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (room instanceof PokerGameRoom) room.check(socket.id);
    });

    socket.on('pokerCall', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (room instanceof PokerGameRoom) room.call(socket.id);
    });

    socket.on('pokerRaise', ({ roomCode, amount }: { roomCode: string; amount: number }) => {
      const room = rooms.get(roomCode);
      if (room instanceof PokerGameRoom) room.raise(socket.id, amount);
    });

    socket.on('pokerAllIn', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (room instanceof PokerGameRoom) room.allIn(socket.id);
    });

    socket.on('pokerNextRound', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!room.startGame(socket.id)) {
        socket.emit('error', 'Need at least 2 players to start');
      }
    });

    // ─── Disconnect ───────────────────────────────────────────────────────────

    socket.on('disconnect', () => {
      console.log(`- ${socket.id}`);
      const code = playerRoom.get(socket.id);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) { playerRoom.delete(socket.id); return; }

      const player = room.getPlayer(socket.id);
      const phase = room.getPhase();

      if (room instanceof PokerGameRoom) {
        const activePhases = ['pre-flop', 'flop', 'turn', 'river'];
        if (player && activePhases.includes(phase)) {
          room.markDisconnected(socket.id);
          io.to(code).emit('gameState', room.getPublicState());

          room.scheduleDisconnectCleanup(socket.id, () => {
            const r = rooms.get(code);
            if (!r) return;
            if (r.isEmpty()) {
              r.destroy();
              rooms.delete(code);
            } else {
              io.to(code).emit('gameState', r.getPublicState());
              io.to(code).emit('toast', `${player.name} left the game`);
            }
            playerRoom.delete(socket.id);
          });
        } else {
          const name = player?.name;
          room.removePlayer(socket.id);
          if (room.isEmpty()) {
            room.destroy();
            rooms.delete(code);
          } else {
            io.to(code).emit('gameState', room.getPublicState());
            if (name) io.to(code).emit('toast', `${name} left the game`);
          }
          playerRoom.delete(socket.id);
        }
      } else if (room instanceof RouletteGameRoom) {
        // Always give a grace period — phone screen locks cause brief disconnects
        // at any phase, and we never want to immediately drop a roulette player.
        if (player) {
          room.markDisconnected(socket.id);
          io.to(code).emit('gameState', room.getPublicState());

          room.scheduleDisconnectCleanup(socket.id, () => {
            const r = rooms.get(code);
            if (!r) return;
            if (r.isEmpty()) {
              r.destroy();
              rooms.delete(code);
            } else {
              io.to(code).emit('gameState', r.getPublicState());
              io.to(code).emit('toast', `${player.name} left the game`);
            }
            playerRoom.delete(socket.id);
          });
        } else {
          playerRoom.delete(socket.id);
        }
      } else if (room instanceof GameRoom) {
        const activePhases = ['betting', 'dealing', 'insurance', 'playing', 'dealer'];
        if (player && activePhases.includes(phase)) {
          room.markDisconnected(socket.id);
          io.to(code).emit('gameState', room.getPublicState());

          room.scheduleDisconnectCleanup(socket.id, () => {
            const r = rooms.get(code);
            if (!r) return;
            if (r.isEmpty()) {
              r.destroy();
              rooms.delete(code);
            } else {
              io.to(code).emit('gameState', r.getPublicState());
              io.to(code).emit('toast', `${player.name} left the game`);
            }
            playerRoom.delete(socket.id);
          });
        } else {
          const name = player?.name;
          room.removePlayer(socket.id);
          if (room.isEmpty()) {
            room.destroy();
            rooms.delete(code);
          } else {
            io.to(code).emit('gameState', room.getPublicState());
            if (name) io.to(code).emit('toast', `${name} left the game`);
          }
          playerRoom.delete(socket.id);
        }
      }
    });
  });
}
