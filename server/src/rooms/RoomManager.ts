import { v4 as uuidv4 } from 'uuid'
import type { Room, Player, Difficulty, RoomState } from '../types'
import { store } from '../store/MemoryStore'

export class RoomManager {
  createRoom(name: string, difficulty: Difficulty, hostId: string, hostNickname: string): Room {
    const roomId = uuidv4().slice(0, 8)
    
    const host: Player = {
      id: hostId,
      nickname: hostNickname,
      role: 'host',
      isReady: false,
      joinedAt: Date.now()
    }

    const room: Room = {
      id: roomId,
      name,
      difficulty,
      hostId,
      state: 'waiting',
      playerCount: 1,
      maxPlayers: 100,
      createdAt: Date.now(),
      players: new Map([[hostId, host]]),
      spectators: new Map(),
      readyVotes: new Set()
    }

    store.createRoom(room)
    return room
  }

  joinRoom(
    roomId: string,
    playerId: string,
    nickname: string,
    role: 'player' | 'spectator'
  ): Room | null {
    const room = store.getRoom(roomId)
    if (!room || room.state !== 'waiting') return null

    if (room.players.has(playerId) || room.spectators.has(playerId)) {
      return room
    }

    const player: Player = {
      id: playerId,
      nickname,
      role,
      isReady: false,
      joinedAt: Date.now()
    }

    if (role === 'spectator') {
      room.spectators.set(playerId, player)
    } else {
      room.players.set(playerId, player)
      room.playerCount = room.players.size
    }

    store.updateRoom(room)
    return room
  }

  leaveRoom(roomId: string, playerId: string): Room | null {
    const room = store.getRoom(roomId)
    if (!room) return null

    const isHost = room.hostId === playerId
    const wasPlayer = room.players.has(playerId)
    
    room.players.delete(playerId)
    room.spectators.delete(playerId)
    
    if (wasPlayer) {
      room.playerCount = room.players.size
    }

    if (isHost && room.players.size > 0) {
      const newHost = room.players.values().next().value
      if (newHost) {
        room.hostId = newHost.id
        newHost.role = 'host'
      }
    }

    if (room.players.size === 0 && room.spectators.size === 0) {
      if (room.readyTimeout) {
        clearTimeout(room.readyTimeout)
      }
      store.deleteRoom(roomId)
      return null
    }

    store.updateRoom(room)
    return room
  }

  getRoomList(): Room[] {
    return store.getAllRooms().filter(room => room.state === 'waiting')
  }

  setRoomReady(roomId: string): Room | null {
    const room = store.getRoom(roomId)
    if (!room) return null

    room.state = 'ready'
    room.readyVotes.clear()
    store.updateRoom(room)
    return room
  }

  setRoomState(roomId: string, state: RoomState): Room | null {
    const room = store.getRoom(roomId)
    if (!room) return null

    room.state = state
    store.updateRoom(room)
    return room
  }

  kickPlayer(roomId: string, playerId: string): Room | null {
    const room = store.getRoom(roomId)
    if (!room) return null

    room.players.delete(playerId)
    room.readyVotes.delete(playerId)
    room.playerCount = room.players.size

    if (room.players.size === 0) {
      store.deleteRoom(roomId)
      return null
    }

    store.updateRoom(room)
    return room
  }

  setPlayerReady(roomId: string, playerId: string): Room | null {
    const room = store.getRoom(roomId)
    if (!room) return null

    const player = room.players.get(playerId)
    if (player) {
      player.isReady = true
      room.readyVotes.add(playerId)
    }

    store.updateRoom(room)
    return room
  }

  startGame(roomId: string): { success: boolean; room: Room | null; error?: string } {
    const room = store.getRoom(roomId)
    if (!room) {
      return { success: false, room: null, error: '房间不存在' }
    }

    if (room.players.size < 1) {
      return { success: false, room: null, error: '至少需要 1 名玩家' }
    }

    if (room.state !== 'ready') {
      return { success: false, room: null, error: '房间未处于准备状态' }
    }

    return { success: true, room }
  }

  cancelReady(roomId: string): Room | null {
    const room = store.getRoom(roomId)
    if (!room) return null

    room.state = 'waiting'
    room.players.forEach(player => {
      player.isReady = false
    })
    room.readyVotes.clear()
    
    if (room.readyTimeout) {
      clearTimeout(room.readyTimeout)
      room.readyTimeout = undefined
    }

    store.updateRoom(room)
    return room
  }
}

export const roomManager = new RoomManager()
