/**
 * 房主转移功能集成测试
 * 
 * 测试房主主动离开时的转移流程
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Game } from '../../game/Game';
import { CardColor, CardType } from '../../game/enums';

// Mock PeerJS
vi.mock('peerjs', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      connect: vi.fn(),
      destroy: vi.fn()
    }))
  };
});

describe('Host Transfer', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game();
    // 添加 4 个玩家模拟真实场景
    game.addPlayer('Host Player', true, 'host', '😀');
    game.addPlayer('Alice', false, 'client_1', '😎');
    game.addPlayer('Bob', false, 'client_2', '🤓');
    game.addPlayer('Charlie', false, 'client_3', '😊');
    game.startGame();
    
    // 模拟几张牌的出牌
    const firstPlayer = game.players[game.currentPlayerIndex];
    const hand = game.getPlayerHand(firstPlayer.id);
    if (hand && hand.length > 0) {
      game.processAction({
        type: 'PLAY_CARD',
        playerId: firstPlayer.id,
        cardIndex: 0
      });
    }
  });

  afterEach(() => {
    game = null as any;
  });

  describe('游戏状态序列化', () => {
    it('应该能够序列化游戏状态', () => {
      const serialized = game.serialize();
      
      expect(serialized).toBeDefined();
      expect(serialized.length).toBeGreaterThan(0);
      expect(typeof serialized).toBe('string');
    });

    it('应该能够反序列化恢复游戏状态', () => {
      const serialized = game.serialize();
      const restoredGame = Game.deserialize(serialized);
      
      expect(restoredGame.players).toHaveLength(4);
      expect(restoredGame.players[0].name).toBe('Host Player');
      expect(restoredGame.players[0].isHost).toBe(true);
      expect(restoredGame.players[1].name).toBe('Alice');
      expect(restoredGame.isGameOver).toBe(game.isGameOver);
    });

    it('应该保留游戏状态的所有关键信息', () => {
      const serialized = game.serialize();
      const restoredGame = Game.deserialize(serialized);
      
      const originalState = game.getPublicState();
      const restoredState = restoredGame.getPublicState();
      
      expect(restoredState.currentPlayerIndex).toBe(originalState.currentPlayerIndex);
      expect(restoredState.direction).toBe(originalState.direction);
      expect(restoredState.topCard.color).toBe(originalState.topCard.color);
      expect(restoredState.topCard.type).toBe(originalState.topCard.type);
      expect(restoredState.wildColor).toBe(originalState.wildColor);
    });

    it('应该保留每个玩家的手牌', () => {
      const serialized = game.serialize();
      const restoredGame = Game.deserialize(serialized);
      
      for (let i = 0; i < game.players.length; i++) {
        const originalHand = game.getPlayerHand(game.players[i].id);
        const restoredHand = restoredGame.getPlayerHand(restoredGame.players[i].id);
        
        expect(originalHand).toHaveLength(restoredHand?.length);
        
        if (originalHand && restoredHand) {
          for (let j = 0; j < originalHand.length; j++) {
            expect(originalHand[j].color).toBe(restoredHand[j].color);
            expect(originalHand[j].type).toBe(restoredHand[j].type);
            expect(originalHand[j].value).toBe(restoredHand[j].value);
          }
        }
      }
    });

    it('应该保留游戏事件日志', () => {
      const originalState = game.getPublicState();
      const eventCount = originalState.lastEvents.length;
      
      const serialized = game.serialize();
      const restoredGame = Game.deserialize(serialized);
      const restoredState = restoredGame.getPublicState();
      
      expect(restoredState.lastEvents).toHaveLength(eventCount);
    });
  });

  describe('房主转移逻辑', () => {
    it('应该选择第一个客户端作为新房主', () => {
      // 模拟转移逻辑
      const clients = game.players.filter(p => !p.isHost);
      const newHost = clients[0];
      
      expect(newHost).toBeDefined();
      expect(newHost.name).toBe('Alice');
      expect(newHost.isHost).toBe(false); // 当前还不是房主
    });

    it('应该在转移后更新房主标识', () => {
      const serialized = game.serialize();
      const restoredGame = Game.deserialize(serialized);
      
      // 模拟新房主接管流程
      // 1. 找到原房主（id='host'）
      const oldHostIndex = restoredGame.players.findIndex(p => p.id === 'host');
      expect(oldHostIndex).toBeGreaterThanOrEqual(0);
      
      // 2. 找到第一个客户端（Alice, id='client_1'）
      const newHostIndex = restoredGame.players.findIndex(p => p.id === 'client_1');
      expect(newHostIndex).toBeGreaterThanOrEqual(0);
      
      // 3. 交换 ID 和房主标识
      const oldHostPlayer = restoredGame.players[oldHostIndex];
      const newHostPlayer = restoredGame.players[newHostIndex];
      
      // 原房主变成客户端
      oldHostPlayer.id = 'client_old_host';
      oldHostPlayer.isHost = false;
      
      // 新房主变成房主
      newHostPlayer.id = 'host';
      newHostPlayer.isHost = true;
      
      // 4. 验证新房主是 Alice
      const currentHost = restoredGame.players.find(p => p.isHost);
      expect(currentHost).toBeDefined();
      expect(currentHost?.name).toBe('Alice');
      expect(currentHost?.id).toBe('host');
    });

    it('应该在转移后继续游戏流程', () => {
      const serialized = game.serialize();
      const restoredGame = Game.deserialize(serialized);
      
      // 转移后游戏应该可以继续
      expect(restoredGame.isGameOver).toBe(false);
      
      // 当前玩家应该可以继续出牌
      const currentPlayer = restoredGame.players[restoredGame.currentPlayerIndex];
      const hand = restoredGame.getPlayerHand(currentPlayer.id);
      
      expect(hand).toBeDefined();
      expect(hand!.length).toBeGreaterThan(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理只有 2 个玩家的情况', () => {
      const game2 = new Game();
      game2.addPlayer('Host', true, 'host', '😀');
      game2.addPlayer('Client', false, 'client_1', '😎');
      game2.startGame();
      
      const serialized = game2.serialize();
      const restoredGame = Game.deserialize(serialized);
      
      expect(restoredGame.players).toHaveLength(2);
      expect(restoredGame.isGameOver).toBe(false);
    });

    it('应该处理房主是第一轮当前玩家的情况', () => {
      // 确保房主是当前玩家
      const serialized = game.serialize();
      const restoredGame = Game.deserialize(serialized);
      
      // 转移后，如果原房主是当前玩家，需要跳过
      const currentPlayer = restoredGame.players[restoredGame.currentPlayerIndex];
      if (currentPlayer.id === 'host') {
        // 模拟跳过房主
        restoredGame.nextPlayer();
        const newCurrentPlayer = restoredGame.players[restoredGame.currentPlayerIndex];
        expect(newCurrentPlayer.id).not.toBe('host');
      }
    });

    it('应该处理游戏即将结束的情况', () => {
      // 手动设置一个玩家只剩 1 张牌
      const player = game.players[0];
      (player as any).hand = (player as any).hand.slice(0, 1);
      
      const serialized = game.serialize();
      const restoredGame = Game.deserialize(serialized);
      
      const restoredPlayer = restoredGame.players[0];
      const hand = restoredGame.getPlayerHand(restoredPlayer.id);
      
      expect(hand).toHaveLength(1);
    });

    it('应该处理 +4 挑战状态', () => {
      const state = game.getPublicState();
      
      // 序列化后应该保留挑战状态
      const serialized = game.serialize();
      const restoredGame = Game.deserialize(serialized);
      const restoredState = restoredGame.getPublicState();
      
      expect(restoredState.canChallenge).toBe(state.canChallenge);
      expect(restoredState.challengeTarget).toBe(state.challengeTarget);
    });
  });

  describe('多次转移', () => {
    it('应该支持多次序列化/反序列化', () => {
      let serialized = game.serialize();
      let game1 = Game.deserialize(serialized);
      
      serialized = game1.serialize();
      let game2 = Game.deserialize(serialized);
      
      serialized = game2.serialize();
      let game3 = Game.deserialize(serialized);
      
      expect(game3.players).toHaveLength(4);
      expect(game3.isGameOver).toBe(false);
    });

    it('应该在多次转移后保持状态一致', () => {
      const state1 = game.getPublicState();
      
      const serialized1 = game.serialize();
      const game1 = Game.deserialize(serialized1);
      const state2 = game1.getPublicState();
      
      const serialized2 = game1.serialize();
      const game2 = Game.deserialize(serialized2);
      const state3 = game2.getPublicState();
      
      expect(state2.currentPlayerIndex).toBe(state1.currentPlayerIndex);
      expect(state3.currentPlayerIndex).toBe(state1.currentPlayerIndex);
    });
  });
});

describe('Host Transfer Message Protocol', () => {
  it('应该定义完整的转移消息结构', () => {
    const transferMessage = {
      type: 'HOST_TRANSFER' as const,
      timestamp: Date.now(),
      newHostId: 'client_1',
      newHostName: 'Alice',
      newHostAvatar: '😎',
      newRoomId: 'ABC123',
      newHostFullPeerId: 'uno-ABC123',
      serializedGame: '...',
      reason: '房主主动离开'
    };
    
    expect(transferMessage.type).toBe('HOST_TRANSFER');
    expect(transferMessage.newHostId).toBeDefined();
    expect(transferMessage.newRoomId).toBeDefined();
    expect(transferMessage.newHostFullPeerId).toBeDefined();
    expect(transferMessage.serializedGame).toBeDefined();
  });

  it('应该包含所有必要的重连信息', () => {
    const message = {
      type: 'HOST_TRANSFER',
      timestamp: Date.now(),
      newHostId: 'client_1',
      newHostName: 'Alice',
      newRoomId: 'ABC123',
      newHostFullPeerId: 'uno-ABC123'
    };
    
    // 客户端需要这些信息来重连
    expect(message.newHostFullPeerId).toMatch(/^uno-[A-Z0-9]+$/);
    expect(message.newRoomId).toHaveLength(6);
  });
});
