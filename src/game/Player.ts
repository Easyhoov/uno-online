import type { Card } from './Card';
import { Deck } from './Deck';
import { generatePlayerId as genPlayerId, generatePlayerName as genName } from '../utils/idGenerator';

/**
 * 玩家接口
 */
export interface PlayerData {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  avatar?: string;
}

/**
 * 玩家公开信息（含状态）
 */
export interface PlayerPublicInfo {
  id: string;
  name: string;
  avatar: string;
  handCount: number;
  isCurrentPlayer: boolean;
  isHost: boolean;
  status: 'active' | 'disconnected' | 'spectator';
}

/**
 * 玩家类
 */
export class Player {
  public readonly id: string;
  public readonly name: string;
  public readonly isHost: boolean;
  public readonly avatar: string;
  public isReady: boolean;
  public status: 'active' | 'disconnected' | 'spectator' = 'active';
  private hand: Card[] = [];
  public hasCalledUno: boolean = false;
  public disconnectTime?: number; // 断线时间戳

  constructor(data: PlayerData) {
    this.id = data.id;
    this.name = data.name;
    this.isHost = data.isHost;
    this.isReady = data.isReady;
    this.avatar = data.avatar || '😀';
  }

  /**
   * 抽牌
   */
  drawCard(deck: Deck, count: number = 1) {
    const drawn = deck.drawMultiple(count);
    this.hand.push(...drawn);
    // 抽牌后重置 UNO 状态
    this.hasCalledUno = false;
    return drawn;
  }

  /**
   * 出牌
   */
  playCard(cardIndex: number): Card | undefined {
    if (cardIndex < 0 || cardIndex >= this.hand.length) {
      return undefined;
    }
    const card = this.hand[cardIndex];
    this.hand.splice(cardIndex, 1);
    return card;
  }

  /**
   * 喊 UNO
   */
  callUno() {
    this.hasCalledUno = true;
  }

  /**
   * 检查是否需要罚抽（剩 1 张牌但未喊 UNO）
   */
  shouldPenaltyForNoUno(): boolean {
    return this.hand.length === 1 && !this.hasCalledUno;
  }

  /**
   * 手牌数量
   */
  handCount(): number {
    return this.hand.length;
  }

  /**
   * 获取手牌（仅自己可见完整信息）
   */
  getHand(): Card[] {
    return [...this.hand];
  }

  /**
   * 检查手牌是否有合法牌可出
   */
  hasValidPlay(topCard: Card, wildColor: string | null): boolean {
    return this.hand.some(card => {
      // 万能牌始终合法
      if (card.color === 'wild') {
        return true;
      }
      // 颜色匹配
      if (card.color === wildColor || card.color === topCard.color) {
        return true;
      }
      // 数字/类型匹配
      if (card.value === topCard.value && card.type === topCard.type) {
        return true;
      }
      return false;
    });
  }

  /**
   * 重置 UNO 状态（新回合开始）
   */
  resetUnoState() {
    this.hasCalledUno = false;
  }

  /**
   * 玩家公开信息（用于状态同步）
   */
  getPublicInfo(isCurrentPlayer: boolean): PlayerPublicInfo {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      handCount: this.hand.length,
      isCurrentPlayer,
      isHost: this.isHost,
      status: this.status
    };
  }

  /**
   * 设置为断线状态
   */
  setDisconnected() {
    this.status = 'disconnected';
    this.disconnectTime = Date.now();
  }

  /**
   * 设置为观战状态
   */
  setSpectator() {
    this.status = 'spectator';
  }

  /**
   * 恢复为活跃状态
   */
  setActive() {
    this.status = 'active';
    this.disconnectTime = undefined;
  }

  /**
   * 检查是否可以被移除（断线超过指定时间）
   */
  canRemove(timeoutMs: number): boolean {
    if (this.status === 'active') return false;
    if (!this.disconnectTime) return false;
    return Date.now() - this.disconnectTime > timeoutMs;
  }
}

/**
 * 生成玩家 ID（统一使用 idGenerator）
 */
export function generatePlayerId(): string {
  return genPlayerId();
}

/**
 * 生成随机玩家名称（统一使用 idGenerator）
 */
export function generatePlayerName(): string {
  return genName();
}
