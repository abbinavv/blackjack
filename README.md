# ♠ Casino Night — Multiplayer

A real-time multiplayer casino web app. Play **Blackjack** or **Roulette** with friends from anywhere — no accounts, no downloads. Share a room code and you're in.

**Live:** [blackjack-client.vercel.app](https://blackjack-client.vercel.app)

---

## Games

### ♠ Blackjack (Vegas Strip Rules)
- **2–6 players** per room, host-controlled rounds
- **Stand on Soft 17 (S17)** dealer rule · **3:2 Blackjack** payout
- **Hit, Stand, Double Down, Split** (up to 4 hands), **Insurance**
- **6-deck shoe** with cut card at 75% — reshuffles automatically
- Ace splits: one card each, auto-stand (standard rule)
- Auto-advance turn on 45 s timer
- **$10 minimum** · **$1,000 maximum** · **All In** bypasses the cap
- Chip shortcuts: $10 · $25 · $100 · $500 · Quick presets: Min · ¼ · ½ · Max
- **Sit Out** option — persists between rounds; auto-rebuy $200 on bust

### 🎡 Roulette (European)
- **European wheel** — 37 pockets (0–36), house edge 2.7%
- **30-second betting window** per round
- Full bet board: Straight, Dozen, Column, Red/Black, Odd/Even, Low/High
- Visual chip overlay on placed bets — gold chip shows amount per cell
- Animated SVG wheel with authentic number order and spin physics
- Result shown in wheel + recent history strip (last 10 results)
- Host can spin early; host advances to next round
- Landscape-only on mobile (portrait → rotate prompt)

**Roulette Payouts**

| Bet | Covers | Payout |
|---|---|---|
| Straight | 1 number | 35 : 1 |
| Split | 2 adjacent | 17 : 1 |
| Street | 3 in a row | 11 : 1 |
| Corner | 4 in a square | 8 : 1 |
| Six Line | 6 numbers (2 rows) | 5 : 1 |
| Dozen | 1–12 / 13–24 / 25–36 | 2 : 1 |
| Column | Column of 12 | 2 : 1 |
| Red / Black | Color | 1 : 1 |
| Odd / Even | Parity | 1 : 1 |
| Low / High | 1–18 / 19–36 | 1 : 1 |

---

## Multiplayer & UX

- **Game lobby** — pick Blackjack or Roulette before creating/joining a room
- Instant room creation with a 4-character code
- **Reconnect recovery** — refresh mid-game and rejoin within 60 seconds
- **Win/loss toasts** — `+$X` (green) / `-$X` (red) after each round
- Balance saved to `localStorage` by name — persists across sessions
- Sound effects: card flips, chip clink, roulette wheel spin, ball drop, win fanfare, all-in push (real MP3 files + Web Audio API)
- In-game **ⓘ How to Play** modal for Roulette

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
│   ├── public/sounds/        # MP3 sound effects
│   └── src/
│       ├── components/
│       │   ├── GameSelect.tsx        # Game lobby (Blackjack / Roulette picker)
│       │   ├── Table.tsx             # Blackjack table layout
│       │   ├── BetPanel.tsx          # Blackjack betting UI
│       │   ├── GameControls.tsx      # Hit / Stand / Double / Split
│       │   ├── PlayerSeat.tsx        # Player seat (full or compact view)
│       │   ├── Hand.tsx              # Card hand renderer
│       │   ├── Card.tsx              # Single card with flip animation
│       │   ├── DealerArea.tsx        # Dealer hand display
│       │   ├── RoundSummary.tsx      # End-of-round results modal
│       │   ├── InsurancePanel.tsx
│       │   ├── RouletteTable.tsx     # Roulette table layout
│       │   ├── RouletteWheel.tsx     # Animated SVG roulette wheel
│       │   ├── RouletteBetBoard.tsx  # Full bet board with chip selector
│       │   ├── WaitingRoom.tsx
│       │   ├── Lobby.tsx
│       │   └── Toast.tsx
│       ├── lib/
│       │   ├── socket.ts         # Socket.io client instance
│       │   ├── sounds.ts         # Real MP3 + Web Audio API sounds
│       │   └── clientRules.ts    # Score helpers for display
│       ├── store/
│       │   └── gameStore.ts      # Zustand global state + localStorage
│       └── types.ts              # Shared TypeScript types (Blackjack + Roulette)
│
└── server/                   # Node.js backend
    └── src/
        ├── index.ts              # Express + Socket.io bootstrap
        ├── socketHandlers.ts     # All socket event handlers (routes by game type)
        └── game/
            ├── GameRoom.ts           # Blackjack state machine
            ├── RouletteGameRoom.ts   # Roulette state machine
            ├── rules.ts              # Pure blackjack rule functions
            ├── deck.ts               # 6-deck shoe + Fisher-Yates shuffle
            └── types.ts              # Server type definitions
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

## Blackjack Rules Reference

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
