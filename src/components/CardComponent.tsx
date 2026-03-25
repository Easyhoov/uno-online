import React from 'react';
import type { Card } from '../game/Card';
import { getCardDisplay } from '../game/Card';
import { CardColor } from '../game/enums';

interface CardComponentProps {
  card: Card;
  isPlayable: boolean;
  onClick: () => void;
}

const COLOR_MAP: Record<string, string> = {
  [CardColor.RED]: '#e94560',
  [CardColor.YELLOW]: '#f5d300',
  [CardColor.GREEN]: '#00c96e',
  [CardColor.BLUE]: '#00a8d4',
  [CardColor.WILD]: 'linear-gradient(135deg, #e94560, #f5d300, #00c96e, #00a8d4)',
};

/**
 * 卡牌组件
 */
export const CardComponent: React.FC<CardComponentProps> = ({ card, isPlayable, onClick }) => {
  const isWild = card.color === CardColor.WILD;
  const bg = COLOR_MAP[card.color] || '#374151';
  const display = getCardDisplay(card);

  // 文字颜色：黄色牌用深色文字
  const textColor = card.color === CardColor.YELLOW ? '#1a1a2e' : 'white';

  return (
    <div
      onClick={isPlayable ? onClick : undefined}
      style={{
        width: '4.5rem',
        height: '7rem',
        borderRadius: '0.625rem',
        background: isWild ? bg : bg,
        boxShadow: isPlayable
          ? '0 0 12px rgba(255, 255, 255, 0.3), 0 4px 8px rgba(0,0,0,0.3)'
          : '0 2px 6px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: isPlayable ? 'pointer' : 'default',
        opacity: isPlayable ? 1 : 0.65,
        transition: 'transform 0.15s, box-shadow 0.15s',
        transform: isPlayable ? 'translateY(0)' : 'translateY(0)',
        border: isPlayable ? '2px solid rgba(255,255,255,0.4)' : '2px solid rgba(255,255,255,0.1)',
        userSelect: 'none',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (isPlayable) {
          e.currentTarget.style.transform = 'translateY(-8px) scale(1.05)';
          e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.5), 0 8px 16px rgba(0,0,0,0.4)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)';
        e.currentTarget.style.boxShadow = isPlayable
          ? '0 0 12px rgba(255, 255, 255, 0.3), 0 4px 8px rgba(0,0,0,0.3)'
          : '0 2px 6px rgba(0,0,0,0.3)';
      }}
    >
      {/* 左上 */}
      <span style={{
        position: 'absolute', top: '0.25rem', left: '0.375rem',
        fontSize: '0.625rem', fontWeight: 'bold', color: textColor
      }}>
        {display}
      </span>

      {/* 中央 */}
      <span style={{ fontSize: '1.75rem', fontWeight: 'bold', color: textColor }}>
        {display}
      </span>

      {/* 右下 */}
      <span style={{
        position: 'absolute', bottom: '0.25rem', right: '0.375rem',
        fontSize: '0.625rem', fontWeight: 'bold', color: textColor,
        transform: 'rotate(180deg)'
      }}>
        {display}
      </span>
    </div>
  );
};

/**
 * 卡牌背面
 */
export const CardBack: React.FC = () => (
  <div style={{
    width: '4.5rem', height: '7rem', borderRadius: '0.625rem',
    background: 'linear-gradient(135deg, #374151, #1f2937)',
    border: '2px solid #4b5563',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }}>
    <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#6b7280' }}>UNO</span>
  </div>
);
