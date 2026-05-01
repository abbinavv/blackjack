# ♠ Blackjack — Multiplayer

A real-time multiplayer Blackjack web app built so friends can play together from anywhere. No accounts, no downloads — just share a room code and play.

**Live:** [blackjack-client.vercel.app](https://blackjack-client.vercel.app)

---

## Features

### Gameplay (Vegas Strip Rules)
- **2–6 players** per room, host-controlled rounds
- **Stand on Soft 17 (S17)** dealer rule
- **3:2 Blackjack** payout
- **Hit, Stand, Double Down, Split** (up to 4 hands), **Insurance**
- **6-deck shoe** with cut card at 75% — reshuffles automatically
- Ace splits: one card each, auto-stand (standard rule)
- Auto-advance turn on timer expiry (45s per turn)

### Betting
- **$10 minimum** · **$1,000 maximum** regular bet
- **All In** button — bets your full balance, bypasses the cap
- **Custom amount input** — type any number directly
- Chip shortcuts: $10 · $25 · $100 · $500
- Quick presets: Min · ¼ · ½ · Max
- **Sit Out** option during betting — persists to next round
- Auto-rebuy of $200 if balance hits $0

### Multiplayer & UX
- Instant room creation with a 4-character code
- **Reconnect recovery** — refresh mid-game and rejoin within 60 seconds
- **Sit-out toggle** from waiting room, betting phase, and round summary
- **Win/loss toasts** — `+$X Win` (green) / `-$X Loss` (red) after each round
- Opponents shown as score-only (no peeking at other players' cards)
- **Dealer hole card flip** animation on reveal
- Sound effects: card flips, chip clink, win fanfare, loss tone (Web Audio API)
- Balance saved to `localStorage` by name — persists across sessions

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 |
| State | Zustand |
| Backend | Node.js + TypeScript + Express |
| Realtime | Socket.io (WebSockets) |
| Fonts | Playfair Display · JetBrains Mono |
| Deploy | Vercel (client) · Render (server) |

All game logic runs server-side. The client only sends actions; the server is the single source of truth.

---

## Local Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup

```bash
git clone https://github.com/abbinavv/blackjack.git
cd blackjack
npm install
```

### Run (client + server together)

```bash
npm run dev
```

- **Server** → `http://localhost:3001`
- **Client** → `http://localhost:5173`

### Build for production

```bash
npm run build
```

---

## Project Structure

```
blackjack/
├── client/                   # React frontend
│   └── src/
│       ├── components/
│       │   ├── Table.tsx         # Main game table layout
│       │   ├── BetPanel.tsx      # Betting UI — chips, input, all-in
│       │   ├── GameControls.tsx  # Hit / Stand / Double / Split
│       │   ├── PlayerSeat.tsx    # Player seat (full or compact view)
│       │   ├── Hand.tsx          # Card hand renderer
│       │   ├── Card.tsx          # Single card with flip animation
│       │   ├── DealerArea.tsx    # Dealer hand display
│       │   ├── RoundSummary.tsx  # End-of-round results modal
│       │   ├── InsurancePanel.tsx
│       │   ├── WaitingRoom.tsx
│       │   ├── Lobby.tsx
│       │   └── Toast.tsx         # Win / loss / info notifications
│       ├── lib/
│       │   ├── socket.ts         # Socket.io client instance
│       │   ├── sounds.ts         # Synthesised sounds (Web Audio API)
│       │   └── clientRules.ts    # Score helpers for display
│       ├── store/
│       │   └── gameStore.ts      # Zustand global state + localStorage
│       └── types.ts              # Shared TypeScript types
│
└── server/                   # Node.js backend
    └── src/
        ├── index.ts              # Express + Socket.io bootstrap
        ├── socketHandlers.ts     # All socket event handlers
        └── game/
            ├── GameRoom.ts       # Game state machine (all logic)
            ├── rules.ts          # Pure blackjack rule functions
            ├── deck.ts           # 6-deck shoe + Fisher-Yates shuffle
            └── types.ts          # Server type definitions
```

---

## Deployment

### Frontend — Vercel
Set **Root Directory** to `client`. Auto-deploys from `main`.

### Backend — Render (Docker)
Set **Root Directory** to `server`.

**Environment variables:**
```
ALLOWED_ORIGINS=https://blackjack-client.vercel.app
PORT=3001
```

**Keep-alive:** Render free tier sleeps after 15 min of inactivity. Use [UptimeRobot](https://uptimerobot.com) to ping `https://<your-render-url>/health` every 5 minutes.

---

## Rules Reference

| Rule | Value |
|---|---|
| Decks | 6 |
| Dealer rule | Stands on soft 17 |
| Blackjack pays | 3:2 |
| Double Down | First 2 cards only |
| Split | Up to 4 hands |
| Ace split | One card each, auto-stand |
| Insurance | Up to half the initial bet |
| Surrender | Not implemented |
| Cut card | 75% through shoe |
