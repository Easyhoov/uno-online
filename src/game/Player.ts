import type { Card } from './Card';
import { Deck } from './Deck';

/**
 * 玩家接口
 */
export interface PlayerData {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
}

/**
 * 玩家类
 */
export class Player {
  public readonly id: string;
  public readonly name: string;
  public readonly isHost: boolean;
  public isReady: boolean;
  private hand: Card[] = [];
  public hasCalledUno: boolean = false;

  constructor(data: PlayerData) {
    this.id = data.id;
    this.name = data.name;
    this.isHost = data.isHost;
    this.isReady = data.isReady;
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
  getPublicInfo(isCurrentPlayer: boolean) {
    return {
      id: this.id,
      name: this.name,
      handCount: this.hand.length,
      isCurrentPlayer,
      isHost: this.isHost
    };
  }
}

/**
 * 生成玩家 ID
 */
export function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 生成随机玩家名称
 */
export function generatePlayerName(): string {
  const adjectives = ['勇敢的', '聪明的', '快乐的', '幸运的', '神秘的', '无敌的', '闪电', '火焰'];
  const nouns = ['玩家', '战士', '法师', '骑士', '猎人', '忍者', '侠客', '王者'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}
