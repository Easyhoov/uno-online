import type { Card } from './Card';
import { Deck } from './Deck';
import { Player, generatePlayerId } from './Player';
import { CardColor, CardType } from './enums';
import type { Direction } from './enums';

/**
 * 游戏动作类型
 */
export type ActionType =
  | 'PLAY_CARD'
  | 'DRAW_CARD'
  | 'PASS'          // 新增：抽牌后跳过
  | 'CALL_UNO'
  | 'CHALLENGE_WILD_FOUR'
  | 'SELECT_COLOR';

/**
 * 游戏动作接口
 */
export interface GameAction {
  type: ActionType;
  playerId: string;
  cardIndex?: number;
  declaredColor?: CardColor;
  targetPlayerId?: string;
}

/**
 * 游戏事件类型
 */
export type GameEventType =
  | 'CARD_PLAYED'
  | 'CARD_DRAWN'
  | 'PLAYER_PASSED'
  | 'UNO_CALLED'
  | 'UNO_PENALTY'
  | 'COLOR_CHANGED'
  | 'PLAYER_SKIPPED'
  | 'DIRECTION_REVERSED'
  | 'DRAW_STACK_INCREASED'
  | 'CHALLENGE_SUCCESS'
  | 'CHALLENGE_FAILED'
  | 'PLAYER_WON'
  | 'DECK_RESHUFFLED';

/**
 * 游戏事件接口
 */
export interface GameEvent {
  type: GameEventType;
  playerId?: string;
  playerName?: string;
  card?: Card;
  color?: CardColor;
  amount?: number;
  direction?: Direction;
}

/**
 * 出牌结果
 */
export interface PlayResult {
  valid: boolean;
  reason?: string;
  events: GameEvent[];
  gameState?: PublicGameState;
  gameOver: boolean;
  winnerId?: string;
}

/**
 * 公开游戏状态（所有玩家可见）
 */
export interface PublicGameState {
  players: Array<{
    id: string;
    name: string;
    avatar: string;
    handCount: number;
    isCurrentPlayer: boolean;
    isHost: boolean;
    status: 'active' | 'disconnected' | 'spectator';
  }>;
  currentPlayerIndex: number;
  topCard: Card;
  wildColor: CardColor | null;
  drawStack: number;
  direction: Direction;
  winnerId: string | null;
  isGameOver: boolean;
  lastEvents: GameEvent[];     // 最近的事件（用于 UI 展示日志）
  hasDrawnThisTurn: boolean;   // 当前玩家本回合是否已抽牌
  canChallenge: boolean;       // 当前玩家是否可以挑战 +4
  challengeTarget?: string;    // 被挑战的玩家 ID
  challengeWildColor?: CardColor | null; // +4 玩家声明的颜色（用于挑战验证）
}

/**
 * UNO 游戏核心类
 */
export class Game {
  public players: Player[] = [];
  public currentPlayerIndex: number = 0;
  public direction: Direction = 1;
  public drawStack: number = 0;
  public wildColor: CardColor | null = null;
  public isGameOver: boolean = false;
  public winnerId: string | null = null;

  private deck: Deck;
  private discardPile: Card[] = [];
  private pendingChallenge: { challengerId: string; targetId: string; wildColor: CardColor | null } | null = null;
  private lastEvents: GameEvent[] = [];
  private hasDrawnThisTurn: boolean = false;

  constructor() {
    this.deck = new Deck();
  }

  addPlayer(name: string, isHost: boolean = false, explicitId?: string, avatar?: string): Player {
    const player = new Player({
      id: explicitId || generatePlayerId(),
      name: name || `Player ${this.players.length + 1}`,
      isHost,
      isReady: true,
      avatar: avatar || '😀'
    });
    this.players.push(player);
    return player;
  }

