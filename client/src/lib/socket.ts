import { io } from 'socket.io-client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SERVER_URL = (import.meta as any).env?.VITE_SERVER_URL ?? 'http://localhost:3001';
export const socket = io(SERVER_URL, { autoConnect: false });
