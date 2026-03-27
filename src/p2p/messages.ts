import type { GameAction, PublicGameState } from '../game/Game';
import type { Card } from '../game/Card';

/**
 * P2P 消息类型
 */
export type MessageType =
  | 'JOIN_ROOM'
  | 'JOIN_ACK'
  | 'PLAYER_JOINED'
  | 'PLAYER_LEFT'
  | 'GAME_START'
  | 'ACTION'
  | 'ACTION_RESULT'
  | 'STATE_UPDATE'
  | 'HAND_UPDATE'
  | 'FULL_STATE_UPDATE'
  | 'GAME_OVER'
  | 'ERROR'
  | 'KEEPALIVE'
  | 'KICK_PLAYER'
  | 'KICKED'
  | 'HOST_TRANSFER'
  | 'RECONNECT_REQUEST'
  | 'RECONNECT_ACK'
  | 'GAME_STATE_SYNC'
  | 'RETURN_TO_LOBBY'
  | 'READY_CHANGE';

/**
 * P2P 消息基础接口
 */
export interface Message {
  type: MessageType;
  timestamp: number;
}

/**
 * 加入房间请求
 */
export interface JoinRoomMessage extends Message {
  type: 'JOIN_ROOM';
  roomId: string;
  playerName: string;
}

/**
 * 加入房间确认
 */
export interface JoinAckMessage extends Message {
  type: 'JOIN_ACK';
  success: boolean;
  playerId?: string;
  players?: Array<{
    id: string;
    name: string;
    isHost: boolean;
  }>;
  error?: string;
}

/**
 * 玩家加入广播
 */
export interface PlayerJoinedMessage extends Message {
  type: 'PLAYER_JOINED';
  player: {
    id: string;
    name: string;
    isHost: boolean;
  };
  players: Array<{
    id: string;
    name: string;
    isHost: boolean;
  }>;
}

/**
 * 玩家离开广播
 */
export interface PlayerLeftMessage extends Message {
  type: 'PLAYER_LEFT';
  playerId: string;
  players: Array<{
    id: string;
    name: string;
    isHost: boolean;
  }>;
}

/**
 * 游戏开始
 */
export interface GameStartMessage extends Message {
  type: 'GAME_START';
  players: Array<{
    id: string;
    name: string;
    isHost: boolean;
  }>;
}

/**
 * 动作请求（客户端→房主）
 */
export interface ActionMessage extends Message {
  type: 'ACTION';
  action: GameAction;
}

/**
 * 动作结果（房主→客户端）
 */
export interface ActionResultMessage extends Message {
  type: 'ACTION_RESULT';
  success: boolean;
  error?: string;
}

/**
 * 状态更新（房主→所有客户端）
 */
export interface StateUpdateMessage extends Message {
  type: 'STATE_UPDATE';
  gameState: PublicGameState;
  events: Array<{
    type: string;
    playerId?: string;
    card?: Card;
    color?: string;
    amount?: number;
  }>;
}

/**
 * 手牌更新（房主→特定客户端）
 */
export interface HandUpdateMessage extends Message {
  type: 'HAND_UPDATE';
  hand: Card[];
}

/**
 * 完整状态更新（合并 gameState + hand，减少消息数量）
 */
export interface FullStateUpdateMessage extends Message {
  type: 'FULL_STATE_UPDATE';
  gameState: PublicGameState;
  hand?: Card[]; // 仅发送给对应玩家
}

/**
 * 游戏结束
 */
export interface GameOverMessage extends Message {
  type: 'GAME_OVER';
  winnerId: string;
  winnerName: string;
  scores: Array<{
    playerId: string;
    playerName: string;
    score: number;
  }>;
}

/**
 * 错误消息
 */
export interface ErrorMessage extends Message {
  type: 'ERROR';
  code: string;
  message: string;
}

/**
 * 心跳消息
 */
export interface KeepaliveMessage extends Message {
  type: 'KEEPALIVE';
  playerId: string;
}

/**
 * 踢出玩家（房主→客户端）
 */
export interface KickPlayerMessage extends Message {
  type: 'KICK_PLAYER';
  targetPlayerId: string;
  reason?: string;
}

/**
 * 被踢出通知（客户端收到）
 */
export interface KickedMessage extends Message {
  type: 'KICKED';
  reason?: string;
}

/**
 * 房主转移（房主→客户端）
 */
export interface HostTransferMessage extends Message {
  type: 'HOST_TRANSFER';
  newHostId: string;
  newHostName: string;
  serializedGame?: string; // 序列化的游戏状态（用于新房主恢复）
}

/**
 * 重连请求（客户端→房主）
 */
export interface ReconnectRequestMessage extends Message {
  type: 'RECONNECT_REQUEST';
  playerId: string;
  roomId: string;
  playerName: string;
}

/**
 * 重连确认（房主→客户端）
 */
export interface ReconnectAckMessage extends Message {
  type: 'RECONNECT_ACK';
  success: boolean;
  gameState?: PublicGameState;
  myHand?: Card[];
  error?: string;
}

/**
 * 游戏状态同步（房主→重连玩家）
 */
export interface GameStateSyncMessage extends Message {
  type: 'GAME_STATE_SYNC';
  gameState: PublicGameState;
  myHand: Card[];
}

/**
 * 创建消息辅助函数
 */
export function createMessage<T extends Message>(type: MessageType, data: Omit<T, 'type' | 'timestamp'>): T {
  return {
    type,
    timestamp: Date.now(),
    ...data
  } as T;
}

/**
 * 消息类型守卫
 */
export function isMessage(msg: any): msg is Message {
  return msg && typeof msg.type === 'string' && typeof msg.timestamp === 'number';
}