  startGame(): boolean {
    if (this.players.length < 2) return false;

    this.deck = new Deck();
    this.deck.shuffle();
    this.discardPile = [];
    this.dealInitialCards();
    this.isGameOver = false;
    this.winnerId = null;
    this.currentPlayerIndex = 0;
    this.direction = 1;
    this.drawStack = 0;
    this.wildColor = null;
    this.lastEvents = [];
    this.hasDrawnThisTurn = false;

    // 确保第一张不是万能牌
    while (this.discardPile.length > 0 && this.discardPile[this.discardPile.length - 1].color === CardColor.WILD) {
      // 把万能牌塞回牌堆，再抽一张
      const wildCard = this.discardPile.pop()!;
      this.deck.putBack(wildCard);
      this.deck.shuffle();
      const newCard = this.deck.draw();
      if (newCard) this.discardPile.push(newCard);
    }

    // 设置初始颜色
    const topCard = this.discardPile[this.discardPile.length - 1];
    if (topCard) {
      this.wildColor = topCard.color;
      // 处理首张功能牌效果
      this.applyFirstCardEffect(topCard);
    }

    return true;
  }

  private dealInitialCards() {
    for (let i = 0; i < 7; i++) {
      this.players.forEach(player => {
        this.ensureDeckHasCards();
        player.drawCard(this.deck);
      });
    }
    this.discardPile.push(this.deck.draw()!);
  }

  /**
   * 确保牌堆有牌可抽（弃牌堆洗回去）
   */
  private ensureDeckHasCards() {
    if (this.deck.remaining() > 0) return;
    if (this.discardPile.length <= 1) return; // 至少保留顶牌

    const topCard = this.discardPile.pop()!;
    // 把剩余弃牌洗回牌堆
    while (this.discardPile.length > 0) {
      this.deck.putBack(this.discardPile.pop()!);
    }
    this.deck.shuffle();
    this.discardPile.push(topCard);
    this.lastEvents.push({ type: 'DECK_RESHUFFLED' });
  }

  /**
   * 处理第一张翻出牌的功能效果
   */
  private applyFirstCardEffect(card: Card) {
    switch (card.type) {
      case CardType.SKIP:
        this.nextTurn();
        break;
      case CardType.REVERSE:
        this.direction = -1 as Direction;
        if (this.players.length === 2) this.nextTurn();
        break;
      case CardType.DRAW_TWO:
        this.drawStack = 2;
        break;
    }
  }

  processAction(action: GameAction): PlayResult {
    const player = this.players.find(p => p.id === action.playerId);
    if (!player) {
      return { valid: false, reason: 'PLAYER_NOT_FOUND', events: [], gameOver: false };
    }

    if (this.isGameOver) {
      return { valid: false, reason: 'GAME_OVER', events: [], gameOver: true };
    }

    // CALL_UNO 不限制回合
    if (action.type === 'CALL_UNO') {
      return this.callUno(player);
    }

    // 其他动作必须是当前玩家
    if (this.players[this.currentPlayerIndex].id !== action.playerId) {
      return { valid: false, reason: 'NOT_YOUR_TURN', events: [], gameOver: false };
    }

    // 输入验证：检查 cardIndex 合法性
    if (action.type === 'PLAY_CARD') {
      if (action.cardIndex === undefined || action.cardIndex < 0 || action.cardIndex >= player.handCount()) {
        return { valid: false, reason: 'INVALID_CARD_INDEX', events: [], gameOver: false };
      }
      // 验证 declaredColor 对于万能牌是必需的
      const card = player.getHand()[action.cardIndex];
      if (card && card.color === CardColor.WILD && !action.declaredColor) {
        return { valid: false, reason: 'MUST_DECLARE_COLOR', events: [], gameOver: false };
      }
    }

    switch (action.type) {
      case 'PLAY_CARD':
        return this.playCard(player, action.cardIndex!, action.declaredColor);
      case 'DRAW_CARD':
        return this.drawCard(player);
      case 'PASS':
        return this.pass(player);
      case 'CHALLENGE_WILD_FOUR':
        return this.challengeWildFour(player);
      default:
        return { valid: false, reason: 'INVALID_ACTION', events: [], gameOver: false };
    }
  }

