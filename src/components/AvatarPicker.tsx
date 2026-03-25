import React, { useState } from 'react';

/**
 * 可用头像 emoji 列表（按类别分组）
 */
const AVATAR_EMOJIS = [
  // 人物
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗',
  '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫',
  '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒',
  
  // 动物
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
  '🐧', '🐦', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗',
  
  // 食物
  '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓',
  '🍒', '🍑', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆',
  '🥔', '🥕', '🌽', '🌶️', '🥒', '🥬', '🥦', '🍄',
  
  // 运动
  '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱',
  '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥊', '🥋',
  '🎿', '🏂', '⛷️', '🏋️', '🤸', '🤼', '🤽', '🤾',
  
  // 自然
  '🌟', '⭐', '🌙', '☀️', '⛅', '🌈', '🔥', '💧',
  '❄️', '🌊', '🌸', '🌺', '🌻', '🌼', '🌷', '🌹',
  '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀',
  
  // 其他
  '🎮', '🎲', '🎯', '🎪', '🎨', '🎭', '🎬', '🎤',
  '🎧', '🎵', '🎶', '🚀', '✈️', '🚗', '🚕', '🚙',
  '⚡', '💎', '👑', '💰', '💝', '🎁', '🎈', '🎉'
];

const DEFAULT_AVATAR = '😀';

interface AvatarPickerProps {
  selectedAvatar: string;
  onSelect: (avatar: string) => void;
}

/**
 * 头像选择器组件
 */
export const AvatarPicker: React.FC<AvatarPickerProps> = ({ selectedAvatar, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      {/* 头像选择按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '3.5rem',
          height: '3.5rem',
          fontSize: '2rem',
          background: '#1a1a2e',
          border: '2px solid #374151',
          borderRadius: '50%',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#00d4ff';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#374151';
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="选择头像"
      >
        {selectedAvatar}
      </button>

      {/* 头像选择面板 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999,
            }}
            onClick={() => setIsOpen(false)}
          />
          
          {/* 头像网格 */}
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 0.5rem)',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'max-content',
              maxWidth: '20rem',
              maxHeight: '18rem',
              padding: '1rem',
              background: '#1a1a2e',
              border: '1px solid #374151',
              borderRadius: '1rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              overflowY: 'auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '0.375rem',
            }}
          >
            {AVATAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onSelect(emoji);
                  setIsOpen(false);
                }}
                style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  fontSize: '1.25rem',
                  background: selectedAvatar === emoji ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                  border: selectedAvatar === emoji ? '2px solid #00d4ff' : '1px solid transparent',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)';
                  e.currentTarget.style.transform = 'scale(1.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = selectedAvatar === emoji ? 'rgba(0, 212, 255, 0.2)' : 'transparent';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export { DEFAULT_AVATAR, AVATAR_EMOJIS };
