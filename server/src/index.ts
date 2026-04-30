import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers } from './socketHandlers';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : '*';

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] },
});

setupSocketHandlers(io);

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => console.log(`Blackjack server on :${PORT}`));
