import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { peerManager } from '../p2p/peerConnection';
import { AvatarPicker, DEFAULT_AVATAR } from './AvatarPicker';

/**
 * 大厅组件 - 创建/加入房间
 */
export const Lobby: React.FC = () => {
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerAvatar, setPlayerAvatar] = useState(DEFAULT_AVATAR);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const { room, setRoomId: setStoreRoomId, setConnected, updatePlayers, setGameRunning, updateGameState, updateMyHand } = useGameStore();

  // 设置 peerManager 状态回调
  useEffect(() => {
    peerManager.setStateCallback((state: { room?: { roomId?: string; isHost?: boolean; isConnected?: boolean; players?: any[]; isGameRunning?: boolean }; gameState?: any; myHand?: any }) => {
      if (state.room) {
        if (state.room.roomId !== undefined) setStoreRoomId(state.room.roomId, state.room.isHost ?? false);
        if (state.room.isConnected !== undefined) setConnected(state.room.isConnected);
        if (state.room.players) updatePlayers(state.room.players);
        if (state.room.isGameRunning !== undefined) setGameRunning(state.room.isGameRunning);
      }
      if (state.gameState !== undefined) updateGameState(state.gameState);
      if (state.myHand !== undefined) updateMyHand(state.myHand);
    });
  }, [setStoreRoomId, setConnected, updatePlayers, setGameRunning, updateGameState, updateMyHand]);

  const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError('请输入你的昵称');
      return;
    }
    setIsCreating(true);
    setError('');
    try {
      const newRoomId = generateRoomId();
      await peerManager.initializeAsHost(newRoomId, playerName.trim(), playerAvatar);
    } catch (err) {
      setError(`创建失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!roomId.trim()) { setError('请输入房间号'); return; }
    if (!playerName.trim()) { setError('请输入你的昵称'); return; }
    setIsJoining(true);
    setError('');
    try {
      const hostPeerId = `uno-${roomId.toUpperCase()}`;
      await peerManager.initializeAsClient(hostPeerId, playerName.trim(), roomId.toUpperCase(), playerAvatar);
    } catch (err) {
      setError(`加入失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsJoining(false);
    }
  };

  const copyRoomId = () => {
    if (!room.roomId) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(room.roomId).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }).catch(() => fallbackCopy(room.roomId!));
    } else {
      fallbackCopy(room.roomId);
    }
  };

  const fallbackCopy = (text: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      window.prompt('请手动复制房间号：', text);
    }
    document.body.removeChild(textarea);
  };

  const handleStartGame = () => {
    if (room.players.length < 2) {
      setError('至少需要 2 名玩家');
      return;
    }
    // 检查所有玩家是否都准备好了
    const allReady = room.players.every(p => (p as any).isReady !== false);
    if (!allReady) {
      setError('有玩家还没准备好，等待所有玩家准备就绪后再开始');
      return;
    }
    peerManager.startGame();
  };

  const handleKickPlayer = (playerId: string, playerName: string) => {
    if (!room.isHost) return;
    if (confirm(`确定要踢出玩家 "${playerName}" 吗？`)) {
      peerManager.kickPlayer(playerId, '房主将你踢出房间');
    }
  };

  const handleToggleReady = () => {
    // 切换准备状态
    const newReady = !isReady;
    setIsReady(newReady);
    // 通知房主（如果是客户端）
    if (!room.isHost) {
      peerManager.send({ type: 'READY_CHANGE', timestamp: new Date().getTime(), isReady: newReady });
    }
    // 更新 UI
    updatePlayers(room.players.map(p => ({
      ...p,
      isReady: p.id === (room.isHost ? 'host' : peerManager.getMyPeerId()) ? newReady : p.isReady
    })));
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '28rem' }}>
        {/* 标题 */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem' }}>🎴 UNO</h1>
          <p style={{ color: '#9ca3af' }}>在线联机版</p>
        </div>

        {/* 主卡片 */}
        <div style={{ background: '#16213e', borderRadius: '1rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: '2rem' }}>
          {room.roomId ? (
            /* 已在房间中 */
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ color: '#9ca3af', marginBottom: '0.5rem' }}>房间号</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#f5d300', letterSpacing: '0.2em' }}>{room.roomId}</span>
                  <button
                    onClick={copyRoomId}
                    style={{ padding: '0.5rem 0.75rem', background: copySuccess ? '#22c55e' : '#00d4ff', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', transition: 'background 0.2s', fontSize: '1rem' }}
                    title="复制房间号"
                  >
                    {copySuccess ? '✅' : '📋'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ color: '#9ca3af', marginBottom: '1rem' }}>等待玩家加入... ({room.players.length}/4)</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {room.players.map((player, i) => {
                    const isReady = (player as any).isReady !== false;
                    
                    return (
                      <div key={i} style={{ padding: '0.5rem 1rem', background: '#1a1a2e', borderRadius: '0.5rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
                        <span style={{ fontSize: '1.25rem' }}>{(player as any).avatar || '😀'}</span>
                        <span>{player.name} {player.isHost && '👑'}</span>
                        {/* 准备状态 */}
                        <span style={{ 
                          padding: '0.15rem 0.5rem', 
                          borderRadius: '1rem', 
                          fontSize: '0.65rem',
                          fontWeight: 'bold',
                          background: isReady ? 'rgba(34, 197, 94, 0.2)' : 'rgba(156, 163, 175, 0.2)',
                          color: isReady ? '#4ade80' : '#9ca3af'
                        }}>
                          {isReady ? '✅ 准备' : '⏳ 未准备'}
                        </span>
                        {room.isHost && !player.isHost && (
                          <button
                            onClick={() => handleKickPlayer(player.id, player.name)}
                            style={{
                              marginLeft: '0.5rem',
                              padding: '0.2rem 0.5rem',
                              background: '#ef4444',
                              borderRadius: '0.25rem',
                              border: 'none',
                              color: 'white',
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                            title="踢出玩家"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 准备按钮（非房主） */}
              {!room.isHost && (
                <button
                  onClick={handleToggleReady}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: isReady ? '#ef4444' : '#22c55e',
                    borderRadius: '0.5rem',
                    fontWeight: 'bold',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    fontSize: '1.125rem',
                    marginBottom: '1rem'
                  }}
                >
                  {isReady ? '✋ 取消准备' : '✅ 准备就绪'}
                </button>
              )}

              {room.isHost && (
                <button
                  onClick={handleStartGame}
                  disabled={room.players.length < 2}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: room.players.length >= 2 ? '#e94560' : '#4b5563',
                    borderRadius: '0.5rem',
                    fontWeight: 'bold',
                    color: 'white',
                    border: 'none',
                    cursor: room.players.length >= 2 ? 'pointer' : 'not-allowed',
                    width: '100%',
                    fontSize: '1.125rem'
                  }}
                >
                  🎮 开始游戏
                </button>
              )}
              {!room.isHost && (
                <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>等待房主开始游戏...</p>
              )}
            </div>
          ) : (
            /* 创建/加入 */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* 昵称和头像 */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {/* 头像选择 */}
                <AvatarPicker selectedAvatar={playerAvatar} onSelect={setPlayerAvatar} />
                
                {/* 昵称输入 */}
                <input
                  type="text"
                  placeholder="输入你的昵称"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem', background: '#1a1a2e',
                    borderRadius: '0.5rem', color: 'white', border: '1px solid #374151',
                    outline: 'none', fontSize: '1rem', boxSizing: 'border-box'
                  }}
                  maxLength={20}
                />
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={isCreating}
                style={{
                  padding: '1rem', background: isCreating ? '#9ca3af' : '#e94560',
                  borderRadius: '0.5rem', fontWeight: 'bold', color: 'white',
                  border: 'none', cursor: isCreating ? 'not-allowed' : 'pointer', fontSize: '1.125rem'
                }}
              >
                {isCreating ? '创建中...' : '🏠 创建房间'}
              </button>

              {/* 分隔线 */}
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '100%', borderTop: '1px solid #4b5563' }}></div>
                </div>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', fontSize: '0.875rem' }}>
                  <span style={{ padding: '0 1rem', background: '#16213e', color: '#9ca3af' }}>或</span>
                </div>
              </div>

              <input
                type="text"
                placeholder="输入房间号"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                style={{
                  width: '100%', padding: '0.75rem 1rem', background: '#1a1a2e',
                  borderRadius: '0.5rem', color: 'white', border: '1px solid #374151',
                  outline: 'none', fontSize: '1rem', letterSpacing: '0.15em',
                  textTransform: 'uppercase', boxSizing: 'border-box'
                }}
                maxLength={6}
              />
              <button
                onClick={handleJoinRoom}
                disabled={isJoining}
                style={{
                  padding: '0.75rem 1.5rem', background: isJoining ? '#9ca3af' : '#00d4ff',
                  borderRadius: '0.5rem', fontWeight: 'bold', color: 'white',
                  border: 'none', cursor: isJoining ? 'not-allowed' : 'pointer', fontSize: '1.125rem'
                }}
              >
                {isJoining ? '加入中...' : '🚪 加入房间'}
              </button>

              {error && (
                <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '0.5rem', color: '#f87171', fontSize: '0.875rem' }}>
                  ⚠️ {error}
                </div>
              )}
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem', marginTop: '1.5rem' }}>
          无需注册 · 即开即玩 · 支持 2-4 人
        </p>
      </div>
    </div>
  );
};
