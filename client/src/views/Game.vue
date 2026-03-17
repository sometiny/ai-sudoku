<template>
  <div class="game">
    <div class="header">
      <h2>数独对战</h2>
      <div class="timer">
        <a-typography-text type="secondary">时间：</a-typography-text>
        <a-typography-text class="time-text">
          {{ formatTime(gameStore.elapsedTime) }}
        </a-typography-text>
      </div>
    </div>

    <div class="game-content">
      <div class="board-section">
        <div class="sudoku-board">
          <div
            v-for="(row, rowIndex) in gameStore.playerProgress"
            :key="rowIndex"
            class="board-row"
          >
            <div
              v-for="(cell, colIndex) in row"
              :key="colIndex"
              class="cell"
              :class="[
                getCellClass(rowIndex, colIndex),
                { selected: selectedCell?.[0] === rowIndex && selectedCell?.[1] === colIndex },
                { error: gameStore.isErrorCell(rowIndex, colIndex) }
              ]"
              @click="selectCell(rowIndex, colIndex)"
            >
              {{ cell !== 0 ? cell : '' }}
            </div>
          </div>
        </div>

        <div class="number-pad">
          <a-button
            v-for="num in 9"
            :key="num"
            size="large"
            @click="inputNumber(num)"
          >
            {{ num }}
          </a-button>
          <a-button size="large" danger @click="inputNumber(0)">
            删除
          </a-button>
        </div>
      </div>

      <div class="leaderboard-section">
        <h3>排行榜</h3>
        <a-table
          :columns="leaderboardColumns"
          :data-source="gameStore.leaderboard"
          :pagination="false"
          size="small"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'rank'">
              <span :class="getRankClass(record.rank || index + 1)">
                {{ record.rank || index + 1 }}
              </span>
            </template>
            <template v-if="column.key === 'progress'">
              <a-progress
                :percent="Math.round((record.progress / 81) * 100)"
                :stroke-color="getProgressColor(record.progress)"
              />
            </template>
            <template v-if="column.key === 'time'">
              {{ record.time > 0 ? formatTime(record.time) : '-' }}
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <a-modal
      v-model:open="showResults"
      title="游戏结束"
      :footer="null"
      width="600px"
    >
      <a-table
        :columns="resultColumns"
        :data-source="gameStore.gameResults"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'rank'">
            <span :class="getRankClass(record.rank)">
              {{ record.rank }}
            </span>
          </template>
          <template v-if="column.key === 'time'">
            {{ record.isFinished ? formatTime(record.time) : '未完成' }}
          </template>
        </template>
      </a-table>
      <div class="result-actions">
        <a-button @click="backToLobby">返回大厅</a-button>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { useRoomStore } from '../stores/room'
import { useGameStore } from '../stores/game'
import { useSocket } from '../composables/useSocket'

const router = useRouter()
const route = useRoute()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const { getSocket } = useSocket()

const roomId = route.params.roomId as string
const selectedCell = ref<[number, number] | null>(null)
const showResults = ref(false)

const leaderboardColumns = [
  { key: 'rank', title: '排名', width: 60 },
  { key: 'nickname', title: '玩家' },
  { key: 'progress', title: '进度' },
  { key: 'time', title: '用时' }
]

const resultColumns = [
  { key: 'rank', title: '排名', width: 80 },
  { key: 'nickname', title: '玩家' },
  { key: 'time', title: '用时' }
]

onMounted(() => {
  const socket = getSocket()
  if (!socket) {
    message.error('连接失败')
    return
  }

  if (gameStore.puzzle.length > 0 && gameStore.gameState !== 'finished') {
    gameStore.setGameState('playing')
    gameStore.startTimer()
  }

  socket.on('game:begin', (puzzle) => {
    console.log('Game received puzzle:', puzzle)
    gameStore.setPuzzle(puzzle)
    gameStore.setGameState('playing')
    gameStore.startTimer()
  })

  socket.on('game:leaderboard', (leaderboard) => {
    gameStore.setLeaderboard(leaderboard)
  })

  socket.on('game:end', (results) => {
    gameStore.setResults(results)
    gameStore.setGameState('finished')
    gameStore.stopTimer()
    showResults.value = true
  })

  socket.on('room:update', (room) => {
    if (room.state === 'finished' && !showResults.value) {
      socket.emit('game:finish', { roomId, time: gameStore.elapsedTime })
    }
  })
})

