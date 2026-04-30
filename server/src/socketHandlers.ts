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

    socket.on('startGame', (roomCode: string) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!room.startGame(socket.id)) {
        socket.emit('error', 'Need at least 2 players to start');
      }
    });

    socket.on('placeBet', ({ roomCode, amount }: { roomCode: string; amount: number }) => {
      rooms.get(roomCode)?.placeBet(socket.id, amount);
    });

    socket.on('placeInsurance', ({ roomCode, amount }: { roomCode: string; amount: number }) => {
      rooms.get(roomCode)?.placeInsurance(socket.id, amount);
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
      if (room) {
        const name = room.getPlayer(socket.id)?.name;
        room.removePlayer(socket.id);
        if (room.isEmpty()) {
          room.destroy();
          rooms.delete(code);
        } else {
          io.to(code).emit('gameState', room.getPublicState());
          if (name) io.to(code).emit('toast', `${name} left the game`);
        }
      }
      playerRoom.delete(socket.id);
    });
  });
}
