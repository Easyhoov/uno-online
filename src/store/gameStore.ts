import { create } from 'zustand';
import type { PublicGameState } from '../game/Game';
import type { Card } from '../game/Card';

/**
 * 房间状态
 */
interface RoomState {
  roomId: string | null;
  isHost: boolean;
  isConnected: boolean;
  players: Array<{
    id: string;
    name: string;
    isHost: boolean;
    isReady: boolean;
  }>;
  isGameRunning: boolean;
}

/**
 * 游戏状态 Store
 */
interface GameStore {
  // 房间状态
  room: RoomState;
  setRoomId: (roomId: string, isHost: boolean) => void;
  setConnected: (connected: boolean) => void;
  updatePlayers: (players: RoomState['players']) => void;
  setGameRunning: (running: boolean) => void;

  // 游戏状态
  gameState: PublicGameState | null;
  myHand: Card[] | null;
  updateGameState: (state: PublicGameState) => void;
  updateMyHand: (hand: Card[]) => void;
  resetGame: () => void;

  // 本地状态
  isMyTurn: boolean;
  selectedCardIndex: number | null;
  showColorPicker: boolean;
  setSelectedCardIndex: (index: number | null) => void;
  setShowColorPicker: (show: boolean) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // 房间状态初始值
  room: {
    roomId: null,
    isHost: false,
    isConnected: false,
    players: [],
    isGameRunning: false
  },

  setRoomId: (roomId, isHost) => {
    set(state => ({
      room: {
        ...state.room,
        roomId,
        isHost
      }
    }));
  },

  setConnected: (connected) => {
    set(state => ({
      room: {
        ...state.room,
        isConnected: connected
      }
    }));
  },

  updatePlayers: (players) => {
    set(state => ({
      room: {
        ...state.room,
        players
      }
    }));
  },

  setGameRunning: (running) => {
    set(state => ({
      room: {
        ...state.room,
        isGameRunning: running
      }
    }));
  },

  // 游戏状态初始值
  gameState: null,
  myHand: null,

  updateGameState: (state) => {
    set({ gameState: state });
  },

  updateMyHand: (hand) => {
    set({ myHand: hand });
  },

  resetGame: () => {
    set({
      gameState: null,
      myHand: null,
      isMyTurn: false,
      selectedCardIndex: null,
      showColorPicker: false
    });
  },

  // 本地状态
  isMyTurn: false,
  selectedCardIndex: null,
  showColorPicker: false,

  setSelectedCardIndex: (index) => {
    set({ selectedCardIndex: index });
  },

  setShowColorPicker: (show) => {
    set({ showColorPicker: show });
  }
}));

/**
 * 辅助 Hook：检查是否是我的回合
 */
export const useIsMyTurn = () => {
  const { gameState, room } = useGameStore();
  
  if (!gameState) return false;
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  return currentPlayer?.id === room.players.find(p => p.isHost === room.isHost)?.id;
};
