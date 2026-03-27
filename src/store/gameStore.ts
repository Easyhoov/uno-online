import { create } from 'zustand';
import type { PublicGameState } from '../game/Game';
import type { Card } from '../game/Card';

/**
 * 错误信息接口
 */
export interface ErrorMessage {
  code: string;
  message: string;
  timestamp: number;
}

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
 * 错误状态
 */
interface ErrorState {
  errors: ErrorMessage[];
  maxErrors: number;
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

  // 错误状态
  error: ErrorState;
  addError: (code: string, message: string) => void;
  clearErrors: () => void;
  dismissError: (index: number) => void;

  // 本地状态
  selectedCardIndex: number | null;
  showColorPicker: boolean;
  setSelectedCardIndex: (index: number | null) => void;
  setShowColorPicker: (show: boolean) => void;
}

/**
 * 辅助 Hook：检查是否是我的回合（自动派生）
 */
export const useIsMyTurn = () => {
  const { gameState, room } = useGameStore();
  
  if (!gameState || !room.roomId) return false;
  
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (!currentPlayer) return false;
  
  // 根据当前玩家 ID 判断是否是我的回合
  const myId = room.isHost ? 'host' : room.players.find(p => !p.isHost)?.id;
  return currentPlayer.id === myId;
};

/**
 * 辅助 Hook：获取我的玩家 ID
 */
export const useMyPlayerId = () => {
  const { room } = useGameStore();
  return room.isHost ? 'host' : room.players.find(p => !p.isHost)?.id || null;
};

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
      selectedCardIndex: null,
      showColorPicker: false
    });
  },

  // 错误状态
  error: {
    errors: [],
    maxErrors: 5
  },

  addError: (code, message) => {
    set(state => {
      const newError: ErrorMessage = {
        code,
        message,
        timestamp: Date.now()
      };
      const errors = [...state.error.errors, newError];
      // 保持最多 maxErrors 个错误
      if (errors.length > state.error.maxErrors) {
        errors.shift();
      }
      return { error: { ...state.error, errors } };
    });
  },

  clearErrors: () => {
    set({ error: { errors: [], maxErrors: 5 } });
  },

  dismissError: (index) => {
    set(state => {
      const errors = [...state.error.errors];
      errors.splice(index, 1);
      return { error: { ...state.error, errors } };
    });
  },

  // 本地状态
  selectedCardIndex: null,
  showColorPicker: false,

  setSelectedCardIndex: (index) => {
    set({ selectedCardIndex: index });
  },

  setShowColorPicker: (show) => {
    set({ showColorPicker: show });
  }
}));
