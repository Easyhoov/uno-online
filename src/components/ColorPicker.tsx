import React from 'react';
import { CardColor } from '../game/enums';
import { useGameStore } from '../store/gameStore';

interface ColorPickerProps {
  onSelect?: (color: CardColor) => void;
}

const COLORS = [
  { color: CardColor.RED, bg: '#e94560', emoji: '🔴', label: '红' },
  { color: CardColor.YELLOW, bg: '#f5d300', emoji: '🟡', label: '黄' },
  { color: CardColor.GREEN, bg: '#00c96e', emoji: '🟢', label: '绿' },
  { color: CardColor.BLUE, bg: '#00a8d4', emoji: '🔵', label: '蓝' }
];

/**
 * 颜色选择器（万能牌用）
 */
export const ColorPicker: React.FC<ColorPickerProps> = ({ onSelect }) => {
  const { setShowColorPicker } = useGameStore();

  const handleSelect = (color: CardColor) => {
    onSelect?.(color);
    setShowColorPicker(false);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
      }}
      onClick={() => setShowColorPicker(false)}
    >
      <div
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem',
          padding: '1.5rem', background: '#16213e', borderRadius: '1rem',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5)', border: '1px solid #374151'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ gridColumn: 'span 2', textAlign: 'center', fontSize: '1.125rem', fontWeight: 'bold', color: 'white', margin: '0 0 0.5rem 0' }}>
          选择颜色
        </h3>
        {COLORS.map(({ color, bg, emoji, label }) => (
          <button
            key={color}
            onClick={() => handleSelect(color)}
            style={{
              width: '5rem', height: '5rem', borderRadius: '0.75rem',
              background: bg, border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.75rem', transition: 'transform 0.15s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {emoji}
            <span style={{ fontSize: '0.625rem', color: 'white', marginTop: '0.25rem' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
