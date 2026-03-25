# UNO Online 🎴

实时多人在线 UNO 卡牌游戏 — 无需服务器，无需注册，即开即玩。

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![PeerJS](https://img.shields.io/badge/PeerJS-orange?style=flat)

**[English](./README.md)** | **中文**

## ✨ 特性

- **P2P 联机** — 基于 WebRTC，无需中心游戏服务器
- **房主权威模式** — 游戏逻辑在房主端运行，防止作弊
- **完整 UNO 规则** — 跳过、反转、+2、万能牌、+4、UNO 宣告、叠加
- **实时同步** — 所有玩家即时状态同步
- **游戏日志** — 实时事件流，每步操作清晰可见
- **手牌排序** — 自动按颜色和数值排序
- **响应式 UI** — 适配桌面和移动端
- **零注册** — 生成房间号，分享给朋友，直接开玩

## 🎮 怎么玩

1. 打开游戏，输入你的昵称
2. **创建房间** — 你成为房主，获得 6 位房间号
3. 把房间号分享给朋友（支持 2-4 人）
4. 朋友输入房间号加入
5. 房主点击 **开始游戏** — 每人发 7 张牌
6. 出牌规则：**颜色**或**数字/符号**匹配，或使用万能牌
7. 手牌剩 2 张时别忘了点 **UNO!**
8. 最先出完所有手牌的玩家获胜！🏆

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装 & 运行

```bash
git clone https://github.com/Easyhoov/uno-online.git
cd uno-online
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。

### 生产构建

```bash
npm run build
npm run preview
```

## 🏗️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 状态管理 | Zustand |
| P2P 通信 | PeerJS (WebRTC) |
| 样式 | CSS-in-JS (内联样式) |

## 📁 项目结构

```
src/
├── game/                 # 游戏核心引擎
│   ├── Card.ts           # 卡牌类型与辅助函数
│   ├── Deck.ts           # 牌堆管理（洗牌、抽牌、重洗）
│   ├── enums.ts          # CardColor、CardType 枚举
│   ├── Game.ts           # 游戏状态机（规则引擎）
│   └── Player.ts         # 玩家类（手牌管理）
├── p2p/                  # 网络通信层
│   ├── messages.ts       # P2P 消息协议
│   └── peerConnection.ts # PeerJS 连接管理器
├── store/
│   └── gameStore.ts      # Zustand 全局状态
├── components/
│   ├── Lobby.tsx          # 房间创建/加入界面
│   ├── GameTable.tsx      # 游戏主界面 + 事件日志
│   ├── CardComponent.tsx  # 卡牌渲染
│   └── ColorPicker.tsx    # 万能牌颜色选择器
├── App.tsx
├── App.css
├── index.css
└── main.tsx
```

## 🃏 游戏规则

| 卡牌 | 效果 |
|------|------|
| **数字牌** | 按颜色或数字匹配出牌 |
| **跳过** ⊘ | 下一位玩家失去回合 |
| **反转** ⇄ | 出牌方向反转（2人游戏中等同跳过） |
| **+2** | 下一位玩家抽 2 张牌（可叠加） |
| **万能牌** 🃏 | 任何时候可出，选择下一个颜色 |
| **+4** | 选择颜色，下一位玩家抽 4 张牌（可叠加） |
| **UNO 宣告** | 手牌剩 2 张时必须点 UNO，否则罚抽 2 张 |

## 🔧 架构设计

采用 **房主权威模式（Host-Authoritative）**：

```
房主（房间创建者）                  客户端（其他玩家）
┌──────────────────┐            ┌──────────────────┐
│  游戏引擎         │◄── 动作 ──│  UI + 预验证      │
│  （唯一真相源）    │── 状态 ──►│  （乐观更新）      │
│  规则验证         │            │                  │
└──────────────────┘            └──────────────────┘
         ▲                              ▲
         └──────── WebRTC P2P ──────────┘
```

- 所有游戏动作由房主验证
- 客户端只能看到自己的手牌（防偷看）
- 牌堆耗尽时自动将弃牌堆洗回

## 📝 许可证

MIT

## 🤝 贡献

欢迎 PR！有 Bug 或功能建议请开 Issue。
