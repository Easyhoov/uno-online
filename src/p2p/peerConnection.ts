import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { Message, JoinAckMessage } from './messages';
import { createMessage } from './messages';
import { Game } from '../game/Game';
import { useGameStore } from '../store/gameStore';

/**
 * P2P 连接管理器
 * 
 * 关键设计：
 * - 房主 ID 固定为 'host'
 * - 客户端 ID 使用 PeerJS 自动分配的 peer ID
 * - Game 中的 player.id 和 P2P 层的 ID 保持一致
 */
export class PeerConnectionManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private isHostMode: boolean = false;
  private myPeerId: string | null = null;
  private onStateUpdate: ((state: any) => void) | null = null;
  private game: Game | null = null;
  private playerNames: Map<string, string> = new Map(); // peerId -> name
  private playerAvatars: Map<string, string> = new Map(); // peerId -> avatar
  private hostName: string = '房主';
  private hostAvatar: string = '😀';
  
  // 断线重连相关
  private disconnectedPlayers: Map<string, { name: string; avatar: string; hand: any[]; timeout: any }> = new Map();
  private playerLastHeartbeat: Map<string, number> = new Map();
  private playerReady: Map<string, boolean> = new Map(); // 玩家准备状态
  
  // 速率限制：防止恶意高频请求
  private playerActionTimes: Map<string, number[]> = new Map(); // playerId -> 最近动作时间戳
  private readonly MAX_ACTIONS_PER_SECOND = 5; // 每秒最多 5 个动作
  
  // 错误码到用户友好消息的映射
  private readonly ERROR_MESSAGES: Record<string, string> = {
    'PLAYER_NOT_FOUND': '玩家未找到',
    'GAME_OVER': '游戏已结束',
    'NOT_YOUR_TURN': '还不是你的回合',
    'INVALID_CARD_INDEX': '无效的卡牌索引',
    'INVALID_CARD': '无效的卡牌',
    'MUST_DECLARE_COLOR': '万能牌必须声明颜色',
    'INVALID_ACTION': '无效的动作',
    'ALREADY_DRAWN': '本回合已抽过牌',
    'MUST_DRAW_FIRST': '必须先抽牌才能跳过',
    'NO_PENDING_CHALLENGE': '没有待处理的挑战',
    'TARGET_NOT_FOUND': '目标玩家未找到',
    'RATE_LIMIT_EXCEEDED': '操作过于频繁，请稍后再试',
    'NETWORK_ERROR': '网络连接错误',
    'PEER_CONNECTION_FAILED': '无法连接到游戏房间',
    'UNKNOWN': '发生未知错误'
  };
  
  // 重连相关
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private hostPeerIdForReconnect: string | null = null; // 保存房主 ID 用于重连
  private playerNameForReconnect: string | null = null; // 保存玩家名称用于重连
  private roomIdForReconnect: string | null = null; // 保存房间 ID 用于重连
  private playerAvatarForReconnect: string | null = null; // 保存头像用于重连

  setStateCallback(callback: (state: any) => void) {
    this.onStateUpdate = callback;
  }
  
  /**
   * 获取用户友好的错误消息
   */
  private getFriendlyErrorMessage(code: string): string {
    return this.ERROR_MESSAGES[code] || this.ERROR_MESSAGES['UNKNOWN'];
  }
  
  /**
   * 添加错误到 Store
   */
  private addError(code: string, customMessage?: string) {
    const store = useGameStore.getState();
    const message = customMessage || this.getFriendlyErrorMessage(code);
    store.addError(code, message);
  }

  /**
   * 初始化 Peer（房主模式）
   */
  async initializeAsHost(roomId: string, hostName: string, hostAvatar: string = '😀'): Promise<string> {
    return new Promise((resolve, reject) => {
      const peerId = `uno-${roomId}`;
      this.isHostMode = true;
      this.hostName = hostName || '房主';
      this.hostAvatar = hostAvatar || '😀';

      this.peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        console.log('[Host] Peer ID:', id);
        this.myPeerId = id;
        this.playerNames.set('host', this.hostName);
        this.playerAvatars.set('host', this.hostAvatar);
        this.updateState({
          room: { roomId, isHost: true, isConnected: true, players: [{ id: 'host', name: this.hostName, avatar: this.hostAvatar, isHost: true, isReady: true }] }
        });
        
        // 启动心跳检测（每 5 秒）
        setInterval(() => {
          if (!this.isHostMode) return;
          const now = Date.now();
          const timeout = 15000;
          for (const [peerId, lastBeat] of this.playerLastHeartbeat.entries()) {
            if (now - lastBeat > timeout) {
              console.log('[Host] Player heartbeat timeout:', peerId);
              const conn = this.connections.get(peerId);
              if (conn) conn.close();
            }
          }
          this.broadcastToClients({ type: 'KEEPALIVE', timestamp: Date.now(), playerId: 'host' });
        }, 5000);
        
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.setupHostConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('[Host] Peer error:', err);
        this.addError('PEER_CONNECTION_FAILED', `房主模式启动失败：${err.message || err.type}`);
        reject(err);
      });
    });
  }

  /**
   * 初始化 Peer（客户端模式）
   */
  async initializeAsClient(hostPeerId: string, playerName: string, roomId: string, playerAvatar: string = '😀'): Promise<string> {
    return new Promise((resolve, reject) => {
      this.isHostMode = false;
      
      // 保存重连所需信息
      this.hostPeerIdForReconnect = hostPeerId;
      this.playerNameForReconnect = playerName;
      this.roomIdForReconnect = roomId;
      this.playerAvatarForReconnect = playerAvatar;

      this.peer = new Peer(undefined as any, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (myId) => {
        console.log('[Client] My Peer ID:', myId);
        this.myPeerId = myId;

        const conn = this.peer!.connect(hostPeerId, {
          reliable: true,
          metadata: { playerName, roomId, playerAvatar }
        });

        conn.on('open', () => {
          console.log('[Client] Connected to host');
          this.connections.set('host', conn);
          this.reconnectAttempts = 0; // 连接成功，重置重连计数
          this.updateState({
            room: { roomId, isHost: false, isConnected: true }
          });
          
          // 启动客户端心跳
          this.startClientHeartbeat();
          
          resolve(myId);
        });

        conn.on('data', (data: any) => {
          this.handleClientMessage(data as Message);
        });

        conn.on('close', () => {
          console.log('[Client] Disconnected from host');
          this.updateState({ room: { isConnected: false } });
          this.addError('NETWORK_ERROR', '与房主失去连接，尝试重新连接...');
          
          // 自动尝试重连
          this.attemptReconnect();
        });

        conn.on('error', (err) => {
          console.error('[Client] Connection error:', err);
          this.addError('NETWORK_ERROR', `连接错误：${err.message || err.type}`);
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        console.error('[Client] Peer error:', err);
        this.addError('PEER_CONNECTION_FAILED', `无法连接到房间：${err.message || err.type}`);
        reject(err);
      });
    });
  }

  /**
   * 启动心跳（客户端）
   */
  private startClientHeartbeat() {
    setInterval(() => {
      if (this.isHostMode || !this.connections.has('host')) return;
      this.send({ type: 'KEEPALIVE', timestamp: Date.now(), playerId: this.myPeerId! });
    }, 5000);
  }
  
  /**
   * 尝试重新连接（客户端）
   */
  private async attemptReconnect() {
    if (!this.hostPeerIdForReconnect || !this.roomIdForReconnect) {
      console.log('[Client] Cannot reconnect: missing host/room info');
      return;
    }
    
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.addError('NETWORK_ERROR', '重连失败次数过多，请检查网络连接');
      this.reconnectAttempts = 0;
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000); // 指数退避，最多 10 秒
    
    console.log(`[Client] Attempting reconnect ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
    
    setTimeout(async () => {
      if (this.isHostMode || !this.myPeerId) return;
      
      try {
        // 发送重连请求
        this.send({
          type: 'RECONNECT_REQUEST',
          timestamp: Date.now(),
          playerId: this.myPeerId!,
          roomId: this.roomIdForReconnect!,
          playerName: this.playerNameForReconnect!
        });
        console.log('[Client] Reconnect request sent');
      } catch (err) {
        console.error('[Client] Reconnect failed:', err);
        this.attemptReconnect(); // 继续尝试
      }
    }, delay);
  }

  private updateState(state: any) {
    if (this.onStateUpdate) {
      this.onStateUpdate(state);
    }
  }

  /**
   * 房主：设置新客户端连接
   */
  private setupHostConnection(conn: DataConnection) {
    const playerName = conn.metadata?.playerName || 'Player';
    const playerAvatar = conn.metadata?.playerAvatar || '😀';
    const clientPeerId = conn.peer;

    conn.on('open', () => {
      console.log('[Host] New player:', clientPeerId, playerName, playerAvatar);
      this.connections.set(clientPeerId, conn);
      this.playerNames.set(clientPeerId, playerName);
      this.playerAvatars.set(clientPeerId, playerAvatar);
      this.playerLastHeartbeat.set(clientPeerId, Date.now());

      // 检查是否有断线重连的玩家
      const disconnectedData = this.disconnectedPlayers.get(clientPeerId);
      if (disconnectedData && this.game && this.game.isGameOver === false) {
        console.log('[Host] Player reconnected:', clientPeerId);
        clearTimeout(disconnectedData.timeout);
        this.disconnectedPlayers.delete(clientPeerId);
        
        // 同步游戏状态给重连玩家
        const gameState = this.game.getPublicState();
        const hand = this.game.getPlayerHand(clientPeerId);
        conn.send(createMessage<GameStateSyncMessage>('GAME_STATE_SYNC', {
          gameState,
          myHand: hand || []
        }));
      }

      const players = this.buildPlayerList();

      // 告诉新玩家加入成功
      conn.send(createMessage<JoinAckMessage>('JOIN_ACK', {
        success: true,
        playerId: clientPeerId,
        players
      }));

      // 广播给其他人
      this.broadcastToClients({
        type: 'PLAYER_JOINED',
        timestamp: Date.now(),
        player: { id: clientPeerId, name: playerName, avatar: playerAvatar, isHost: false },
        players
      }, clientPeerId);

      // 更新房主自己的 UI
      this.updateState({ room: { players } });
    });

    conn.on('data', (data: any) => {
      this.handleHostMessage(data as Message, clientPeerId);
    });

    conn.on('close', () => {
      console.log('[Host] Player disconnected:', clientPeerId);
      this.connections.delete(clientPeerId);
      
      // 断线处理：保留玩家状态 30 秒
      if (this.game && !this.game.isGameOver) {
        const hand = this.game.getPlayerHand(clientPeerId);
        const name = this.playerNames.get(clientPeerId) || 'Player';
        const avatar = this.playerAvatars.get(clientPeerId) || '😀';
        
        this.disconnectedPlayers.set(clientPeerId, {
          name,
          avatar,
          hand: hand || [],
          timeout: setTimeout(() => {
            console.log('[Host] Player reconnection timeout:', clientPeerId);
            this.disconnectedPlayers.delete(clientPeerId);
            this.playerNames.delete(clientPeerId);
            this.playerAvatars.delete(clientPeerId);
            const players = this.buildPlayerList();
            this.broadcastToClients({
              type: 'PLAYER_LEFT',
              timestamp: Date.now(),
              playerId: clientPeerId,
              players
            });
            this.updateState({ room: { players } });
          }, 30000) // 30 秒超时
        });
      } else {
        this.playerNames.delete(clientPeerId);
        this.playerAvatars.delete(clientPeerId);
      }
      
      const players = this.buildPlayerList();
      this.updateState({ room: { players } });
    });
  }

  /**
   * 构建玩家列表（包含准备状态）
   */
  private buildPlayerList() {
    return [
      { id: 'host', name: this.playerNames.get('host') || this.hostName, avatar: this.playerAvatars.get('host') || this.hostAvatar, isHost: true, isReady: true },
      ...Array.from(this.connections.keys()).map(peerId => ({
        id: peerId,
        name: this.playerNames.get(peerId) || 'Player',
        avatar: this.playerAvatars.get(peerId) || '😀',
        isHost: false,
        isReady: this.playerReady.get(peerId) !== false
      }))
    ];
  }

  // ============================================================
  // 房主消息处理
  // ============================================================

  private handleHostMessage(data: Message, fromPeerId: string) {
    console.log('[Host] Message from', fromPeerId, ':', data.type);

    switch (data.type) {
      case 'ACTION':
        this.processGameAction(fromPeerId, (data as any).action);
        break;
      
      case 'KEEPALIVE':
        this.playerLastHeartbeat.set(fromPeerId, Date.now());
        break;
      
      case 'RECONNECT_REQUEST':
        this.handleReconnectRequest(fromPeerId, data);
        break;
      
      case 'READY_CHANGE':
        const readyData: any = data;
        this.playerReady.set(fromPeerId, readyData.isReady);
        // 更新玩家列表
        const players = this.buildPlayerList();
        this.broadcastToClients({
          type: 'PLAYER_JOINED',
          timestamp: Date.now(),
          player: { id: fromPeerId, name: this.playerNames.get(fromPeerId) || 'Player', avatar: this.playerAvatars.get(fromPeerId) || '😀', isHost: false },
          players
        });
        this.updateState({ room: { players } });
        break;
    }
  }

  /**
   * 处理重连请求
   */
  private handleReconnectRequest(peerId: string, _data: any) {
    const disconnectedData = this.disconnectedPlayers.get(peerId);
    
    if (!disconnectedData || !this.game || this.game.isGameOver) {
      const conn = this.connections.get(peerId);
      if (conn) {
        conn.send(createMessage('RECONNECT_ACK', {
          success: false,
          error: '无法重连：游戏已结束或超时'
        }));
      }
      return;
    }

    // 重连成功
    clearTimeout(disconnectedData.timeout);
    this.disconnectedPlayers.delete(peerId);
    this.playerNames.set(peerId, disconnectedData.name);
    this.playerAvatars.set(peerId, disconnectedData.avatar);
    this.playerLastHeartbeat.set(peerId, Date.now());

    const conn = this.connections.get(peerId);
    if (conn) {
      const gameState = this.game.getPublicState();
      const hand = this.game.getPlayerHand(peerId);
      conn.send(createMessage('RECONNECT_ACK', {
        success: true,
        gameState,
        myHand: hand || []
      }));
      
      // 广播玩家重连
      this.broadcastToClients({
        type: 'PLAYER_JOINED',
        timestamp: Date.now(),
        player: { id: peerId, name: disconnectedData.name, avatar: disconnectedData.avatar, isHost: false },
        players: this.buildPlayerList()
      });
    }

    console.log('[Host] Player reconnected successfully:', peerId);
  }

  /**
   * 房主：开始游戏
   */
  startGame() {
    if (!this.isHostMode) return;

    console.log('[Host] Starting game...');
    this.game = new Game();

    // 添加房主（带头像）
    this.game.addPlayer(this.hostName, true, 'host', this.hostAvatar);

    // 添加所有客户端，使用他们的 peerId 作为游戏内 ID（带头像）
    for (const [peerId] of this.connections) {
      const name = this.playerNames.get(peerId) || 'Player';
      const avatar = this.playerAvatars.get(peerId) || '😀';
      this.game.addPlayer(name, false, peerId, avatar);
    }

    this.game.startGame();
    const gameState = this.game.getPublicState();

    // 广播游戏开始给所有客户端
    for (const [peerId, conn] of this.connections) {
      const hand = this.game.getPlayerHand(peerId);
      conn.send({
        type: 'GAME_START',
        timestamp: Date.now(),
        gameState,
        myHand: hand
      });
    }

    // 更新房主自己的 UI
    const hostHand = this.game.getPlayerHand('host');
    this.updateState({
      room: { isGameRunning: true },
      gameState,
      myHand: hostHand
    });

    console.log('[Host] Game started, players:', this.game.players.length);
  }

  /**
   * 速率限制检查
   */
  private checkRateLimit(playerId: string): boolean {
    const now = Date.now();
    const times = this.playerActionTimes.get(playerId) || [];
    // 移除 1 秒前的记录
    const recentTimes = times.filter(t => now - t < 1000);
    
    if (recentTimes.length >= this.MAX_ACTIONS_PER_SECOND) {
      return false; // 超过限制
    }
    
    recentTimes.push(now);
    this.playerActionTimes.set(playerId, recentTimes);
    return true;
  }

  /**
   * 房主：处理游戏动作（来自客户端或房主自己）
   */
  processGameAction(fromId: string, action: any) {
    if (!this.game) {
      console.error('[Host] No active game');
      return;
    }

    // 速率限制检查（房主自己 exempt）
    if (fromId !== 'host' && !this.checkRateLimit(fromId)) {
      console.log('[Host] Rate limit exceeded for:', fromId);
      const conn = this.connections.get(fromId);
      if (conn) {
        conn.send({
          type: 'ERROR',
          timestamp: Date.now(),
          code: 'RATE_LIMIT_EXCEEDED',
          message: '操作过于频繁，请稍后再试'
        });
      }
      return;
    }

    // 确保 action.playerId 和 fromId 一致（防作弊）
    action.playerId = fromId;

    console.log('[Host] Processing action:', fromId, action.type);
    const result = this.game.processAction(action);

    if (result.valid) {
      const gameState = this.game.getPublicState();

      // 广播状态给所有客户端（合并为一条消息）
      for (const [peerId, conn] of this.connections) {
        const hand = this.game.getPlayerHand(peerId);
        conn.send({
          type: 'FULL_STATE_UPDATE',
          timestamp: Date.now(),
          gameState,
          hand
        });
      }

      // 更新房主自己
      const hostHand = this.game.getPlayerHand('host');
      this.updateState({ gameState, myHand: hostHand });

      // 游戏结束
      if (result.gameOver) {
        const winner = this.game.players.find(p => p.id === result.winnerId);
        this.broadcastToClients({
          type: 'GAME_OVER',
          timestamp: Date.now(),
          winnerId: result.winnerId,
          winnerName: winner?.name || 'Unknown'
        });
        this.updateState({
          gameOver: { winnerId: result.winnerId, winnerName: winner?.name || 'Unknown' }
        });
      }
    } else {
      console.log('[Host] Invalid action:', result.reason);
      // 如果是客户端的无效操作，通知客户端
      if (fromId !== 'host') {
        const conn = this.connections.get(fromId);
        if (conn) {
          conn.send({
            type: 'ERROR',
            timestamp: Date.now(),
            code: 'INVALID_ACTION',
            message: result.reason || 'Invalid action'
          });
        }
      }
    }
  }

  /**
   * 房主本地出牌（不走网络，直接处理）
   */
  hostAction(action: any) {
    if (!this.isHostMode || !this.game) return;
    this.processGameAction('host', action);
  }

  /**
   * 房主踢出玩家
   */
  kickPlayer(targetPlayerId: string, reason?: string) {
    if (!this.isHostMode) return;
    
    const conn = this.connections.get(targetPlayerId);
    if (conn) {
      // 发送被踢通知
      conn.send(createMessage<KickedMessage>('KICKED', { reason }));
      conn.close();
    }

    // 清理玩家数据
    this.disconnectedPlayers.delete(targetPlayerId);
    clearTimeout(this.disconnectedPlayers.get(targetPlayerId)?.timeout);
    this.playerNames.delete(targetPlayerId);
    this.playerAvatars.delete(targetPlayerId);
    
    const players = this.buildPlayerList();
    this.broadcastToClients({
      type: 'PLAYER_LEFT',
      timestamp: Date.now(),
      playerId: targetPlayerId,
      players
    });
    this.updateState({ room: { players } });

    console.log('[Host] Kicked player:', targetPlayerId, reason);
  }

  /**
   * 房主转移（给下一个玩家）
   */
  transferHost() {
    if (!this.isHostMode || this.connections.size === 0) return;
    
    // 选择第一个客户端作为新房主
    const [newHostId] = this.connections.keys();
    const newHostName = this.playerNames.get(newHostId) || 'Player';
    
    console.log('[Host] Transferring host to:', newHostId, newHostName);
    
    // 序列化游戏状态（用于新房主恢复）
    const serializedGame = this.game ? this.game.serialize() : null;
    
    // 通知所有客户端
    this.broadcastToClients({
      type: 'HOST_TRANSFER',
      timestamp: Date.now(),
      newHostId,
      newHostName,
      serializedGame
    });

    // 清理当前房主状态
    this.disconnect();
  }

  // ============================================================
  // 客户端消息处理
  // ============================================================

  private handleClientMessage(data: Message) {
    console.log('[Client] Message:', data.type);

    switch (data.type) {
      case 'JOIN_ACK': {
        const ack = data as JoinAckMessage;
        if (ack.success && ack.players) {
          this.updateState({ room: { players: ack.players } });
        }
        break;
      }

      case 'PLAYER_JOINED':
        if ('players' in data) {
          const players = (data as any).players;
          this.updateState({ room: { players } });
          // 更新本地准备状态
          if (players && Array.isArray(players)) {
            players.forEach((p: any) => {
              if (p.isReady !== undefined) {
                this.playerReady.set(p.id, p.isReady);
              }
            });
          }
        }
        break;

      case 'PLAYER_LEFT':
        if ('players' in data) {
          this.updateState({ room: { players: (data as any).players } });
        }
        break;

      case 'GAME_START':
        this.updateState({
          room: { isGameRunning: true },
          gameState: (data as any).gameState,
          myHand: (data as any).myHand
        });
        break;

      case 'STATE_UPDATE':
        this.updateState({ gameState: (data as any).gameState });
        break;

      case 'HAND_UPDATE':
        this.updateState({ myHand: (data as any).hand });
        break;

      case 'FULL_STATE_UPDATE':
        const fullState: any = data;
        this.updateState({ 
          gameState: fullState.gameState, 
          myHand: fullState.hand 
        });
        break;

      case 'GAME_OVER':
        this.updateState({
          room: { isGameRunning: false },
          gameOver: { winnerId: (data as any).winnerId, winnerName: (data as any).winnerName }
        });
        break;

      case 'RETURN_TO_LOBBY':
        this.updateState({
          room: { isGameRunning: false, players: (data as any).players },
          gameState: null,
          myHand: null
        });
        break;

      case 'ERROR':
        const errorData: any = data;
        console.error('[Client] Error:', errorData.message);
        this.addError(errorData.code || 'UNKNOWN', errorData.message);
        break;

      case 'KICKED':
        const kickMsg: any = data;
        alert(`你被房主踢出房间${kickMsg.reason ? ': ' + kickMsg.reason : ''}`);
        this.disconnect();
        break;

      case 'HOST_TRANSFER':
        const transferMsg: any = data;
        alert(`房主已转移给 ${transferMsg.newHostName}`);
        if (transferMsg.newHostId === this.myPeerId) {
          alert('你现在是新房主！');
          // 新房主接管游戏状态
          this.isHostMode = true;
          this.myPeerId = 'host';
          
          // 重建玩家名称和头像映射
          this.playerNames.clear();
          this.playerAvatars.clear();
          
          // 恢复游戏状态
          if (transferMsg.serializedGame) {
            this.game = Game.deserialize(transferMsg.serializedGame);
            this.playerNames.set('host', this.game.players.find(p => p.id === 'host')?.name || 'Host');
            this.playerAvatars.set('host', this.game.players.find(p => p.id === 'host')?.avatar || '😀');
            
            // 更新 UI 状态
            const gameState = this.game.getPublicState();
            const hostHand = this.game.getPlayerHand('host');
            this.updateState({
              room: { isGameRunning: true, isHost: true },
              gameState,
              myHand: hostHand
            });
            
            console.log('[New Host] Game restored successfully');
          }
          
          console.log('[New Host] Taking over game, connections:', this.connections.size);
        }
        break;

      case 'GAME_STATE_SYNC':
        const syncMsg: any = data;
        this.updateState({
          gameState: syncMsg.gameState,
          myHand: syncMsg.myHand
        });
        console.log('[Client] Game state synced after reconnect');
        break;

      case 'RECONNECT_ACK':
        const ackMsg: any = data;
        if (ackMsg.success) {
          this.updateState({
            gameState: ackMsg.gameState,
            myHand: ackMsg.myHand
          });
          console.log('[Client] Reconnected successfully');
        } else {
          alert('重连失败：' + ackMsg.error);
        }
        break;

      case 'KEEPALIVE':
        // 收到房主心跳，无需处理
        break;
    }
  }

  /**
   * 客户端发送消息给房主
   */
  send(message: any) {
    const conn = this.connections.get('host');
    if (conn) {
      conn.send(message);
    } else {
      console.error('[Client] No connection to host');
    }
  }

  /**
   * 房主广播消息给所有客户端
   */
  private broadcastToClients(message: any, excludePeerId?: string) {
    this.connections.forEach((conn, peerId) => {
      if (peerId !== excludePeerId) {
        conn.send(message);
      }
    });
  }

  /**
   * 回到大厅（保持连接，重置游戏状态）
   */
  returnToLobby() {
    this.game = null;
    const players = this.buildPlayerList();

    if (this.isHostMode) {
      // 房主：通知所有客户端回到大厅
      this.broadcastToClients({
        type: 'RETURN_TO_LOBBY',
        timestamp: Date.now(),
        players
      });
    }

    this.updateState({
      room: { isGameRunning: false, players },
      gameState: null,
      myHand: null
    });
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.connections.forEach(conn => conn.close());
    this.connections.clear();
    this.peer?.destroy();
    this.peer = null;
    this.isHostMode = false;
    this.myPeerId = null;
    this.game = null;
    this.playerNames.clear();
    this.updateState({ room: { isConnected: false, isGameRunning: false } });
  }

  getIsHost(): boolean {
    return this.isHostMode;
  }

  getMyPeerId(): string | null {
    return this.isHostMode ? 'host' : this.myPeerId;
  }

  getGame(): Game | null {
    return this.game;
  }
}

// 单例
export const peerManager = new PeerConnectionManager();