  private playCard(player: Player, cardIndex: number, declaredColor?: CardColor): PlayResult {
    const events: GameEvent[] = [];
    const card = player.getHand()[cardIndex];

    if (!card) {
      return { valid: false, reason: 'INVALID_CARD_INDEX', events: [], gameOver: false };
    }

    if (!this.isValidPlay(card)) {
      return { valid: false, reason: 'INVALID_CARD', events: [], gameOver: false };
    }

    // 出牌
    player.playCard(cardIndex);
    this.discardPile.push(card);
    events.push({ type: 'CARD_PLAYED', playerId: player.id, playerName: player.name, card });

    // UNO 惩罚：出牌后剩 1 张牌但未喊 UNO，罚抽 2 张
    const handAfterPlay = player.handCount();
    if (handAfterPlay === 1 && !player.hasCalledUno) {
      this.ensureDeckHasCards();
      player.drawCard(this.deck, 2);
      events.push({ type: 'UNO_PENALTY', playerId: player.id, playerName: player.name, amount: 2 });
    }

    // 万能牌颜色
    if (card.color === CardColor.WILD) {
      if (!declaredColor) {
        return { valid: false, reason: 'MUST_DECLARE_COLOR', events: [], gameOver: false };
      }
      this.wildColor = declaredColor;
      events.push({ type: 'COLOR_CHANGED', color: declaredColor });
    } else {
      this.wildColor = card.color;
    }

    // 重置抽牌状态
    this.hasDrawnThisTurn = false;

    // 处理卡牌效果（内含 nextTurn）
    this.applyCardEffect(card, events, player.id);

    // 检查胜利
    if (player.handCount() === 0) {
      this.isGameOver = true;
      this.winnerId = player.id;
      events.push({ type: 'PLAYER_WON', playerId: player.id, playerName: player.name });
      this.lastEvents = events;
      return { valid: true, events, gameState: this.getPublicState(), gameOver: true, winnerId: player.id };
    }

    player.resetUnoState();
    this.lastEvents = events;
    return { valid: true, events, gameState: this.getPublicState(), gameOver: false };
  }

  private isValidPlay(card: Card): boolean {
    const topCard = this.discardPile[this.discardPile.length - 1];

    // drawStack > 0 时只能出 +2 / +4 叠加
    if (this.drawStack > 0) {
      return card.type === CardType.DRAW_TWO || card.type === CardType.WILD_DRAW_FOUR;
    }

    if (card.color === CardColor.WILD) return true;
    if (card.color === this.wildColor || card.color === topCard.color) return true;
    if (card.value !== undefined && card.value === topCard.value && card.type === topCard.type) return true;
    return false;
  }

  private applyCardEffect(card: Card, events: GameEvent[], playerId: string) {
    switch (card.type) {
      case CardType.SKIP:
        this.nextTurn();
        events.push({ type: 'PLAYER_SKIPPED', playerId: this.getCurrentPlayerId(), playerName: this.getCurrentPlayerName() });
        this.nextTurn();
        break;

      case CardType.REVERSE:
        this.direction = (this.direction * -1) as 1 | -1;
        events.push({ type: 'DIRECTION_REVERSED', direction: this.direction });
        if (this.players.length === 2) {
          this.nextTurn();
          events.push({ type: 'PLAYER_SKIPPED', playerId: this.getCurrentPlayerId(), playerName: this.getCurrentPlayerName() });
          this.nextTurn();
        } else {
          this.nextTurn();
        }
        break;

      case CardType.DRAW_TWO:
        this.drawStack += 2;
        events.push({ type: 'DRAW_STACK_INCREASED', amount: this.drawStack });
        this.nextTurn();
        break;

      case CardType.WILD_DRAW_FOUR: {
        this.drawStack += 4;
        events.push({ type: 'DRAW_STACK_INCREASED', amount: this.drawStack });
        
        // 设置挑战状态：下一个玩家可以挑战
        const nextPlayerIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
        this.pendingChallenge = {
          challengerId: this.players[nextPlayerIndex].id,
          targetId: playerId,
          wildColor: this.wildColor // 记录 +4 玩家声明的颜色
        };
        
        this.nextTurn();
        break;
      }

      default:
        this.nextTurn();
        break;
    }
  }

