import { Server, Socket } from 'socket.io';
import { GameRoom } from './game/GameRoom';

const rooms = new Map<string, GameRoom>();
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

    socket.on('createRoom', ({ name, savedBalance }: { name: string; savedBalance?: number }, cb: (code: string) => void) => {
      const code = genCode();
      const room = new GameRoom(code, socket.id, name, savedBalance);
      room.on('stateChange', (state) => io.to(code).emit('gameState', state));
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
    });

    socket.on('startGame', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!room.startGame(socket.id)) {
        socket.emit('error', 'Need at least 2 active players to start');
      }
    });

    socket.on('placeBet', ({ roomCode, amount, allIn }: { roomCode: string; amount: number; allIn?: boolean }) => {
      rooms.get(roomCode)?.placeBet(socket.id, amount, allIn);
    });

    socket.on('placeInsurance', ({ roomCode, amount }: { roomCode: string; amount: number }) => {
      rooms.get(roomCode)?.placeInsurance(socket.id, amount);
    });

    socket.on('sitOut', ({ roomCode, sitOut }: { roomCode: string; sitOut: boolean }) => {
      rooms.get(roomCode)?.setSitOut(socket.id, sitOut);
    });

    socket.on('hit', (roomCode: string) => { rooms.get(roomCode)?.hit(socket.id); });
    socket.on('stand', (roomCode: string) => { rooms.get(roomCode)?.stand(socket.id); });
    socket.on('doubleDown', (roomCode: string) => { rooms.get(roomCode)?.doubleDown(socket.id); });
    socket.on('split', (roomCode: string) => { rooms.get(roomCode)?.split(socket.id); });

    socket.on('nextRound', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!room.startGame(socket.id)) {
        socket.emit('error', 'Only the host can start a new round');
      }
    });

    socket.on('disconnect', () => {
      console.log(`- ${socket.id}`);
      const code = playerRoom.get(socket.id);
      if (!code) return;
      const room = rooms.get(code);
      if (!room) { playerRoom.delete(socket.id); return; }

      const player = room.getPlayer(socket.id);
      const phase = room.getPhase();
      const activePhases = ['betting', 'dealing', 'insurance', 'playing', 'dealer'];

      if (player && activePhases.includes(phase)) {
        // Keep in game during active round — grace period to reconnect
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
    });
  });
}
