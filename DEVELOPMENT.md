# Blackjack — Developer Reference

Complete internal documentation covering everything built, every architectural decision, and the full deployment setup.

---

## Table of Contents

1. [What Was Built](#1-what-was-built)
2. [Architecture Overview](#2-architecture-overview)
3. [Game State Machine](#3-game-state-machine)
4. [File-by-File Reference](#4-file-by-file-reference)
5. [Blackjack Rules Implemented](#5-blackjack-rules-implemented)
6. [Socket Events Reference](#6-socket-events-reference)
7. [Local Development Setup](#7-local-development-setup)
8. [Deployment — Step by Step](#8-deployment--step-by-step)
9. [Environment Variables](#9-environment-variables)
10. [Known Quirks & Decisions](#10-known-quirks--decisions)
11. [What Could Be Added Next](#11-what-could-be-added-next)

---

## 1. What Was Built

A fully real-time multiplayer Blackjack web application that runs in the browser. Players create or join rooms with a 4-character code, place bets, and play through complete rounds of Vegas Strip Blackjack against the dealer.

### Feature checklist

**Core gameplay**
- [x] Vegas Strip rules: S17, 3:2 BJ, Hit/Stand/Double/Split/Insurance
- [x] 6-deck shoe, Fisher-Yates shuffle, cut card at 75%
- [x] Auto-reshuffle between rounds when cut card is passed
- [x] Up to 4 split hands per player, Ace splits get 1 card and auto-stand
- [x] Insurance up to half the initial bet (2:1 payout)
- [x] Dealer blackjack check before player turns
- [x] Turn timer (45s) with auto-stand on expiry
- [x] Betting timer (30s) with auto-min-bet on expiry

**Betting**
- [x] $10 minimum, $1,000 maximum regular bet
- [x] All In — bets full balance, bypasses $1,000 cap (server-authoritative)
- [x] Direct amount text input (always visible)
- [x] Chip buttons: $10, $25, $100, $500
- [x] Quick presets: Min, ¼, ½, Max
- [x] Sit Out this round (persists to next round via `wantsSitOut` flag)
- [x] Auto-rebuy of $200 when balance hits $0

**Multiplayer**
- [x] 2–6 players per room
- [x] Host-only start game and next round
- [x] Auto host migration when host disconnects
- [x] Reconnect recovery — 60-second grace period, rejoin by name
- [x] Disconnected players' turns are auto-stood immediately
- [x] Toast broadcast when player joins, disconnects, or reconnects

**UI/UX**
- [x] You see your own cards fully; other players show score total only
- [x] Dealer hole card 3D flip animation (CSS `rotateY`) on reveal
- [x] Card deal-in animation (`translateY` + `rotate`)
- [x] Win/loss/push toast notifications with colour coding
- [x] Round summary modal with per-hand +/- amounts and net total
- [x] Sit-out toggle in waiting room, betting phase, and round summary
- [x] Turn timer progress bar (gold → amber → red)
- [x] Timer ring on opponent's seat when < 10s remain
- [x] Balance persisted in `localStorage` keyed by player name
- [x] Session (roomCode + playerName) persisted in `localStorage` for reconnect
- [x] Synthesised sound effects — no audio files, pure Web Audio API

**Deployment**
- [x] Vercel (frontend, auto-deploy from `main`)
- [x] Render free tier (backend, Docker)
- [x] UptimeRobot keep-alive ping every 5 min (prevents Render sleep)
- [x] CORS locked to production origin via `ALLOWED_ORIGINS` env var

---

## 2. Architecture Overview

```
Browser (React)                     Server (Node.js)
──────────────                      ────────────────
Zustand store ◄─── socket.on ────── GameRoom.emit('stateChange')
     │                                      │
     └── socket.emit ──────────────► socketHandlers.ts
                                            │
                                     rooms Map<code, GameRoom>
                                     playerRoom Map<socketId, code>
```

**Key principle:** The server is the single source of truth. The client never mutates game state directly — it only emits events (`hit`, `stand`, `placeBet`, etc.). After every state change, the server broadcasts a full `PublicGameState` snapshot to all clients in the room via `io.to(roomCode).emit('gameState', state)`.

**Why full snapshot instead of diffs?** Simplicity and correctness. With 2–6 players and small state objects (~5KB), diffing adds complexity without meaningful bandwidth savings.

**In-memory only.** No database. All game state lives in a `Map<string, GameRoom>` on the Node.js process. Restarting the server wipes all rooms. This is intentional — no persistence layer needed for a casual game.

---

## 3. Game State Machine

```
waiting
   │  (host clicks Start — ≥2 active players)
   ▼
betting  ──(30s timer or all bet)──►  dealing
                                          │
                         (280ms per card, 2 rounds)
                                          │
                              dealer shows Ace?
                             ╱                  ╲
                           yes                   no
                            │                    │
                        insurance             playing
                      (10s timer)                │
                            │              (45s per turn)
                            └──────────────────► │
                                                 ▼
                                              dealer
                                         (reveal + draw)
                                                 │
                                                 ▼
                                            complete
                                                 │
                              (host clicks Next Round)
                                                 │
                                           back to betting
```

Phase transitions are driven entirely by the server (`GameRoom.ts`). The client reads `gameState.phase` to decide which UI panel to show.

---

## 4. File-by-File Reference

### Server

#### `server/src/index.ts`
Express app + Socket.io server bootstrap. Sets up CORS using the `ALLOWED_ORIGINS` env var. Exposes `GET /health` for UptimeRobot.

#### `server/src/socketHandlers.ts`
Wires every socket event to a `GameRoom` method. Maintains two maps:
- `rooms: Map<string, GameRoom>` — all active rooms
- `playerRoom: Map<string, string>` — socket ID → room code

Handles the disconnect grace period: during an active game phase, marks the player as disconnected and schedules a 60s cleanup instead of immediately removing them.

#### `server/src/game/GameRoom.ts`
The entire game engine. Key responsibilities:
- State machine transitions between all phases
- Timer management (betting/insurance/turn intervals)
- `placeBet(playerId, amount, forceAllIn)` — all-in bypasses MAX_BET
- `setSitOut(playerId, sitOut)` — sets both `isSittingOut` and `wantsSitOut`
- `markDisconnected(playerId)` — auto-stands their turn, marks flag
- `rejoinPlayer(newSocketId, name)` — swaps socket ID, clears disconnect flag
- `getPublicState()` — strips private server state before sending to clients

#### `server/src/game/rules.ts`
Pure functions, no side effects:
- `handScore(cards)` — visible score (face-down cards = 0)
- `fullHandScore(cards)` — full score, handles soft aces
- `isBlackjack(cards)` — Ace + 10-value on first two cards
- `isBust(cards)` — score > 21
- `dealerShouldHit(cards)` — S17 rule
- `canDouble(hand)` — 2 cards only
- `canSplit(hand)` — 2 cards, same value
- `calculatePayout(hand, dealerCards, insuranceBet, dealerBJ)` — net change in balance

#### `server/src/game/deck.ts`
- `createShoe()` — builds 6 standard 52-card decks, shuffles with Fisher-Yates
- `dealCard(deck, faceUp)` — immutable: returns `[card, newDeck]`
- `getCutCardPosition(deckSize)` — 75% of shoe

#### `server/src/game/types.ts`
All TypeScript interfaces: `Card`, `Player`, `PlayerHand`, `GameState`, `PublicPlayer`, `PublicPlayerHand`, `PublicGameState`. The `Public*` types are what gets sent to clients — they omit internal fields like the deck array.

---

### Client

#### `client/src/App.tsx`
Root component. Sets up all socket listeners on mount:
- `connect` — restores session from `localStorage` via `rejoinRoom`
- `gameState` — updates Zustand store
- `toast` — adds info toast
- `error` — shows error banner (4s auto-dismiss)

#### `client/src/store/gameStore.ts`
Zustand store with:
- `gameState`, `myId`, `roomCode`, `playerName`, `error`, `toasts`
- `addToast(msg, type)` — auto-removes after 3.5s using internal setTimeout
- Helper exports: `saveBalance`, `loadBalance`, `saveSession`, `loadSession`, `clearSession`

#### `client/src/lib/socket.ts`
Single Socket.io client instance. Reads `VITE_SERVER_URL` from env (falls back to same origin for local dev proxy). `autoConnect: false` so Lobby controls when to connect.

#### `client/src/lib/sounds.ts`
All sounds are synthesised at runtime using the Web Audio API — no audio files. A shared `AudioContext` with a `DynamicsCompressor` and `GainNode` master chain.

| Sound | How it's made |
|---|---|
| Card flip | Bandpass-filtered white noise (3.2 kHz) + short sine thump (110 Hz) |
| Chip clink | Click transient + harmonic sines at 1050/1680/2310/3150 Hz |
| Win | Rising sine fanfare (C5 → E5 → G5) |
| Lose | Descending triangle wave (D4 → B3 → A3) |
| Blackjack | Win fanfare × 1.5 amplitude |
| Button | Very short 800 Hz sine click |

#### `client/src/lib/clientRules.ts`
Score calculation mirrored from the server for display purposes (`fullHandScore`, `isBlackjack`). Uses a loose `AnyCard` type to avoid import issues between server/client.

#### `client/src/components/Table.tsx`
Main layout during an active game. Structure:
1. Top bar — room code + balance + round number
2. Felt table — contains everything below
3. Other players row — compact pills (score only, no cards)
4. Dealer area — cards + score
5. Divider
6. Your seat — full cards, score, bet
7. Control area — BetPanel / InsurancePanel / GameControls / status messages

#### `client/src/components/BetPanel.tsx`
Shows during `betting` phase for players who haven't bet yet. Direct input field for amount, chips, presets, All In button. Shows a low-balance fallback screen when `balance < $10`.

#### `client/src/components/GameControls.tsx`
Shows during `playing` phase. If it's your turn: Hit/Stand/Double/Split buttons. If another player's turn: shows their name + timer. Shared `TurnTimer` sub-component used in both cases.

#### `client/src/components/PlayerSeat.tsx`
Two rendering modes controlled by `hideCards` prop:
- `hideCards={true}` — compact pill for other players: name, balance, score totals, status badge, disconnect indicator
- `hideCards={false}` — full seat for current user: name, balance, full card hands via `<Hand>`

#### `client/src/components/Card.tsx`
Renders a single playing card. Tracks `prevFaceUp` ref — when a card transitions from face-down to face-up, plays card flip sound and applies `animate-flipCard` (CSS `rotateY(90deg → 0deg)`). New cards get `animate-dealIn` (`translateY` + `rotate` slide-in).

#### `client/src/components/RoundSummary.tsx`
Modal shown during `complete` phase. Shows per-player, per-hand results with net amounts. Has sit-out toggle for next round. Fires win/loss/push toast and plays sound on mount.

#### `client/src/components/Toast.tsx`
Renders the `toasts` array from the store. Win = green, loss = red, info = neutral dark.

---

## 5. Blackjack Rules Implemented

| Rule | Detail |
|---|---|
| Decks | 6 |
| Shuffle | Fisher-Yates on all 312 cards |
| Cut card | 75% through shoe (≈234 cards from top) |
| Blackjack payout | 3:2 (floor division, e.g. $15 on $10 bet) |
| Dealer rule | Stands on all 17s including soft 17 (S17) |
| Double Down | Allowed on first 2 cards only, any total |
| Split | Up to 4 hands total, same-value cards (10/J/Q/K count as equal) |
| Ace split | One card each, hands auto-stand, no re-split, no blackjack possible |
| Insurance | Available when dealer shows Ace, pays 2:1, max = half initial bet |
| Surrender | Not implemented |
| Bust | Player bust = automatic loss regardless of dealer |
| Push | Equal scores = bet returned (net $0) |
| Both blackjack | Push |
| Dealer blackjack | All non-BJ player hands lose their bet; insurance pays |

---

## 6. Socket Events Reference

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `createRoom` | `{ name, savedBalance? }` | Creates a room, callback returns room code |
| `joinRoom` | `{ roomCode, name, savedBalance? }` | Joins existing room (waiting phase only) |
| `rejoinRoom` | `{ roomCode, name }` | Rejoins mid-game by name match |
| `startGame` | `roomCode` | Host only — starts betting phase |
| `nextRound` | `roomCode` | Host only — starts next betting phase |
| `placeBet` | `{ roomCode, amount, allIn? }` | Places a bet; `allIn: true` uses server balance |
| `placeInsurance` | `{ roomCode, amount }` | Places insurance bet (0 = decline) |
| `sitOut` | `{ roomCode, sitOut: boolean }` | Toggles sit-out for current/next round |
| `hit` | `roomCode` | Hit current hand |
| `stand` | `roomCode` | Stand current hand |
| `doubleDown` | `roomCode` | Double down current hand |
| `split` | `roomCode` | Split current hand |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `gameState` | `PublicGameState` | Full state snapshot, sent after every change |
| `toast` | `string` | Notification message (join/leave/reconnect) |
| `error` | `string` | Action rejected message |

---

## 7. Local Development Setup

### Prerequisites

- **Node.js 18+** — check with `node -v`
- **npm 9+** — check with `npm -v`

### Install

```bash
git clone https://github.com/abbinavv/blackjack.git
cd blackjack
npm install          # installs root + both workspaces (client + server)
```

### Run both client and server together

```bash
npm run dev
```

Uses `concurrently`. Output is colour-coded:
- **Cyan** = server logs (`tsx watch`)
- **Yellow** = Vite dev server logs

| Service | URL |
|---|---|
| Client | http://localhost:5173 |
| Server | http://localhost:3001 |
| Health check | http://localhost:3001/health |

The Vite dev server proxies `/socket.io` to `localhost:3001` automatically (configured in `vite.config.ts`) — no CORS issues locally.

### Run separately

```bash
# Terminal 1
npm run dev --workspace=server

# Terminal 2
npm run dev --workspace=client
```

### Build

```bash
npm run build        # builds server (tsc) then client (tsc + vite build)
```

Server output: `server/dist/`  
Client output: `client/dist/`

### Environment — local

No `.env` files needed for local dev. The client reads `VITE_SERVER_URL` at build time; in dev it falls back to proxying through Vite. The server uses port 3001 and allows all origins locally.

---

## 8. Deployment — Step by Step

### Frontend — Vercel

1. Push repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. Set **Root Directory** to `client`
4. Set **Framework Preset** to `Vite`
5. Add environment variable:
   ```
   VITE_SERVER_URL = https://<your-render-url>
   ```
6. Deploy — Vercel auto-deploys on every push to `main`

> **403 on preview URLs?** Go to Project → Settings → Deployment Protection → disable Vercel Authentication. The production domain (`blackjack-client.vercel.app`) is always public.

---

### Backend — Render

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - **Root Directory:** `server`
   - **Environment:** Docker
   - **Instance type:** Free
4. Add environment variables (see section 9)
5. Deploy

Render uses the `server/Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

Auto-deploys on push to `main` (you can configure which branch in Render settings).

---

### Keep-Alive — UptimeRobot

Render free tier hibernates after 15 minutes of inactivity. Cold start takes ~50 seconds which breaks the initial connection for players.

**Fix:**

1. Go to [uptimerobot.com](https://uptimerobot.com) → Free account
2. Add Monitor:
   - Type: HTTP(s)
   - URL: `https://<your-render-url>/health`
   - Interval: **5 minutes**
3. Save — the server now stays awake 24/7

The `/health` endpoint returns `200 OK` with `{ status: 'ok' }`.

---

### Full deployment flow after a code change

```
git push origin main
      │
      ├──► Vercel detects push → builds client → live in ~30s
      │
      └──► Render detects push → builds Docker image → live in ~3–5 min
```

Check Render's deploy logs at Dashboard → your service → Events tab.

---

## 9. Environment Variables

### Server (Render)

| Variable | Example | Description |
|---|---|---|
| `ALLOWED_ORIGINS` | `https://blackjack-client.vercel.app` | Comma-separated CORS origins. Omit trailing slash. |
| `PORT` | `3001` | Port to listen on (Render sets this automatically) |

### Client (Vercel)

| Variable | Example | Description |
|---|---|---|
| `VITE_SERVER_URL` | `https://blackjack-api.onrender.com` | WebSocket server URL. Must NOT have trailing slash. |

---

## 10. Known Quirks & Decisions

### Balance is not deducted during play
The server does not subtract the bet from `player.balance` when the round starts. Balance only changes in `settleRound()` via `calculatePayout()`. This means the balance shown during a round is the pre-bet balance — which is intentional (matches casino display convention: your balance shows what you had, the bet is separate).

### `wantsSitOut` vs `isSittingOut`
Two flags exist because they serve different purposes:
- `wantsSitOut` — persistent preference, set by the player explicitly
- `isSittingOut` — computed at the start of each betting phase from `wantsSitOut`

A player who doesn't bet in time is auto-sat-out for that round (`isSittingOut = true`) but `wantsSitOut` stays `false`, so they're back in next round automatically.

### All In is server-authoritative
The ALL IN button sends `{ allIn: true }` to the server. The server ignores the `amount` field entirely and uses `player.balance` directly. This prevents stale client state from causing the wrong bet amount.

### No database — in-memory only
All rooms and game state exist only in the Node.js process memory. If Render restarts the server (e.g. new deploy, crash, or forced restart), all active games are lost. Players will see the connection drop and need to create a new room. This is an acceptable trade-off for a casual game with no user accounts.

### Reconnect by name match
`rejoinRoom` matches by `player.name.toLowerCase()`. If two players in the same room have the same name (not prevented by the server), the first matching disconnected player gets the new socket. In practice this doesn't happen because the room code + name combination is effectively unique per session.

### Socket.io auto-reconnect disabled
`autoConnect: false` is set on the client socket. The Lobby component controls when to call `socket.connect()`, which gives us the 12-second timeout and error message flow instead of silent infinite retries.

### Sounds need a user gesture
Web Audio API requires a user interaction before an `AudioContext` can be created. All sounds are triggered from button click handlers, so this is naturally satisfied.

---

## 11. What Could Be Added Next

### Quick wins (a few hours each)

| Feature | Notes |
|---|---|
| **Mute button** | Toggle `masterGain.gain.value` between 0 and 0.55 in `sounds.ts`. Add a 🔊/🔇 icon to the top bar. |
| **Invite link** | Read `?room=ABCD` from the URL on load and pre-fill the join code. Set URL on room create. |
| **Surrender** | Server: new `surrender()` method — stand + lose half bet. Client: add a Surrender button in `GameControls` (only on first 2 cards). |
| **Host kick** | Add `kickPlayer` socket event, show a kick button next to player names in the waiting room (host only). |
| **Confirm All In** | Add a brief confirmation modal/toast before submitting the all-in to prevent mis-taps. |

### Medium effort (1–2 days)

| Feature | Notes |
|---|---|
| **Basic strategy hints** | After cards are dealt, compute the "correct" play per basic strategy chart and highlight the recommended button in green. |
| **In-game chat** | Add a `chatMessage` socket event. Render a scrolling log of messages in a small panel. |
| **Round history** | Store the last N round results client-side and show a mini history strip on the table. |
| **Animated chips** | CSS keyframe animation of chips flying from the player seat to the center on bet, and back on win. |

### Larger effort (requires rethinking architecture)

| Feature | Notes |
|---|---|
| **Persistent stats** | Needs a database (Supabase/PostgreSQL). Track win/loss/BJ count per player name. |
| **Spectator mode** | Allow joining a room without a seat. Server would need a `spectators` list separate from `players`. |
| **Persistent game state** | Store `GameRoom` state in Redis so a server restart doesn't kill active games. |
| **Side bets (Perfect Pairs / 21+3)** | Significant server-side rule additions. |
