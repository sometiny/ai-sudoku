# Sudoku 多人对战游戏 - 开发指南

## 技术栈

- 前端：Vue 3 + TypeScript + Vite + Ant Design Vue
- 后端：Node.js + Express + Socket.io + TypeScript
- 数据：内存存储（无数据库）

## 核心命令

除了你自己开发、调试，不要帮用户启动任何node服务。

```bash
# 前端开发
cd client && npm run dev

# 后端开发
cd server && npm run dev

# 类型检查
npm run typecheck

# 代码检查
npm run lint
```

## 项目结构

```
sudoku/
├── client/                    # 前端
│   ├── src/
│   │   ├── components/       # UI组件
│   │   │   ├── SudokuBoard.vue
│   │   │   ├── NumberPad.vue
│   │   │   ├── Leaderboard.vue
│   │   │   └── Timer.vue
│   │   ├── composables/      # 组合式函数
│   │   │   └── useSocket.ts
│   │   ├── stores/           # Pinia状态管理
│   │   │   ├── room.ts
│   │   │   └── game.ts
│   │   ├── views/            # 页面视图
│   │   │   ├── Lobby.vue
│   │   │   ├── Room.vue
│   │   │   └── Game.vue
│   │   ├── types/            # TypeScript类型定义
│   │   │   └── index.ts
│   │   ├── App.vue
│   │   └── main.ts
│   ├── package.json
│   └── vite.config.ts
├── server/                    # 后端
│   ├── src/
│   │   ├── rooms/            # 房间管理
│   │   │   ├── RoomManager.ts
│   │   │   └── Room.ts
│   │   ├── game/             # 游戏逻辑
│   │   │   ├── SudokuGenerator.ts
│   │   │   └── GameSession.ts
│   │   ├── store/            # 内存存储
│   │   │   └── MemoryStore.ts
│   │   ├── socket/           # Socket事件处理
│   │   │   └── handlers.ts
│   │   ├── types/            # TypeScript类型定义
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── AGENT.md
├── PRO.md
└── TASKS.md
```

## 开发规范

### 通用规范

- 使用 TypeScript，开启严格类型检查
- 提交信息遵循 Conventional Commits（feat/fix/docs/style/refactor/test）
- 代码风格使用 ESLint + Prettier 统一

### 前端规范

- 组件使用 `<script setup lang="ts">` 语法
- 样式使用 scoped CSS
- 状态管理使用 Pinia
- 组件命名采用 PascalCase
- 文件命名采用 PascalCase（组件）或 camelCase（工具函数）

### 后端规范

- 使用 ES Module 语法
- 异步操作使用 async/await
- 错误处理使用 try-catch
- Socket 事件名使用 `模块:动作` 格式（如 `room:join`, `game:start`）

## 关键实现要点

### 数独生成算法

```typescript
// 核心思路：
// 1. 回溯法生成完整解
// 2. 根据难度随机挖空
// 3. 难度映射：easy(35空), medium(45空), hard(55空)

function generatePuzzle(difficulty: 'easy' | 'medium' | 'hard'): number[][] {
  const solution = generateSolution();  // 完整数独
  const holes = { easy: 35, medium: 45, hard: 55 }[difficulty];
  return removeNumbers(solution, holes);
}
```

### 10秒同意逻辑流程

```
房主点击开始
    ↓
服务端检查人数 ≥ 2
    ↓
广播 game:prepare 事件
    ↓
启动 10 秒倒计时
    ↓
玩家收到后显示"同意"按钮
    ↓
玩家点击 → 发送 game:ready
    ↓
服务端记录 readyVotes[playerId] = true
    ↓
10秒后：
  - 未 ready 的玩家 → 踢出
  - 剩余玩家 ≥ 2 → 开始游戏
  - 剩余玩家 < 2 → 取消开始，等待更多玩家
```

### 断线重连

```typescript
// 使用 playerId 存储在 localStorage
// 断线后重连，发送 reconnect 事件
socket.emit('reconnect', { playerId, roomId });
// 服务端恢复玩家状态
```

## Socket.io 事件列表

| 事件名 | 方向 | 描述 |
|--------|------|------|
| `room:create` | C→S | 创建房间 |
| `room:join` | C→S | 加入房间 |
| `room:leave` | C→S | 离开房间 |
| `room:list` | C→S | 获取房间列表 |
| `room:update` | S→C | 房间状态更新 |
| `game:start` | C→S | 房主发起开始 |
| `game:ready` | C→S | 玩家同意开始 |
| `game:kick` | S→C | 玩家被踢出 |
| `game:begin` | S→C | 游戏正式开始 |
| `game:progress` | C→S | 玩家进度更新 |
| `game:leaderboard` | S→C | 排行榜更新 |
| `game:finish` | C→S | 玩家完成游戏 |
| `game:end` | S→C | 游戏结束 |