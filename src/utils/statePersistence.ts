/**
 * 游戏状态持久化
 * 
 * 使用 localStorage 保存游戏状态，支持房主重启后恢复
 */

import type { Game } from '../game/Game';

const STORAGE_KEY_PREFIX = 'uno_game_';
const STATE_VERSION = 1;

/**
 * 持久化状态接口
 */
export interface PersistedState {
  version: number;
  timestamp: number;
  roomId: string;
  serializedGame: string;
  playerIds: string[];
  isHost: boolean;
}

/**
 * 保存游戏状态到 localStorage
 */
export function saveGameState(roomId: string, game: Game, isHost: boolean): boolean {
  try {
    const state: PersistedState = {
      version: STATE_VERSION,
      timestamp: Date.now(),
      roomId,
      serializedGame: game.serialize(),
      playerIds: game.players.map(p => p.id),
      isHost
    };

    localStorage.setItem(`${STORAGE_KEY_PREFIX}${roomId}`, JSON.stringify(state));
    console.log(`[Persistence] Game state saved for room ${roomId}`);
    return true;
  } catch (error) {
    console.error('[Persistence] Failed to save game state:', error);
    return false;
  }
}

/**
 * 从 localStorage 恢复游戏状态
 */
export function loadGameState(roomId: string): { game: Game; state: PersistedState } | null {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${roomId}`);
    if (!stored) {
      console.log(`[Persistence] No saved state found for room ${roomId}`);
      return null;
    }

    const state: PersistedState = JSON.parse(stored);
    
    // 验证版本
    if (state.version !== STATE_VERSION) {
      console.warn(`[Persistence] Version mismatch: expected ${STATE_VERSION}, got ${state.version}`);
      // 可以选择删除旧版本数据
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${roomId}`);
      return null;
    }

    // 检查状态是否过期（超过 24 小时）
    const age = Date.now() - state.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 小时
    if (age > maxAge) {
      console.log(`[Persistence] State expired (age: ${age}ms)`);
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${roomId}`);
      return null;
    }

    // 反序列化游戏
    const game = Game.deserialize(state.serializedGame);
    console.log(`[Persistence] Game state restored for room ${roomId}`);
    
    return { game, state };
  } catch (error) {
    console.error('[Persistence] Failed to load game state:', error);
    return null;
  }
}

/**
 * 删除保存的游戏状态
 */
export function deleteGameState(roomId: string): void {
  localStorage.removeItem(`${STORAGE_KEY_PREFIX}${roomId}`);
  console.log(`[Persistence] Game state deleted for room ${roomId}`);
}

/**
 * 检查是否有保存的游戏状态
 */
export function hasSavedState(roomId: string): boolean {
  return localStorage.getItem(`${STORAGE_KEY_PREFIX}${roomId}`) !== null;
}

/**
 * 列出所有保存的游戏状态
 */
export function listSavedGames(): Array<{ roomId: string; timestamp: number; playerCount: number }> {
  const games: Array<{ roomId: string; timestamp: number; playerCount: number }> = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const state: PersistedState = JSON.parse(stored);
          games.push({
            roomId: state.roomId,
            timestamp: state.timestamp,
            playerCount: state.playerIds.length
          });
        }
      } catch (error) {
        console.error('[Persistence] Failed to parse saved game:', error);
      }
    }
  }
  
  // 按时间戳排序（最新的在前）
  return games.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * 清理过期的游戏状态
 */
export function cleanupExpiredStates(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  let cleaned = 0;
  const now = Date.now();
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const state: PersistedState = JSON.parse(stored);
          if (now - state.timestamp > maxAgeMs) {
            localStorage.removeItem(key);
            cleaned++;
          }
        }
      } catch (error) {
        // 解析失败也删除
        localStorage.removeItem(key!);
        cleaned++;
      }
    }
  }
  
  if (cleaned > 0) {
    console.log(`[Persistence] Cleaned up ${cleaned} expired game states`);
  }
  
  return cleaned;
}

/**
 * 自动保存装饰器
 */
export function autoSave(roomId: string, game: Game, isHost: boolean, intervalMs: number = 30000) {
  if (!isHost) return null;
  
  // 立即保存一次
  saveGameState(roomId, game, isHost);
  
  // 定期保存
  const intervalId = setInterval(() => {
    saveGameState(roomId, game, isHost);
  }, intervalMs);
  
  // 返回清理函数
  return () => {
    clearInterval(intervalId);
  };
}
