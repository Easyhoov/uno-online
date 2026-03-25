import React, { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { peerManager } from '../p2p/peerConnection';

/**
 * 大厅组件 - 创建/加入房间
 */
export const Lobby: React.FC = () => {
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const { room, setRoomId: setStoreRoomId, setConnected, updatePlayers, setGameRunning, updateGameState, updateMyHand } = useGameStore();

  // 设置 peerManager 状态回调
  useEffect(() => {
    peerManager.setStateCallback((state: any) => {
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
      await peerManager.initializeAsHost(newRoomId, playerName.trim());
    } catch (err: any) {
      setError(`创建失败：${err.message}`);
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
      await peerManager.initializeAsClient(hostPeerId, playerName.trim(), roomId.toUpperCase());
    } catch (err: any) {
      setError(`加入失败：${err.message}`);
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
    peerManager.startGame();
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
                  {room.players.map((player, i) => (
                    <div key={i} style={{ padding: '0.5rem 1rem', background: '#1a1a2e', borderRadius: '0.5rem', color: 'white' }}>
                      {player.name} {player.isHost && '👑'}
                    </div>
                  ))}
                </div>
              </div>

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
              {/* 昵称输入 */}
              <input
                type="text"
                placeholder="输入你的昵称"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                style={{
                  width: '100%', padding: '0.75rem 1rem', background: '#1a1a2e',
                  borderRadius: '0.5rem', color: 'white', border: '1px solid #374151',
                  outline: 'none', fontSize: '1rem', boxSizing: 'border-box'
                }}
                maxLength={20}
              />

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
