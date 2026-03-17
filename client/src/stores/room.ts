import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Room, Player } from '../types'
import { useSocket } from '../composables/useSocket'

export const useRoomStore = defineStore('room', () => {
  const room = ref<Room | null>(null)
  const players = ref<Player[]>([])
  const spectators = ref<Player[]>([])

  const getCurrentPlayerId = () => {
    const { getSocket } = useSocket()
    const socket = getSocket()
    return socket?.id || localStorage.getItem('playerId')
  }

  const isHost = computed(() => {
    if (!room.value) return false
    return room.value.hostId === getCurrentPlayerId()
  })

  const isPlayer = computed(() => {
    if (!room.value) return false
    return players.value.some(p => p.id === getCurrentPlayerId())
  })

  const isSpectator = computed(() => {
    if (!room.value) return false
    return spectators.value.some(p => p.id === getCurrentPlayerId())
  })

  function setRoom(newRoom: Room & { players: Player[]; spectators: Player[] }) {
    const { players: p, spectators: s, ...rest } = newRoom
    room.value = rest as Room
    players.value = p
    spectators.value = s
  }

  function clearRoom() {
    room.value = null
    players.value = []
    spectators.value = []
  }

  return {
    room,
    players,
    spectators,
    isHost,
    isPlayer,
    isSpectator,
    setRoom,
    clearRoom
  }
})
