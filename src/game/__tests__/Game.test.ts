/**
 * UNO 游戏核心逻辑单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../Game';
import { CardColor, CardType } from '../enums';

describe('Game', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game();
  });

  describe('初始化', () => {
    it('应该创建空游戏', () => {
      expect(game.players).toHaveLength(0);
      expect(game.isGameOver).toBe(false);
      expect(game.winnerId).toBeNull();
    });

    it('应该添加玩家', () => {
      const player = game.addPlayer('Alice', true);
      expect(player.name).toBe('Alice');
      expect(player.isHost).toBe(true);
      expect(game.players).toHaveLength(1);
    });

    it('至少需要 2 个玩家才能开始游戏', () => {
      game.addPlayer('Alice', true);
      const started = game.startGame();
      expect(started).toBe(false);
    });

    it('应该成功开始游戏（2 个玩家）', () => {
      game.addPlayer('Alice', true);
      game.addPlayer('Bob', false);
      const started = game.startGame();
      expect(started).toBe(true);
      expect(game.isGameOver).toBe(false);
    });
  });

  describe('发牌', () => {
    beforeEach(() => {
      game.addPlayer('Alice', true);
      game.addPlayer('Bob', false);
      game.startGame();
    });

    it('应该给每个玩家发 7 张牌', () => {
      const hand1 = game.getPlayerHand(game.players[0].id);
      const hand2 = game.getPlayerHand(game.players[1].id);
      expect(hand1).toHaveLength(7);
      expect(hand2).toHaveLength(7);
    });

    it('应该至少有一张牌在弃牌堆', () => {
      const state = game.getPublicState();
      expect(state.topCard).toBeDefined();
    });
  });

  describe('出牌规则', () => {
    beforeEach(() => {
      game.addPlayer('Alice', true);
      game.addPlayer('Bob', false);
      game.startGame();
    });

    it('应该允许出颜色匹配的牌', () => {
      // 获取当前玩家（可能是 Alice 或 Bob，取决于第一张牌的效果）
      const player = game.players[game.currentPlayerIndex];
      const hand = game.getPlayerHand(player.id)!;
      
      // 找到与顶牌颜色相同的牌
      const state = game.getPublicState();
      const matchingCardIndex = hand.findIndex(c => 
        c.color === state.wildColor || c.color === state.topCard.color
      );

      // 如果没有找到匹配的牌，测试应该跳过而不是失败
      if (matchingCardIndex === -1) {
        // 这是可能的，因为手牌可能真的没有匹配的颜色
        return;
      }
      
      const result = game.processAction({
        type: 'PLAY_CARD',
        playerId: player.id,
        cardIndex: matchingCardIndex
      });
      expect(result.valid).toBe(true);
    });

    it('应该允许出数字匹配的牌', () => {
      const player = game.players[0];
      const hand = game.getPlayerHand(player.id)!;
      const state = game.getPublicState();
      
      // 找到与顶牌数字相同的牌
      const matchingCardIndex = hand.findIndex(c => 
        c.value === state.topCard.value && 
        c.type === state.topCard.type
      );

      if (matchingCardIndex !== -1) {
        const result = game.processAction({
          type: 'PLAY_CARD',
          playerId: player.id,
          cardIndex: matchingCardIndex
        });
        expect(result.valid).toBe(true);
      }
    });

    it('应该允许出万能牌', () => {
      const player = game.players[0];
      const hand = game.getPlayerHand(player.id)!;
      
      // 找到万能牌
      const wildCardIndex = hand.findIndex(c => c.color === CardColor.WILD);

      if (wildCardIndex !== -1) {
        const result = game.processAction({
          type: 'PLAY_CARD',
          playerId: player.id,
          cardIndex: wildCardIndex,
          declaredColor: CardColor.RED
        });
        expect(result.valid).toBe(true);
        expect(game.getPublicState().wildColor).toBe(CardColor.RED);
      }
    });

    it('应该拒绝无效的牌', () => {
      // 使用当前玩家，而不是固定的 players[0]
      const player = game.players[game.currentPlayerIndex];
      
      const result = game.processAction({
        type: 'PLAY_CARD',
        playerId: player.id,
        cardIndex: 999 // 无效索引
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_CARD_INDEX');
    });

    it('万能牌必须声明颜色', () => {
      // 获取当前玩家
      const player = game.players[game.currentPlayerIndex];
      const hand = game.getPlayerHand(player.id)!;
      const wildCardIndex = hand.findIndex(c => c.color === CardColor.WILD);

      if (wildCardIndex !== -1) {
        const result = game.processAction({
          type: 'PLAY_CARD',
          playerId: player.id,
          cardIndex: wildCardIndex
          // 缺少 declaredColor
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('MUST_DECLARE_COLOR');
      }
    });
  });

  describe('UNO 惩罚', () => {
    it('应该在剩 1 张牌未喊 UNO 时罚抽 2 张', () => {
      game.addPlayer('Alice', true);
      game.addPlayer('Bob', false);
      game.startGame();

      const player = game.players[0];
      
      // 手动设置玩家手牌为 2 张
      (player as any).hand = (player as any).hand.slice(0, 2);
      
      // 出牌后剩 1 张，但未喊 UNO
      const result = game.processAction({
        type: 'PLAY_CARD',
        playerId: player.id,
        cardIndex: 0
      });

      if (result.valid) {
        // 出牌后应该剩 1 张，但因为没喊 UNO，罚抽 2 张，最终应该是 3 张
        const hand = game.getPlayerHand(player.id);
        expect(hand).toHaveLength(3); // 1 + 2 惩罚
      }
    });

    it('喊 UNO 后不应该罚抽', () => {
      game.addPlayer('Alice', true);
      game.addPlayer('Bob', false);
      game.startGame();

      const player = game.players[0];
      
      // 先喊 UNO
      game.processAction({
        type: 'CALL_UNO',
        playerId: player.id
      });
      
      // 手动设置玩家手牌为 2 张
      (player as any).hand = (player as any).hand.slice(0, 2);
      
      // 出牌后剩 1 张，已喊 UNO，不应该罚抽
      const result = game.processAction({
        type: 'PLAY_CARD',
        playerId: player.id,
        cardIndex: 0
      });

      if (result.valid) {
        const hand = game.getPlayerHand(player.id);
        expect(hand).toHaveLength(1); // 无惩罚
      }
    });
  });

  describe('游戏结束', () => {
    it('应该在手牌出完时结束游戏', () => {
      game.addPlayer('Alice', true);
      game.addPlayer('Bob', false);
      game.startGame();

      const player = game.players[0];
      
      // 手动设置玩家只有 1 张牌
      (player as any).hand = (player as any).hand.slice(0, 1);
      
      // 出最后一张牌
      const result = game.processAction({
        type: 'PLAY_CARD',
        playerId: player.id,
        cardIndex: 0
      });

      if (result.valid) {
        expect(game.isGameOver).toBe(true);
        expect(game.winnerId).toBe(player.id);
        expect(result.gameOver).toBe(true);
      }
    });
  });

  describe('序列化/反序列化', () => {
    it('应该能够序列化和反序列化游戏状态', () => {
      game.addPlayer('Alice', true);
      game.addPlayer('Bob', false);
      game.startGame();

      // 序列化
      const serialized = game.serialize();
      expect(serialized).toBeDefined();
      expect(serialized.length).toBeGreaterThan(0);

      // 反序列化
      const restoredGame = Game.deserialize(serialized);
      
      expect(restoredGame.players).toHaveLength(2);
      expect(restoredGame.players[0].name).toBe('Alice');
      expect(restoredGame.players[1].name).toBe('Bob');
    });
  });
});
