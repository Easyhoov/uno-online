import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { Message, JoinAckMessage } from './messages';
import { createMessage } from './messages';
import { Game } from '../game/Game';

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
  private hostName: string = '房主';

  setStateCallback(callback: (state: any) => void) {
    this.onStateUpdate = callback;
  }

  /**
   * 初始化 Peer（房主模式）
   */
  async initializeAsHost(roomId: string, hostName: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const peerId = `uno-${roomId}`;
      this.isHostMode = true;
      this.hostName = hostName || '房主';

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
        this.updateState({
          room: { roomId, isHost: true, isConnected: true, players: [{ id: 'host', name: this.hostName, isHost: true, isReady: true }] }
        });
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this.setupHostConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('[Host] Peer error:', err);
        reject(err);
      });
    });
  }

  /**
   * 初始化 Peer（客户端模式）
   */
  async initializeAsClient(hostPeerId: string, playerName: string, roomId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.isHostMode = false;

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
          metadata: { playerName, roomId }
        });

        conn.on('open', () => {
          console.log('[Client] Connected to host');
          this.connections.set('host', conn);
          this.updateState({
            room: { roomId, isHost: false, isConnected: true }
          });
          resolve(myId);
        });

        conn.on('data', (data: any) => {
          this.handleClientMessage(data as Message);
        });

        conn.on('close', () => {
          console.log('[Client] Disconnected from host');
          this.updateState({ room: { isConnected: false } });
        });

        conn.on('error', (err) => {
          console.error('[Client] Connection error:', err);
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        console.error('[Client] Peer error:', err);
        reject(err);
      });
    });
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
    const clientPeerId = conn.peer;

    conn.on('open', () => {
      console.log('[Host] New player:', clientPeerId, playerName);
      this.connections.set(clientPeerId, conn);
      this.playerNames.set(clientPeerId, playerName);

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
        player: { id: clientPeerId, name: playerName, isHost: false },
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
      this.playerNames.delete(clientPeerId);
      const players = this.buildPlayerList();
      this.broadcastToClients({
        type: 'PLAYER_LEFT',
        timestamp: Date.now(),
        playerId: clientPeerId,
        players
      });
      this.updateState({ room: { players } });
    });
  }

  /**
   * 构建玩家列表
   */
  private buildPlayerList() {
    return [
      { id: 'host', name: this.playerNames.get('host') || this.hostName, isHost: true, isReady: true },
      ...Array.from(this.connections.keys()).map(peerId => ({
        id: peerId,
        name: this.playerNames.get(peerId) || 'Player',
        isHost: false,
        isReady: true
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
    }
  }

  /**
   * 房主：开始游戏
   */
  startGame() {
    if (!this.isHostMode) return;

    console.log('[Host] Starting game...');
    this.game = new Game();

    // 添加房主
    this.game.addPlayer(this.hostName, true, 'host');

    // 添加所有客户端，使用他们的 peerId 作为游戏内 ID
    for (const [peerId] of this.connections) {
      const name = this.playerNames.get(peerId) || 'Player';
      this.game.addPlayer(name, false, peerId);
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
   * 房主：处理游戏动作（来自客户端或房主自己）
   */
  processGameAction(fromId: string, action: any) {
    if (!this.game) {
      console.error('[Host] No active game');
      return;
    }

    // 确保 action.playerId 和 fromId 一致（防作弊）
    action.playerId = fromId;

    console.log('[Host] Processing action:', fromId, action.type);
    const result = this.game.processAction(action);

    if (result.valid) {
      const gameState = this.game.getPublicState();

      // 广播状态给所有客户端
      for (const [peerId, conn] of this.connections) {
        const hand = this.game.getPlayerHand(peerId);
        conn.send({
          type: 'STATE_UPDATE',
          timestamp: Date.now(),
          gameState
        });
        conn.send({
          type: 'HAND_UPDATE',
          timestamp: Date.now(),
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
          this.updateState({ room: { players: (data as any).players } });
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
        console.error('[Client] Error:', (data as any).message);
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
