# UNO Online 🎴

Real-time multiplayer UNO card game — no server, no registration, just play.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![PeerJS](https://img.shields.io/badge/PeerJS-orange?style=flat)

**English** | **[中文](./README.zh-CN.md)**

## ✨ Features

- **P2P Multiplayer** — WebRTC-based, no central game server needed
- **Host-Authoritative** — Game logic runs on the host to prevent cheating
- **Complete UNO Rules** — Skip, Reverse, Draw Two, Wild, Wild Draw Four, UNO call, stacking
- **Real-time Sync** — Instant state updates across all players
- **Game Log** — Live event feed so you know exactly what happened
- **Smart Hand Sorting** — Cards auto-sorted by color and value
- **Responsive UI** — Works on desktop and mobile
- **Zero Registration** — Generate a room code, share it, play

## 🎮 How to Play

1. Open the game and enter your nickname
2. **Create a room** — you become the host, get a 6-character room code
3. Share the code with friends (2-4 players)
4. Friends enter the code and join
5. Host clicks **Start Game** — everyone gets 7 cards
6. Match cards by **color** or **number/symbol**, or play a Wild card
7. Don't forget to click **UNO!** when you're down to 2 cards
8. First player to empty their hand wins! 🏆

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Install & Run

```bash
git clone https://github.com/Easyhoov/uno-online.git
cd uno-online
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript |
| Build | Vite 8 |
| State | Zustand |
| P2P | PeerJS (WebRTC) |
| Styling | CSS-in-JS (inline styles) |

## 📁 Project Structure

```
src/
├── game/                # Core game engine
│   ├── Card.ts          # Card types and helpers
│   ├── Deck.ts          # Deck management (shuffle, draw, reshuffle)
│   ├── enums.ts         # CardColor, CardType enums
│   ├── Game.ts          # Game state machine (rules engine)
│   └── Player.ts        # Player class (hand management)
├── p2p/                 # Networking layer
│   ├── messages.ts      # P2P message protocol
│   └── peerConnection.ts # PeerJS connection manager
├── store/
│   └── gameStore.ts     # Zustand global state
├── components/
│   ├── Lobby.tsx         # Room creation / join UI
│   ├── GameTable.tsx     # Main game board + event log
│   ├── CardComponent.tsx # Card rendering
│   └── ColorPicker.tsx   # Wild card color selector
├── App.tsx
├── App.css
├── index.css
└── main.tsx
```

## 🃏 Game Rules

- **Number cards** — Match by color or number
- **Skip** ⊘ — Next player loses their turn
- **Reverse** ⇄ — Play direction reverses (acts as Skip in 2-player)
- **Draw Two** +2 — Next player draws 2 (stackable)
- **Wild** 🃏 — Play anytime, choose the next color
- **Wild Draw Four** +4 — Choose color, next player draws 4 (stackable)
- **UNO Call** — Must click UNO when down to 2 cards, or draw 2 as penalty
- **Stacking** — +2 and +4 cards can be stacked

## 🔧 Architecture

The game uses a **Host-Authoritative** model:

```
Host (Room Creator)              Clients (Other Players)
┌──────────────────┐            ┌──────────────────┐
│  Game Engine     │◄──Actions──│  UI + Validation │
│  (truth source)  │──State────►│  (optimistic)    │
│  Rule Validation │            │                  │
└──────────────────┘            └──────────────────┘
         ▲                              ▲
         └──────── WebRTC P2P ──────────┘
```

- All game actions are validated by the host
- Clients only receive their own hand (no peeking!)
- When the deck runs out, the discard pile is reshuffled back

## 📝 License

MIT

## 🤝 Contributing

PRs welcome! Feel free to open issues for bugs or feature requests.
