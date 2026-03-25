import type { Card } from './Card';
import { CardColor, CardType } from './enums';
import { createNumberCard, createActionCard, createWildCard } from './Card';

/**
 * UNO 牌堆类
 * 标准 UNO 牌组：108 张牌
 */
export class Deck {
  private cards: Card[] = [];

  constructor() {
    this.initialize();
  }

  /**
   * 初始化标准 UNO 牌组
   */
  private initialize() {
    this.cards = [];

    // 每种颜色
    [CardColor.RED, CardColor.YELLOW, CardColor.GREEN, CardColor.BLUE].forEach(color => {
      // 数字 0（每张颜色 1 张）
      this.cards.push(createNumberCard(color, 0));

      // 数字 1-9（每张颜色 2 张）
      for (let value = 1; value <= 9; value++) {
        this.cards.push(createNumberCard(color, value));
        this.cards.push(createNumberCard(color, value));
      }

      // 功能牌（Skip, Reverse, Draw Two，每张颜色 2 张）
      [CardType.SKIP, CardType.REVERSE, CardType.DRAW_TWO].forEach(type => {
        this.cards.push(createActionCard(color, type));
        this.cards.push(createActionCard(color, type));
      });
    });

    // 万能牌（黑色，各 4 张）
    for (let i = 0; i < 4; i++) {
      this.cards.push(createWildCard(CardType.WILD));
      this.cards.push(createWildCard(CardType.WILD_DRAW_FOUR));
    }
  }

  /**
   * 洗牌（Fisher-Yates 算法）
   */
  shuffle(seed?: number) {
    // 如果有种子，使用伪随机洗牌（用于回放）
    if (seed !== undefined) {
      this.seedShuffle(seed);
      return;
    }

    // 真随机洗牌
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * 伪随机洗牌（使用种子，用于回放验证）
   */
  private seedShuffle(seed: number) {
    const random = this.seededRandom(seed);
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * 种子随机数生成器
   */
  private seededRandom(seed: number) {
    return function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  /**
   * 抽牌
   */
  draw(): Card | undefined {
    return this.cards.pop();
  }

  /**
   * 抽多张牌
   */
  drawMultiple(count: number): Card[] {
    const drawn: Card[] = [];
    for (let i = 0; i < count; i++) {
      const card = this.draw();
      if (card) {
        drawn.push(card);
      }
    }
    return drawn;
  }

  /**
   * 把牌放回牌堆底部
   */
  putBack(card: Card) {
    this.cards.unshift(card);
  }

  /**
   * 剩余牌数
   */
  remaining(): number {
    return this.cards.length;
  }

  /**
   * 重置牌堆
   */
  reset() {
    this.initialize();
  }

  /**
   * 获取所有卡牌（用于调试）
   */
  getAllCards(): Card[] {
    return [...this.cards];
  }
}
