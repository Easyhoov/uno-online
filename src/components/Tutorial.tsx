import React, { useState, useEffect } from 'react';

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

const TUTORIAL_STEPS = [
  {
    icon: '🎯',
    title: '游戏目标',
    content: '第一个出完所有手牌的玩家获胜！'
  },
  {
    icon: '🃏',
    title: '出牌规则',
    content: '出的牌必须与弃牌堆顶牌颜色或数字相同。万能牌可以随时出。'
  },
  {
    icon: '⚡',
    title: '功能牌',
    content: '⊘ 跳过、⇄ 反转、+2 罚抽、变色牌、+4 万能牌。'
  },
  {
    icon: '📢',
    title: '喊 UNO',
    content: '只剩 1 张牌时记得喊 UNO，否则罚抽 2 张！'
  },
  {
    icon: '🎮',
    title: '快捷键',
    content: 'Tab 键选择卡牌，Enter/空格 出牌，H 喊 UNO，D 抽牌。'
  }
];

/**
 * 新手引导组件
 */
export const Tutorial: React.FC<TutorialProps> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  // 重置步骤
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter') {
      handleNext();
    } else if (e.key === 'ArrowLeft') {
      handlePrev();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const step = TUTORIAL_STEPS[currentStep];

  return (
    <div
      className="tutorial-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      aria-describedby="tutorial-content"
    >
      <div
        className="tutorial-card"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-label="新手引导"
      >
        {/* 进度指示 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {TUTORIAL_STEPS.map((_, index) => (
            <div
              key={index}
              style={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '50%',
                background: index === currentStep ? '#00d4ff' : '#374151',
                transition: 'background 0.2s'
              }}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* 步骤内容 */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden="true">
            {step.icon}
          </div>
          <h2 id="tutorial-title" style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '0.75rem' }}>
            {step.title}
          </h2>
          <p id="tutorial-content" style={{ color: '#d1d5db', fontSize: '0.9rem', lineHeight: '1.6' }}>
            {step.content}
          </p>
        </div>

        {/* 导航按钮 */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#374151',
                borderRadius: '0.5rem',
                border: 'none',
                color: 'white',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
              aria-label="上一步"
            >
              ← 上一步
            </button>
          )}
          <button
            onClick={handleNext}
            style={{
              padding: '0.75rem 1.5rem',
              background: currentStep === TUTORIAL_STEPS.length - 1 ? '#22c55e' : '#00d4ff',
              borderRadius: '0.5rem',
              border: 'none',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
            aria-label={currentStep === TUTORIAL_STEPS.length - 1 ? '开始游戏' : '下一步'}
          >
            {currentStep === TUTORIAL_STEPS.length - 1 ? '🎮 开始游戏' : '下一步 →'}
          </button>
        </div>

        {/* 跳过链接 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
          aria-label="跳过引导"
        >
          跳过 ✕
        </button>

        {/* 键盘提示 */}
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', marginTop: '1rem' }} aria-hidden="true">
          ← → 切换步骤 | Esc 关闭
        </p>
      </div>
    </div>
  );
};

/**
 * 检查是否需要显示新手引导
 */
export const useShowTutorial = () => {
  const STORAGE_KEY = 'uno-online-tutorial-shown';
  
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem(STORAGE_KEY);
    if (!hasSeenTutorial) {
      setShouldShow(true);
    }
  }, []);

  const markAsSeen = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShouldShow(false);
  };

  return { shouldShow, markAsSeen };
};