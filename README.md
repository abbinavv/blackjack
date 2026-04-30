# Blackjack (Multiplayer)

A real-time online Blackjack project built so friends can play together from anywhere.

## Why this project exists

I wanted to play blackjack online with friends, but I could not find a simple website that let us jump in and play together easily. So I built this project.

## What it does

- Multiplayer blackjack gameplay
- Shared game room logic on the server
- Interactive table UI on the client

## Tech stack

- Frontend: React + TypeScript
- Backend: Node.js + TypeScript
- Realtime communication for game state updates

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the project

```bash
npm run dev
```

If your scripts are split between client and server, run each app in separate terminals based on the scripts in `package.json`.

## Project structure

- `client/` - Frontend app and UI components
- `server/` - Backend game room and blackjack logic

## Future improvements

- Invite links for private tables
- Player profiles and stats
- Better table customization and animations
