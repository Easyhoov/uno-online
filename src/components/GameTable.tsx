import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { CardComponent } from './CardComponent';
import { ColorPicker } from './ColorPicker';
import { CardColor, CardType } from '../game/enums';
import { peerManager } from '../p2p/peerConnection';
import type { Card } from '../game/Card';
import type { GameEvent } from '../game/Game';

// 添加 CSS 动画样式
const challengeAnimation = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
`;

// 手牌排序：按颜色分组，颜色内按数字排序
const COLOR_ORDER: Record<string, number> = { red: 0, yellow: 1, green: 2, blue: 3, wild: 4 };
const TYPE_ORDER: Record<string, number> = { number: 0, skip: 1, reverse: 2, draw_two: 3, wild: 4, wild_draw_four: 5 };

function sortHand(hand: Card[]): { card: Card; originalIndex: number }[] {
  return hand
    .map((card, originalIndex) => ({ card, originalIndex }))
    .sort((a, b) => {
      const colorDiff = (COLOR_ORDER[a.card.color] ?? 5) - (COLOR_ORDER[b.card.color] ?? 5);
      if (colorDiff !== 0) return colorDiff;
      const typeDiff = (TYPE_ORDER[a.card.type] ?? 9) - (TYPE_ORDER[b.card.type] ?? 9);
      if (typeDiff !== 0) return typeDiff;
      return (a.card.value ?? 99) - (b.card.value ?? 99);
    });
}

// 判断出牌是否合法（客户端预判）
function isValidPlay(card: Card, topCard: Card, wildColor: string | null, drawStack: number): boolean {
  if (drawStack > 0) {
    return card.type === CardType.DRAW_TWO || card.type === CardType.WILD_DRAW_FOUR;
  }
  if (card.color === CardColor.WILD) return true;
  if (card.color === wildColor || card.color === topCard.color) return true;
  if (card.value !== undefined && card.value === topCard.value && card.type === topCard.type) return true;
  return false;
}

// 事件日志格式化
function formatEvent(evt: GameEvent): string {
  const name = evt.playerName || evt.playerId || '?';
  switch (evt.type) {
    case 'CARD_PLAYED': {
      const c = evt.card;
      const desc = c ? `${getCardColorCN(c.color)} ${getCardTypeCN(c)}` : '?';
      return `🃏 ${name} 出了 ${desc}`;
    }
    case 'CARD_DRAWN': return `📥 ${name} 抽了 ${evt.amount || 1} 张牌`;
    case 'PLAYER_PASSED': return `⏭️ ${name} 跳过`;
    case 'UNO_CALLED': return `📢 ${name} 喊了 UNO!`;
    case 'UNO_PENALTY': return `⚠️ ${name} 忘喊 UNO，罚抽 ${evt.amount} 张`;
    case 'PLAYER_SKIPPED': return `🚫 ${name} 被跳过`;
    case 'DIRECTION_REVERSED': return `🔄 方向反转`;
    case 'DRAW_STACK_INCREASED': return `💥 累积罚抽 +${evt.amount}`;
    case 'COLOR_CHANGED': return `🎨 颜色变为 ${getColorCN(evt.color)}`;
    case 'PLAYER_WON': return `🏆 ${name} 赢了！`;
    case 'DECK_RESHUFFLED': return `🔀 弃牌堆已洗回牌堆`;
    default: return '';
  }
}

function getCardColorCN(color: string): string {
  const m: Record<string, string> = { red: '红', yellow: '黄', green: '绿', blue: '蓝', wild: '万能' };
  return m[color] || color;
}

function getCardTypeCN(card: any): string {
  if (card.type === 'number') return String(card.value ?? '');
  const m: Record<string, string> = { skip: '⊘跳过', reverse: '⇄反转', draw_two: '+2', wild: '变色', wild_draw_four: '+4' };
  return m[card.type] || card.type;
}

function getColorCN(color?: string): string {
  const m: Record<string, string> = { red: '🔴红', yellow: '🟡黄', green: '🟢绿', blue: '🔵蓝' };
  return m[color || ''] || '?';
}

function getWildColorBackground(color: string): string {
  const m: Record<string, string> = { red: '#e94560', yellow: '#f5d300', green: '#00c96e', blue: '#00a8d4' };
  return m[color] || '#6b7280';
}

function getWildColorEmoji(color: string): string {
  const m: Record<string, string> = { red: '🔴', yellow: '🟡', green: '🟢', blue: '🔵' };
  return m[color] || '⚫';
}

/**
 * 游戏桌组件
 */
export const GameTable: React.FC = () => {
  const { gameState, myHand, room, showColorPicker, setShowColorPicker } = useGameStore();
  const [pendingCardIndex, setPendingCardIndex] = useState<number | null>(null);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(true);
  const [playingCards, setPlayingCards] = useState<Array<{ card: Card; id: string; fromX: number }>>([]);
  const animCounterRef = useRef(0); // 动画计数器 ref（避免触发重渲染）
  const logRef = useRef<HTMLDivElement>(null);
  const handRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  
  // 提前声明 myId，避免在 useEffect 中访问未声明的变量
  const myId = peerManager.getMyPeerId();

  // 注入 CSS 动画
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = challengeAnimation;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // 监听出牌事件，播放动画
  useEffect(() => {
    if (gameState?.lastEvents?.length) {
      const playEvent = gameState.lastEvents.find(e => e.type === 'CARD_PLAYED');
      if (playEvent && playEvent.card && playEvent.playerId === myId) {
        // 获取卡牌位置
        const cardIndex = myHand?.findIndex(c => c.id === playEvent.card!.id) || 0;
        const cardElement = handRefs.current.get(cardIndex);
        const fromX = cardElement ? cardElement.getBoundingClientRect().left : 0;
        
        // 添加动画卡牌（使用 ref 计数器确保 key 唯一，避免触发重渲染）
        animCounterRef.current += 1;
        const animId = `anim_${Date.now()}_${animCounterRef.current}`;
        setPlayingCards(prev => [...prev, { card: playEvent.card!, id: animId, fromX }]);
        
        // 动画结束后移除
        setTimeout(() => {
          setPlayingCards(prev => prev.filter(c => c.id !== animId));
        }, 600);
      }
    }
  }, [gameState?.lastEvents, myId, myHand]);

  // 监听抽牌事件，播放动画
  useEffect(() => {
    if (gameState?.lastEvents?.length) {
      const drawEvent = gameState.lastEvents.find(e => e.type === 'CARD_DRAWN');
      if (drawEvent && drawEvent.playerId === myId) {
        // 抽牌动画：从牌堆飞向手牌（使用 ref 计数器确保 key 唯一）
        animCounterRef.current += 1;
        const animId = `draw_anim_${Date.now()}_${animCounterRef.current}`;
        setPlayingCards(prev => [...prev, { card: drawEvent.card || myHand![0], id: animId, fromX: -200 }]);
        setTimeout(() => {
          setPlayingCards(prev => prev.filter(c => c.id !== animId));
        }, 600);
      }
    }
  }, [gameState?.lastEvents, myId, myHand]);

  // 监听 gameState 变化，更新事件日志
  useEffect(() => {
    if (gameState?.lastEvents?.length) {
      const newEntries = gameState.lastEvents.map(formatEvent).filter(Boolean);
      if (newEntries.length > 0) {
        setEventLog(prev => [...prev.slice(-30), ...newEntries]); // 保留最近 30+ 条
      }
    }
  }, [gameState?.lastEvents]);

  // 自动滚动日志
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [eventLog]);

  if (!gameState) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎴</div>
          <div style={{ fontSize: '1.5rem' }}>等待游戏开始...</div>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurnNow = currentPlayer?.id === myId;
  const hasDrawnThisTurn = gameState.hasDrawnThisTurn;
  const otherPlayers = gameState.players.filter(p => p.id !== myId);
  const sortedHand = myHand ? sortHand(myHand) : [];

  const handleCardClick = (originalIndex: number) => {
    if (!isMyTurnNow || !myHand) return;
    const card = myHand[originalIndex];
    if (!isValidPlay(card, gameState.topCard, gameState.wildColor, gameState.drawStack)) return;

    if (card.color === CardColor.WILD) {
      setPendingCardIndex(originalIndex);
      setShowColorPicker(true);
      return;
    }
    submitPlayCard(originalIndex);
  };

  const submitPlayCard = (cardIndex: number, declaredColor?: CardColor) => {
    const action = { type: 'PLAY_CARD' as const, playerId: myId!, cardIndex, declaredColor };
    if (room.isHost) {
      peerManager.hostAction(action);
    } else {
      peerManager.send({ type: 'ACTION', timestamp: new Date().getTime(), action });
    }
  };

  const handleDrawCard = () => {
    if (!isMyTurnNow) return;
    if (hasDrawnThisTurn && gameState.drawStack === 0) return; // 已抽过
    const action = { type: 'DRAW_CARD' as const, playerId: myId! };
    if (room.isHost) peerManager.hostAction(action);
    else peerManager.send({ type: 'ACTION', timestamp: Date.now(), action });
  };

  const handlePass = () => {
    if (!isMyTurnNow || !hasDrawnThisTurn) return;
    const action = { type: 'PASS' as const, playerId: myId! };
    if (room.isHost) peerManager.hostAction(action);
    else peerManager.send({ type: 'ACTION', timestamp: Date.now(), action });
  };

  const handleCallUno = () => {
    const action = { type: 'CALL_UNO' as const, playerId: myId! };
    if (room.isHost) peerManager.hostAction(action);
    else peerManager.send({ type: 'ACTION', timestamp: Date.now(), action });
  };

  const handleChallenge = () => {
    if (!gameState.canChallenge) return;
    const action = { type: 'CHALLENGE_WILD_FOUR' as const, playerId: myId!, targetPlayerId: gameState.challengeTarget };
    if (room.isHost) peerManager.hostAction(action);
    else peerManager.send({ type: 'ACTION', timestamp: Date.now(), action });
  };

  const handleColorSelect = (color: CardColor) => {
    if (pendingCardIndex !== null) {
      submitPlayCard(pendingCardIndex, color);
      setPendingCardIndex(null);
      setShowColorPicker(false);
    }
  };

  const handlePlayAgain = () => {
    // 回到房间大厅，保持 P2P 连接
    setEventLog([]);
    peerManager.returnToLobby();
  };

  // 胜利界面
  if (gameState.isGameOver && gameState.winnerId) {
    const winner = gameState.players.find(p => p.id === gameState.winnerId);
    const isMe = gameState.winnerId === myId;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', color: 'white' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>{isMe ? '🎉' : '😢'}</div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            {isMe ? '你赢了！' : `${winner?.name || '?'} 赢了！`}
          </h1>
          <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>{isMe ? '恭喜！你是 UNO 之王！' : '下次加油！'}</p>
          <button onClick={handlePlayAgain} style={{ padding: '1rem 2rem', background: '#e94560', borderRadius: '0.75rem', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.125rem' }}>
            🔄 再来一局
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}>
      {/* 顶部信息栏 */}
      <div style={{ padding: '0.5rem 1rem', background: 'rgba(22, 33, 62, 0.8)' }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>🎴 UNO</span>
            <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>房间 {room.roomId}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isMyTurnNow && (
              <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
                ▶ 你的回合{hasDrawnThisTurn ? '（已抽牌）' : ''}
              </span>
            )}
            <span style={{ fontSize: '1.125rem' }}>{gameState.direction === 1 ? '➡️' : '⬅️'}</span>
            {gameState.drawStack > 0 && (
              <span style={{ padding: '0.2rem 0.6rem', background: 'rgba(239, 68, 68, 0.3)', color: '#f87171', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 'bold' }}>
                累积 +{gameState.drawStack}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 主游戏区域 */}
      <div style={{ flex: 1, display: 'flex', gap: '0.5rem', padding: '0.5rem' }}>
        {/* 左侧：游戏区 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}>
          {/* 日志切换按钮（移动端友好） */}
          <button
            onClick={() => setShowLog(!showLog)}
            style={{
              position: 'absolute',
              top: '3.5rem',
              right: '1rem',
              padding: '0.4rem 0.75rem',
              background: showLog ? 'rgba(22, 33, 62, 0.9)' : 'rgba(233, 69, 96, 0.9)',
              borderRadius: '0.5rem',
              border: '1px solid #374151',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '0.75rem',
              cursor: 'pointer',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'all 0.2s',
            }}
            title={showLog ? '隐藏日志' : '显示日志'}
          >
            {showLog ? '📜 隐藏日志' : '📜 查看日志'}
          </button>
          {/* 其他玩家 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            {otherPlayers.map(player => <OpponentView key={player.id} player={player} />)}
          </div>

          {/* 中央牌堆 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
            {/* 抽牌堆 */}
            <div style={{ textAlign: 'center' }}>
              <div
                onClick={handleDrawCard}
                style={{
                  width: '4.5rem', height: '7rem',
                  background: 'linear-gradient(135deg, #374151, #1f2937)',
                  borderRadius: '0.625rem',
                  border: (isMyTurnNow && !hasDrawnThisTurn) ? '2px solid rgba(0, 212, 255, 0.5)' : '2px solid #4b5563',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: (isMyTurnNow && !hasDrawnThisTurn) ? '0 0 15px rgba(0, 212, 255, 0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
                  cursor: (isMyTurnNow && !hasDrawnThisTurn) ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#6b7280' }}>🂠</span>
              </div>
              <div style={{ marginTop: '0.375rem', fontSize: '0.7rem', color: '#6b7280' }}>
                {isMyTurnNow && !hasDrawnThisTurn ? '点击抽牌' : '抽牌堆'}
              </div>
            </div>

            {/* 弃牌堆 */}
            <div style={{ position: 'relative' }}>
              <CardComponent card={gameState.topCard} isPlayable={false} onClick={() => {}} />
              {gameState.wildColor && (
                <div style={{
                  position: 'absolute', top: '-1.5rem', left: '50%', transform: 'translateX(-50%)',
                  padding: '0.15rem 0.5rem', borderRadius: '0.75rem', fontSize: '0.65rem',
                  background: getWildColorBackground(gameState.wildColor), color: 'white', whiteSpace: 'nowrap'
                }}>
                  {getWildColorEmoji(gameState.wildColor)} 当前
                </div>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          {isMyTurnNow && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              {hasDrawnThisTurn && (
                <button onClick={handlePass} style={{
                  padding: '0.5rem 1.25rem', background: '#6b7280', borderRadius: '2rem',
                  border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.875rem'
                }}>
                  ⏭️ 跳过
                </button>
              )}
              {myHand && myHand.length <= 2 && (
                <button onClick={handleCallUno} style={{
                  padding: '0.5rem 1.25rem', background: '#f5d300', borderRadius: '2rem',
                  border: 'none', color: '#1a1a2e', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.875rem',
                  boxShadow: '0 0 12px rgba(245, 211, 0, 0.3)'
                }}>
                  📢 UNO!
                </button>
              )}
            </div>
          )}

          {/* +4 挑战按钮（非回合） */}
          {gameState.canChallenge && !isMyTurnNow && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
              <button onClick={handleChallenge} style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                borderRadius: '2rem',
                border: 'none',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '1rem',
                boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)',
                animation: 'pulse 1.5s infinite'
              }}>
                ⚠️ 挑战 +4（质疑作弊）
              </button>
            </div>
          )}

          {/* 手牌 */}
          <div style={{ width: '100%', maxWidth: '72rem', position: 'relative' }}>
            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>你的手牌（{myHand?.length || 0}）</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.2rem', flexWrap: 'wrap', padding: '0 0.5rem' }}>
              {sortedHand.map(({ card, originalIndex }, idx) => {
                const playable = isMyTurnNow && isValidPlay(card, gameState.topCard, gameState.wildColor, gameState.drawStack);
                return (
                  <div
                    key={card.id || originalIndex}
                    ref={el => {
                      if (el) handRefs.current.set(idx, el);
                      else handRefs.current.delete(idx);
                    }}
                  >
                    <CardComponent
                      card={card}
                      isPlayable={playable}
                      onClick={() => handleCardClick(originalIndex)}
                    />
                  </div>
                );
              })}
            </div>

            {/* 出牌动画 */}
            <AnimatePresence>
              {playingCards.map(({ card, id, fromX }) => (
                <motion.div
                  key={id}
                  initial={{ 
                    x: fromX - (typeof window !== 'undefined' ? window.innerWidth / 2 : 0) + 100,
                    y: 200,
                    scale: 1,
                    opacity: 1,
                    rotate: 0
                  }}
                  animate={{ 
                    x: 0,
                    y: -150,
                    scale: 0.6,
                    opacity: 0,
                    rotate: 180
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    pointerEvents: 'none',
                    zIndex: 1000
                  }}
                >
                  <CardComponent card={card} isPlayable={false} onClick={() => {}} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* 右侧：事件日志（可切换显示/隐藏） */}
        {showLog && (
          <div style={{
            width: '14rem', flexShrink: 0,
            background: 'rgba(22, 33, 62, 0.6)', borderRadius: '0.75rem',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #374151', fontSize: '0.8rem', fontWeight: 'bold', color: '#9ca3af' }}>
              📜 游戏日志
            </div>
            <div ref={logRef} style={{
              flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem',
              display: 'flex', flexDirection: 'column', gap: '0.25rem',
              fontSize: '0.7rem', color: '#d1d5db'
            }}>
              {eventLog.length === 0 && <div style={{ color: '#6b7280' }}>游戏开始...</div>}
              {eventLog.map((entry, i) => (
                <div key={i} style={{ lineHeight: 1.4 }}>{entry}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 颜色选择器 */}
      {showColorPicker && <ColorPicker onSelect={handleColorSelect} />}
    </div>
  );
};

/**
 * 对手视角
 */
const OpponentView: React.FC<{ player: any }> = ({ player }) => {
  const { room } = useGameStore();
  
  const handleKick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (room.isHost && confirm(`确定要踢出玩家 "${player.name}" 吗？`)) {
      peerManager.kickPlayer(player.id, '房主将你踢出房间');
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0.5rem 1rem', borderRadius: '0.625rem',
      background: player.isCurrentPlayer ? 'rgba(74, 222, 128, 0.12)' : 'rgba(255, 255, 255, 0.04)',
      border: player.isCurrentPlayer ? '1px solid rgba(74, 222, 128, 0.25)' : '1px solid transparent',
      transition: 'all 0.3s', minWidth: '5rem', position: 'relative'
    }}>
      <div style={{
        width: '2.5rem', height: '2.5rem', borderRadius: '50%',
        background: 'linear-gradient(135deg, #a855f7, #ec4899)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.25rem', marginBottom: '0.375rem'
      }}>{player.avatar || '😀'}</div>
      <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'white', marginBottom: '0.125rem' }}>
        {player.name} {player.isHost ? '👑' : ''}
      </div>
      <div style={{
        padding: '0.1rem 0.4rem', background: '#1a1a2e', borderRadius: '1rem',
        fontSize: '0.7rem', color: player.handCount <= 2 ? '#f87171' : '#9ca3af'
      }}>
        {player.handCount} 张
      </div>
      {player.isCurrentPlayer && <div style={{ marginTop: '0.2rem', fontSize: '0.6rem', color: '#4ade80' }}>出牌中</div>}
      
      {/* 房主踢人按钮 */}
      {room.isHost && !player.isHost && (
        <button
          onClick={handleKick}
          style={{
            position: 'absolute',
            top: '-0.25rem',
            right: '-0.25rem',
            width: '1.25rem',
            height: '1.25rem',
            borderRadius: '50%',
            background: '#ef4444',
            border: 'none',
            color: 'white',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}
          title="踢出玩家"
        >
          ✕
        </button>
      )}
    </div>
  );
};
