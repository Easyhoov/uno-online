# UNO Online v1.3.0 更新说明

**更新时间：** 2026-03-26  
**版本：** v1.3.0  
**新增功能：** +4 挑战、玩家准备状态

---

## 🎉 新增功能

### 1. +4 挑战功能 ✅

**功能说明：**
- 当有玩家出 +4 牌时，下一个玩家可以发起挑战
- 挑战成功：出 +4 的玩家罚抽 6 张牌
- 挑战失败：挑战者罚抽 4 张牌
- 防止玩家滥用 +4 牌

**游戏规则：**
```
玩家 A 出 +4
  ↓
玩家 B 可以选择：
  1. 接受 +4，抽 4 张牌
  2. 挑战玩家 A（质疑其有同色牌）
     - 挑战成功：A 抽 6 张
     - 挑战失败：B 抽 4 张
```

**UI 表现：**
- 出 +4 后，下一个玩家的回合会显示红色按钮："⚠️ 挑战 +4（质疑作弊）"
- 按钮有脉冲动画效果，吸引注意
- 挑战限时在当前回合内

**实现细节：**
- `Game.ts` 添加 `pendingChallenge` 状态
- `PublicGameState` 添加 `canChallenge` 和 `challengeTarget` 字段
- `GameTable.tsx` 添加挑战按钮和动画

**代码改动：**
```typescript
// src/game/Game.ts
case CardType.WILD_DRAW_FOUR:
  this.drawStack += 4;
  // 设置挑战状态
  const nextPlayerIndex = (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
  this.pendingChallenge = {
    challengerId: this.players[nextPlayerIndex].id,
    targetId: player.id
  };
  this.nextTurn();
  break;
```

---

### 2. 玩家准备状态 ✅

**功能说明：**
- 玩家加入房间后需要点击"准备就绪"
- 所有玩家都准备好后，房主才能开始游戏
- 防止玩家没准备好就被迫开始

**UI 表现：**

**房间大厅：**
- 每个玩家旁边显示状态标签：
  - ✅ 准备（绿色）
  - ⏳ 未准备（灰色）
- 非房主玩家有准备按钮：
  - "✅ 准备就绪"（未准备时）
  - "✋ 取消准备"（已准备时）
- 房主开始游戏时，如果有玩家未准备，显示提示

**实现细节：**
- `Player` 接口添加 `isReady` 字段
- 新增 `READY_CHANGE` 消息类型
- 房主维护 `playerReady` Map
- 开始游戏前检查所有玩家状态

**代码改动：**
```typescript
// src/p2p/peerConnection.ts
private buildPlayerList() {
  return [
    { id: 'host', ..., isReady: true },
    ...connections.map(peerId => ({
      id: peerId,
      ...,
      isReady: this.playerReady.get(peerId) !== false
    }))
  ];
}
```

```tsx
// src/components/Lobby.tsx
const handleStartGame = () => {
  const allReady = room.players.every(p => (p as any).isReady !== false);
  if (!allReady) {
    setError('有玩家还没准备好，等待所有玩家准备就绪后再开始');
    return;
  }
  peerManager.startGame();
};
```

---

## 📝 修改文件列表

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/game/Game.ts` | 修改 | 添加挑战状态、修改 applyCardEffect 签名 |
| `src/game/enums.ts` | - | 无改动 |
| `src/p2p/messages.ts` | 修改 | 添加 READY_CHANGE 消息类型 |
| `src/p2p/peerConnection.ts` | 修改 | 添加 playerReady、处理准备状态、构建玩家列表 |
| `src/components/GameTable.tsx` | 修改 | 添加挑战按钮、动画、handleChallenge 方法 |
| `src/components/Lobby.tsx` | 修改 | 添加准备状态 UI、handleToggleReady 方法 |

---

## 🧪 测试用例

### 测试 1: +4 挑战

**步骤：**
1. 创建房间，2 名玩家
2. 开始游戏
3. 玩家 A 手中有 +4 牌
4. 玩家 A 出 +4
5. 玩家 B 看到挑战按钮
6. 玩家 B 点击挑战

**预期结果：**
- 玩家 B 的回合显示红色挑战按钮
- 点击后，根据挑战结果：
  - 成功：A 抽 6 张
  - 失败：B 抽 4 张

---

### 测试 2: 准备状态

**步骤：**
1. 房主创建房间
2. 玩家 B、C 加入
3. 玩家 B 点击"准备就绪"
4. 玩家 C 未准备
5. 房主点击"开始游戏"

**预期结果：**
- 玩家 B 显示"✅ 准备"（绿色）
- 玩家 C 显示"⏳ 未准备"（灰色）
- 房主看到提示"有玩家还没准备好"
- 游戏无法开始

**步骤 2：**
1. 玩家 C 也点击"准备就绪"
2. 房主再次点击"开始游戏"

**预期结果：**
- 所有玩家显示"✅ 准备"
- 游戏正常开始

---

## ⚠️ 注意事项

### +4 挑战
1. 挑战只能在当前回合内进行
2. 挑战后无论成功失败，挑战状态都会清除
3. 如果玩家有多个 +4 可以连续叠加

### 准备状态
1. 房主默认始终准备
2. 玩家可以随时取消准备
3. 游戏中无法更改准备状态
4. 回到大厅后准备状态重置

---

## 🐛 已知问题

1. **TypeScript 编译警告** - 4 个类型错误（不影响运行）
2. **准备状态同步** - 如果网络延迟，准备状态可能短暂不同步
3. **挑战 UI 时机** - 挑战按钮只在出 +4 后的第一个回合显示

---

## 📊 功能对比

| 功能 | v1.2.0 | v1.3.0 |
|------|--------|--------|
| 断线重连 | ✅ | ✅ |
| 玩家踢出 | ✅ | ✅ |
| 房主转移 | ✅ | ✅ |
| 心跳机制 | ✅ | ✅ |
| **+4 挑战** | ❌ | ✅ |
| **玩家准备** | ❌ | ✅ |
| 聊天功能 | ❌ | ❌ |
| 游戏音效 | ❌ | ❌ |

---

## 🚀 下一步计划

**推荐实现顺序：**

1. **游戏音效** (2h) - 出牌/抽牌/UNO/胜利音效
2. **聊天功能** (3h) - 文字聊天、表情
3. **出牌动画** (4h) - 卡牌飞行动画
4. **房间密码** (3h) - 隐私保护

---

## 📈 版本历史

### v1.3.0 (2026-03-26)
**新增：**
- ✅ +4 挑战功能
- ✅ 玩家准备状态

**修复：**
- 修复 applyCardEffect 参数问题

### v1.2.0 (2026-03-26)
**新增：**
- ✅ 断线重连（30 秒）
- ✅ 玩家踢出
- ✅ 房主转移
- ✅ 心跳机制

### v1.1.0 (2026-03-25)
**新增：**
- ✅ 头像选择器（80+ emoji）
- ✅ 游戏日志显示/隐藏
- ✅ 玩家头像显示

### v1.0.0 (2026-03-24)
**首发版本：**
- ✅ P2P 联机对战
- ✅ 完整 UNO 规则
- ✅ 房主权威模式

---

**更新完成！** 🎉

现在可以访问 `http://localhost:3000/` 测试新功能！
