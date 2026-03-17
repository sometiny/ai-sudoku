<template>
  <div class="room">
    <div class="header">
      <a-button @click="backToLobby">← 返回大厅</a-button>
      <h2 v-if="roomStore.room">{{ roomStore.room.name }}</h2>
      <a-tag v-if="roomStore.room" :color="getDifficultyColor(roomStore.room.difficulty)">
        {{ getDifficultyText(roomStore.room.difficulty) }}
      </a-tag>
    </div>

    <div class="content" v-if="roomStore.room && roomStore.room.state === 'waiting'">
      <div class="players-section">
        <h3>参与者 ({{ roomStore.players.length }})</h3>
        <div class="player-list">
          <div
            v-for="player in roomStore.players"
            :key="player.id"
            class="player-item"
            :class="{ host: player.role === 'host' }"
          >
            <a-avatar>{{ player.nickname[0].toUpperCase() }}</a-avatar>
            <span class="player-name">{{ player.nickname }}</span>
            <a-tag v-if="player.role === 'host'" color="gold">房主</a-tag>
          </div>
        </div>
      </div>

      <div class="spectators-section" v-if="roomStore.spectators.length > 0">
        <h3>旁观者 ({{ roomStore.spectators.length }})</h3>
        <div class="player-list">
          <div v-for="player in roomStore.spectators" :key="player.id" class="player-item">
            <a-avatar>{{ player.nickname[0].toUpperCase() }}</a-avatar>
            <span class="player-name">{{ player.nickname }}</span>
            <a-tag color="default">旁观</a-tag>
          </div>
        </div>
      </div>

      <div class="actions" v-if="roomStore.isPlayer || roomStore.isHost">
        <div v-if="gameStore.countdown > 0" class="countdown-section">
          <a-result
            status="info"
            title="等待玩家确认"
            :sub-title="`游戏将在 ${gameStore.countdown} 秒后开始`"
          >
            <template #extra>
              <a-button type="primary" size="large" @click="agreeToStart">
                同意开始
              </a-button>
            </template>
          </a-result>
        </div>
        <a-button
          v-else
          type="primary"
          size="large"
          :disabled="!roomStore.isHost && roomStore.players.length < 2"
          @click="startGame"
        >
          {{ roomStore.isHost ? '开始游戏' : '等待房主开始' }}
        </a-button>
        
        <a-button v-if="!roomStore.isHost" danger @click="leaveRoom">离开房间</a-button>
      </div>

      <div class="spectator-enter" v-if="!roomStore.isPlayer && !roomStore.isSpectator">
        <a-button type="primary" @click="joinAsSpectator">进入旁观</a-button>
      </div>

      <div class="spectator-actions" v-if="roomStore.isSpectator">
        <a-button @click="leaveRoom">离开房间</a-button>
      </div>
    </div>

    <div class="content" v-else-if="roomStore.room && roomStore.room.state === 'ready'">
      <a-result
        status="info"
        title="等待玩家确认"
        :sub-title="`游戏将在 ${gameStore.countdown} 秒后开始`"
      >
        <template #extra v-if="roomStore.isPlayer">
          <a-button type="primary" size="large" @click="agreeToStart">
            同意开始
          </a-button>
        </template>
      </a-result>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { useRoomStore } from '../stores/room'
import { useGameStore } from '../stores/game'
import { useSocket } from '../composables/useSocket'
import type { Difficulty } from '../types'

const router = useRouter()
const route = useRoute()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const { getSocket } = useSocket()

const roomId = route.params.roomId as string

let countdownInterval: number | null = null

onMounted(() => {
  const socket = getSocket()
  if (!socket) {
    message.error('连接失败，请刷新页面')
    return
  }

  socket.on('room:update', (room) => {
    if (room.id === roomId) {
      roomStore.setRoom(room as any)
      
      if (room.state === 'playing') {
        router.push(`/game/${roomId}`)
      }
    }
  })

  socket.on('game:prepare', (timeout) => {
    gameStore.setCountdown(timeout)
    startCountdown(timeout)
  })

  socket.on('game:start', () => {
    gameStore.setCountdown(10)
    startCountdown(10)
  })

  socket.on('game:kick', () => {
    message.error('您已被踢出房间')
    roomStore.clearRoom()
    router.push('/')
  })

  socket.on('game:ready', ({ playerId }) => {
    const player = roomStore.players.find(p => p.id === playerId)
    if (player) {
      message.success(`${player.nickname} 已同意开始`)
    }
  })

  socket.on('game:begin', (puzzle) => {
    gameStore.setPuzzle(puzzle)
    router.push(`/game/${roomId}`)
  })

  socket.emit('room:join', {
    roomId,
    nickname: localStorage.getItem('nickname') || '玩家',
    role: 'player'
  })
})

onUnmounted(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }
})

const startCountdown = (seconds: number) => {
  if (countdownInterval) {
    clearInterval(countdownInterval)
  }
  
  let remaining = seconds
  countdownInterval = window.setInterval(() => {
    remaining--
    gameStore.setCountdown(remaining)
    
    if (remaining <= 0) {
      if (countdownInterval) {
        clearInterval(countdownInterval)
        countdownInterval = null
      }
    }
  }, 1000) as unknown as number
}

const getDifficultyColor = (difficulty: Difficulty) => {
  const colors = { easy: 'green', medium: 'orange', hard: 'red' }
  return colors[difficulty]
}

const getDifficultyText = (difficulty: Difficulty) => {
  const texts = { easy: '简单', medium: '中等', hard: '困难' }
  return texts[difficulty]
}

const startGame = () => {
  getSocket()?.emit('game:start', { roomId })
}

const agreeToStart = () => {
  getSocket()?.emit('game:ready', { roomId })
}

const leaveRoom = () => {
  getSocket()?.emit('room:leave', { roomId })
  roomStore.clearRoom()
  router.push('/')
}

const backToLobby = () => {
  leaveRoom()
}

const joinAsSpectator = () => {
  getSocket()?.emit('room:join', {
    roomId,
    nickname: localStorage.getItem('nickname') || '玩家',
    role: 'spectator'
  })
}
</script>

<style scoped>
.room {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 30px;
}

.header h2 {
  flex: 1;
  margin: 0;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.players-section,
.spectators-section {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
}

.players-section h3,
.spectators-section h3 {
  margin-bottom: 12px;
  color: #333;
}

.player-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border-radius: 8px;
}

.player-item.host {
  border: 1px solid #gold;
}

.player-name {
  font-weight: 500;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.countdown-section {
  width: 100%;
}

.spectator-enter,
.spectator-actions {
  display: flex;
  justify-content: center;
}
</style>
