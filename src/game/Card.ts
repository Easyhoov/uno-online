import { CardColor, CardType } from './enums';

// 重新导出枚举
export { CardColor, CardType };
export type { Direction } from './enums';

/**
 * UNO 卡牌接口
 */
export interface Card {
  id: string;
  color: CardColor;
  type: CardType;
  value?: number;
}

/**
 * 生成卡牌唯一 ID
 */
export function generateCardId(): string {
  return `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 创建数字牌
 */
export function createNumberCard(color: CardColor, value: number): Card {
  return {
    id: generateCardId(),
    color,
    type: CardType.NUMBER,
    value
  };
}

/**
 * 创建功能牌
 */
export function createActionCard(color: CardColor, type: CardType.SKIP | CardType.REVERSE | CardType.DRAW_TWO): Card {
  return {
    id: generateCardId(),
    color,
    type
  };
}

/**
 * 创建万能牌
 */
export function createWildCard(type: CardType.WILD | CardType.WILD_DRAW_FOUR): Card {
  return {
    id: generateCardId(),
    color: CardColor.WILD,
    type
  };
}

/**
 * 获取卡牌显示文本
 */
export function getCardDisplay(card: Card): string {
  if (card.type === CardType.NUMBER) {
    return card.value!.toString();
  }

  const SYMBOLS: Record<CardType, string> = {
    [CardType.NUMBER]: '',
    [CardType.SKIP]: '⊘',
    [CardType.REVERSE]: '⇄',
    [CardType.DRAW_TWO]: '+2',
    [CardType.WILD]: '🃏',
    [CardType.WILD_DRAW_FOUR]: '+4'
  };

  return SYMBOLS[card.type];
}

/**
 * 获取卡牌 CSS 类名
 */
export function getCardColorClass(color: CardColor): string {
  const CLASS_MAP: Record<CardColor, string> = {
    [CardColor.RED]: 'card-red',
    [CardColor.YELLOW]: 'card-yellow',
    [CardColor.GREEN]: 'card-green',
    [CardColor.BLUE]: 'card-blue',
    [CardColor.WILD]: 'card-wild'
  };

  return CLASS_MAP[color];
}

/**
 * 卡牌分值
 */
export function getCardValue(card: Card): number {
  if (card.type === CardType.NUMBER) {
    return card.value || 0;
  }

  const VALUES: Record<CardType, number> = {
    [CardType.NUMBER]: 0,
    [CardType.SKIP]: 20,
    [CardType.REVERSE]: 20,
    [CardType.DRAW_TWO]: 20,
    [CardType.WILD]: 50,
    [CardType.WILD_DRAW_FOUR]: 50
  };

  return VALUES[card.type];
}
