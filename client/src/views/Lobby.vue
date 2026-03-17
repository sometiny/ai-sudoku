<template>
  <div class="lobby">
    <div class="header">
      <h1>Sudoku 多人对战</h1>
      <div class="nickname-section">
        <a-input
          v-model:value="nickname"
          placeholder="请输入昵称"
          style="width: 200px"
          @pressEnter="saveNickname"
        >
          <template #addonAfter>
            <a-button type="primary" @click="saveNickname">保存</a-button>
          </template>
        </a-input>
      </div>
    </div>

    <div class="content">
      <div class="actions">
        <a-button type="primary" size="large" @click="showCreateModal = true">
          创建房间
        </a-button>
        <a-button size="large" @click="refreshRooms">
          刷新列表
        </a-button>
      </div>

      <div class="room-list">
        <a-card v-if="rooms.length === 0" class="empty-card">
          <a-empty description="暂无房间，创建一个吧！" />
        </a-card>
        <a-card
          v-for="room in rooms"
          :key="room.id"
          class="room-card"
          hoverable
          @click="joinRoom(room.id)"
        >
          <template #title>
            <div class="room-title">{{ room.name }}</div>
          </template>
          <div class="room-info">
            <a-tag :color="getDifficultyColor(room.difficulty)">
              {{ getDifficultyText(room.difficulty) }}
            </a-tag>
            <span class="player-count">
              {{ room.playerCount }} / {{ room.maxPlayers }} 玩家
            </span>
          </div>
        </a-card>
      </div>
    </div>

    <a-modal
      v-model:open="showCreateModal"
      title="创建房间"
      @ok="createRoom"
    >
      <a-form :model="createForm" layout="vertical">
        <a-form-item label="房间名称" required>
          <a-input
            v-model:value="createForm.name"
            placeholder="输入房间名称"
            maxlength="20"
          />
        </a-form-item>
        <a-form-item label="难度" required>
          <a-select v-model:value="createForm.difficulty">
            <a-select-option value="easy">简单 (35 空)</a-select-option>
            <a-select-option value="medium">中等 (45 空)</a-select-option>
            <a-select-option value="hard">困难 (55 空)</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useSocket } from '../composables/useSocket'
import type { RoomInfo, Difficulty } from '../types'

const router = useRouter()
const { connect, getSocket } = useSocket()

const nickname = ref('')
const rooms = ref<RoomInfo[]>([])
const showCreateModal = ref(false)
const createForm = ref({
  name: '',
  difficulty: 'medium' as Difficulty
})

onMounted(() => {
  nickname.value = localStorage.getItem('nickname') || ''
  if (!localStorage.getItem('playerId')) {
    localStorage.setItem('playerId', 'player_' + Math.random().toString(36).slice(2))
  }
  
  const socket = connect(nickname.value || undefined)
  
  socket.on('room:list', (roomList) => {
    rooms.value = roomList
  })
  
  socket.emit('room:list')
})

const saveNickname = () => {
  if (!nickname.value.trim()) {
    message.warning('请输入昵称')
    return
  }
  localStorage.setItem('nickname', nickname.value.trim())
  message.success('昵称已保存')
  
  const socket = getSocket()
  if (socket) {
    socket.disconnect()
    connect(nickname.value)
  }
}

const refreshRooms = () => {
  getSocket()?.emit('room:list')
}

const getDifficultyColor = (difficulty: Difficulty) => {
  const colors = { easy: 'green', medium: 'orange', hard: 'red' }
  return colors[difficulty]
}

const getDifficultyText = (difficulty: Difficulty) => {
  const texts = { easy: '简单', medium: '中等', hard: '困难' }
  return texts[difficulty]
}

const createRoom = () => {
  if (!createForm.value.name.trim()) {
    message.warning('请输入房间名称')
    return
  }
  
  getSocket()?.emit('room:create', createForm.value)
  showCreateModal.value = false
  
  const socket = getSocket()
  if (socket) {
    socket.once('room:update', (room) => {
      router.push(`/room/${room.id}`)
    })
  }
  
  createForm.value = { name: '', difficulty: 'medium' }
}

const joinRoom = (roomId: string) => {
  const nickname = localStorage.getItem('nickname')
  if (!nickname) {
    message.warning('请先设置昵称')
    return
  }
  
  getSocket()?.emit('room:join', {
    roomId,
    nickname,
    role: 'player'
  })
  
  const socket = getSocket()
  if (socket) {
    socket.once('room:update', (room) => {
      if (room.id === roomId) {
        router.push(`/room/${roomId}`)
      }
    })
    socket.once('room:error', (error) => {
      message.error(error)
    })
  }
}
</script>

<style scoped>
.lobby {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.header h1 {
  font-size: 28px;
  color: #1890ff;
}

.actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.room-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.room-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.room-card:hover {
  transform: translateY(-2px);
}

.room-title {
  font-weight: 600;
  font-size: 16px;
}

.room-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-count {
  color: #666;
  font-size: 14px;
}

.empty-card {
  grid-column: 1 / -1;
}
</style>