  private drawCard(player: Player): PlayResult {
    const events: GameEvent[] = [];

    // 已经抽过牌了，不能再抽
    if (this.hasDrawnThisTurn && this.drawStack === 0) {
      return { valid: false, reason: 'ALREADY_DRAWN', events: [], gameOver: false };
    }

    this.ensureDeckHasCards();

    if (this.drawStack > 0) {
      const count = this.drawStack;
      for (let i = 0; i < count; i++) {
        this.ensureDeckHasCards();
        player.drawCard(this.deck, 1);
      }
      events.push({ type: 'CARD_DRAWN', playerId: player.id, playerName: player.name, amount: count });
      this.drawStack = 0;
      this.hasDrawnThisTurn = false;
      this.nextTurn();
    } else {
      player.drawCard(this.deck, 1);
      events.push({ type: 'CARD_DRAWN', playerId: player.id, playerName: player.name, amount: 1 });
      this.hasDrawnThisTurn = true;
      // 不自动 nextTurn，让玩家选择出牌或 pass
    }

    this.lastEvents = events;
    return { valid: true, events, gameState: this.getPublicState(), gameOver: false };
  }

  /**
   * 跳过（抽牌后不出牌）
   */
  private pass(player: Player): PlayResult {
    if (!this.hasDrawnThisTurn) {
      return { valid: false, reason: 'MUST_DRAW_FIRST', events: [], gameOver: false };
    }

    const events: GameEvent[] = [];
    events.push({ type: 'PLAYER_PASSED', playerId: player.id, playerName: player.name });
    this.hasDrawnThisTurn = false;
    this.nextTurn();
    this.lastEvents = events;
    return { valid: true, events, gameState: this.getPublicState(), gameOver: false };
  }

  private callUno(player: Player): PlayResult {
    player.callUno();
    const events: GameEvent[] = [{ type: 'UNO_CALLED', playerId: player.id, playerName: player.name }];
    this.lastEvents = events;
    return { valid: true, events, gameOver: false };
  }

  private challengeWildFour(challenger: Player): PlayResult {
    if (!this.pendingChallenge) {
      return { valid: false, reason: 'NO_PENDING_CHALLENGE', events: [], gameOver: false };
    }

    const targetPlayer = this.players.find(p => p.id === this.pendingChallenge!.targetId);
    if (!targetPlayer) {
      return { valid: false, reason: 'TARGET_NOT_FOUND', events: [], gameOver: false };
    }

    const events: GameEvent[] = [];
    const topCard = this.discardPile[this.discardPile.length - 1];
    // 挑战验证：检查出 +4 的玩家当时是否有同色牌可出（使用记录的 wildColor）
    const hasValidCard = targetPlayer.hasValidPlay(topCard, this.pendingChallenge.wildColor);

    if (hasValidCard) {
      // 挑战成功：出 +4 的玩家有合法牌，罚抽 6 张
      this.ensureDeckHasCards();
      targetPlayer.drawCard(this.deck, 6);
      events.push({ type: 'CHALLENGE_SUCCESS', playerId: challenger.id, playerName: challenger.name });
      this.nextTurn();
    } else {
      // 挑战失败：挑战者罚抽 4 张
      this.ensureDeckHasCards();
      challenger.drawCard(this.deck, 4);
      events.push({ type: 'CHALLENGE_FAILED', playerId: challenger.id, playerName: challenger.name });
      this.nextTurn();
    }

    this.pendingChallenge = null;
    this.lastEvents = events;
    return { valid: true, events, gameState: this.getPublicState(), gameOver: false };
  }

  private nextTurn() {
    this.hasDrawnThisTurn = false;
    
    // 跳过 spectator 玩家，找到下一个活跃玩家
    let attempts = 0;
    do {
      let nextIndex = this.currentPlayerIndex + this.direction;
      if (nextIndex < 0) nextIndex = this.players.length - 1;
      else if (nextIndex >= this.players.length) nextIndex = 0;
      this.currentPlayerIndex = nextIndex;
      attempts++;
      
      // 防止无限循环（所有玩家都是 spectator）
      if (attempts >= this.players.length) {
        console.warn('[Game] All players are spectators, resetting to first player');
        this.currentPlayerIndex = 0;
        break;
      }
    } while (this.players[this.currentPlayerIndex].status === 'spectator');
  }