onUnmounted(() => {
  gameStore.stopTimer()
})

const formatTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  const centiseconds = Math.floor((ms % 1000) / 10)
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`
}

const getCellClass = (row: number, col: number) => {
  const classes: string[] = []
  
  if (row % 3 === 2 && row !== 8) classes.push('border-bottom')
  if (col % 3 === 2 && col !== 8) classes.push('border-right')
  
  const puzzle = gameStore.puzzle
  if (puzzle && puzzle[row][col] !== 0) {
    classes.push('initial')
  }
  
  return classes.join(' ')
}

const selectCell = (row: number, col: number) => {
  selectedCell.value = [row, col]
}

const inputNumber = (num: number) => {
  if (!selectedCell.value) {
    message.warning('请先选择一个格子')
    return
  }

  const [row, col] = selectedCell.value
  const puzzle = gameStore.puzzle
  
  if (puzzle[row][col] !== 0) {
    message.warning('不能修改初始数字')
    return
  }

  gameStore.updateCell(row, col, num)
  
  getSocket()?.emit('game:progress', {
    roomId,
    progress: gameStore.playerProgress
  })

  if (isComplete()) {
    getSocket()?.emit('game:finish', {
      roomId,
      time: gameStore.elapsedTime
    })
  }
}

const isComplete = () => {
  const progress = gameStore.playerProgress
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if (progress[i][j] === 0) return false
    }
  }
  return true
}

const getRankClass = (rank: number) => {
  if (rank === 1) return 'rank-gold'
  if (rank === 2) return 'rank-silver'
  if (rank === 3) return 'rank-bronze'
  return ''
}

const getProgressColor = (progress: number) => {
  if (progress === 81) return '#52c41a'
  if (progress > 60) return '#1890ff'
  if (progress > 30) return '#faad14'
  return '#ff4d4f'
}

const backToLobby = () => {
  roomStore.clearRoom()
  gameStore.resetGame()
  router.push('/')
}
</script>

<style scoped>
.game {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h2 {
  margin: 0;
}

.timer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
}

.time-text {
  font-family: monospace;
  font-size: 20px;
  font-weight: 600;
}

.game-content {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
}

.board-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.sudoku-board {
  display: inline-grid;
  grid-template-columns: repeat(9, 40px);
  grid-template-rows: repeat(9, 40px);
  border: 2px solid #333;
  background: #fff;
}

.board-row {
  display: contents;
}

.cell {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #ddd;
  cursor: pointer;
  font-size: 18px;
  font-weight: 600;
  transition: background 0.2s;
}

.cell:hover {
  background: #e6f7ff;
}

.cell.selected {
  background: #bae7ff;
}

.cell.initial {
  background: #f5f5f5;
  color: #333;
}

.cell.error {
  color: #ff4d4f;
  font-weight: bold;
}

.cell.border-bottom {
  border-bottom: 2px solid #333;
}

.cell.border-right {
  border-right: 2px solid #333;
}

.number-pad {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  width: 100%;
  max-width: 400px;
}

.number-pad .ant-btn {
  height: 48px;
  font-size: 18px;
  font-weight: 600;
}

.leaderboard-section {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
  height: fit-content;
}

.leaderboard-section h3 {
  margin-bottom: 12px;
}

.rank-gold {
  color: #faad14;
  font-weight: bold;
  font-size: 18px;
}

.rank-silver {
  color: #bfbfbf;
  font-weight: bold;
  font-size: 16px;
}

.rank-bronze {
  color: #d48806;
  font-weight: bold;
  font-size: 16px;
}

.result-actions {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .game-content {
    grid-template-columns: 1fr;
  }
  
  .sudoku-board {
    grid-template-columns: repeat(9, 32px);
    grid-template-rows: repeat(9, 32px);
  }
  
  .cell {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }
}
</style>
