/**
 * UNO 卡牌颜色枚举
 */
export enum CardColor {
  RED = 'red',
  YELLOW = 'yellow',
  GREEN = 'green',
  BLUE = 'blue',
  WILD = 'wild'
}

/**
 * UNO 卡牌类型枚举
 */
export enum CardType {
  NUMBER = 'number',
  SKIP = 'skip',
  REVERSE = 'reverse',
  DRAW_TWO = 'draw_two',
  WILD = 'wild',
  WILD_DRAW_FOUR = 'wild_draw_four'
}

/**
 * 游戏方向
 */
export type Direction = 1 | -1; // 1=顺时针，-1=逆时针

/**
 * 玩家角色
 */
export type PlayerRole = 'host' | 'client';