  private getCurrentPlayerId(): string {
    return this.players[this.currentPlayerIndex].id;
  }

  private getCurrentPlayerName(): string {
    return this.players[this.currentPlayerIndex].name;
  }

  getPublicState(): PublicGameState {
    const currentPlayer = this.players[this.currentPlayerIndex];
    const canChallenge = this.pendingChallenge !== null && 
                         this.pendingChallenge.challengerId === currentPlayer?.id;
    
    return {
      players: this.players.map((p, i) => p.getPublicInfo(i === this.currentPlayerIndex)),
      currentPlayerIndex: this.currentPlayerIndex,
      topCard: this.discardPile[this.discardPile.length - 1],
      wildColor: this.wildColor,
      drawStack: this.drawStack,
      direction: this.direction,
      winnerId: this.winnerId,
      isGameOver: this.isGameOver,
      lastEvents: this.lastEvents,
      hasDrawnThisTurn: this.hasDrawnThisTurn,
      canChallenge: canChallenge,
      challengeTarget: this.pendingChallenge?.targetId,
      challengeWildColor: this.pendingChallenge?.wildColor,
    };
  }

  getPlayerHand(playerId: string): Card[] | null {
    const player = this.players.find(p => p.id === playerId);
    return player ? player.getHand() : null;
  }

  reset() {
    this.players = [];
    this.deck = new Deck();
    this.discardPile = [];
    this.currentPlayerIndex = 0;
    this.direction = 1;
    this.drawStack = 0;
    this.wildColor = null;
    this.isGameOver = false;
    this.winnerId = null;
    this.pendingChallenge = null;
    this.lastEvents = [];
    this.hasDrawnThisTurn = false;
  }

  /**
   * 序列化游戏状态（用于房主转移）
   */
  serialize(): string {
    return JSON.stringify({
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isReady: p.isReady,
        avatar: p.avatar,
        hand: p.getHand(),
        hasCalledUno: p.hasCalledUno
      })),
      currentPlayerIndex: this.currentPlayerIndex,
      direction: this.direction,
      drawStack: this.drawStack,
      wildColor: this.wildColor,
      isGameOver: this.isGameOver,
      winnerId: this.winnerId,
      discardPile: this.discardPile,
      pendingChallenge: this.pendingChallenge,
      lastEvents: this.lastEvents,
      hasDrawnThisTurn: this.hasDrawnThisTurn
    });
  }

  /**
   * 反序列化游戏状态（用于房主转移）
   */
  static deserialize(data: string): Game {
    const state = JSON.parse(data) as {
      players: Array<{
        id: string;
        name: string;
        isHost: boolean;
        isReady: boolean;
        avatar: string;
        hand: any[];
        hasCalledUno: boolean;
      }>;
      currentPlayerIndex: number;
      direction: number;
      drawStack: number;
      wildColor: string | null;
      isGameOver: boolean;
      winnerId: string | null;
      discardPile: any[];
      pendingChallenge: any;
      lastEvents: any[];
      hasDrawnThisTurn: boolean;
    };
    const game = new Game();
    
    // 恢复玩家
    state.players.forEach((p: { id: string; name: string; isHost: boolean; isReady: boolean; avatar: string; hand: any[]; hasCalledUno: boolean }) => {
      const player = new Player({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isReady: p.isReady,
        avatar: p.avatar
      });
      // 恢复手牌
      (player as unknown as { hand: any[] }).hand = p.hand;
      (player as unknown as { hasCalledUno: boolean }).hasCalledUno = p.hasCalledUno;
      game.players.push(player);
    });
    
    game.currentPlayerIndex = state.currentPlayerIndex;
    game.direction = state.direction;
    game.drawStack = state.drawStack;
    game.wildColor = state.wildColor;
    game.isGameOver = state.isGameOver;
    game.winnerId = state.winnerId;
    game.discardPile = state.discardPile;
    game.pendingChallenge = state.pendingChallenge;
    game.lastEvents = state.lastEvents;
    game.hasDrawnThisTurn = state.hasDrawnThisTurn;
    
    return game;
  }
}
