import type { Server } from 'socket.io'
import type { ServerToClientEvents, SocketEvents } from '../types'
import { roomManager } from '../rooms/RoomManager'
import { gameSessionManager } from '../game/GameSession'
import { store } from '../store/MemoryStore'

export function setupSocketHandlers(io: Server<SocketEvents, ServerToClientEvents>) {
  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id)

    socket.on('room:list', () => {
      const rooms = roomManager.getRoomList().map(room => ({
        id: room.id,
        name: room.name,
        difficulty: room.difficulty,
        hostId: room.hostId,
        state: room.state,
        playerCount: room.playerCount,
        maxPlayers: room.maxPlayers,
        createdAt: room.createdAt
      }))
      socket.emit('room:list', rooms)
    })

    socket.on('room:create', ({ name, difficulty }) => {
      const room = roomManager.createRoom(name, difficulty, socket.id, socket.handshake.query.nickname as string || '玩家')
      socket.join(room.id)
      
      const roomData = {
        ...room,
        players: Array.from(room.players.values()),
        spectators: Array.from(room.spectators.values())
      }
      socket.emit('room:update', roomData)
      
      io.emit('room:list', roomManager.getRoomList().map(r => ({
        id: r.id,
        name: r.name,
        difficulty: r.difficulty,
        hostId: r.hostId,
        state: r.state,
        playerCount: r.playerCount,
        maxPlayers: r.maxPlayers,
        createdAt: r.createdAt
      })))
    })

    socket.on('room:join', ({ roomId, nickname, role }) => {
      const playerRole = role === 'host' ? 'player' : role
      const room = roomManager.joinRoom(roomId, socket.id, nickname, playerRole as 'player' | 'spectator')
      
      if (!room) {
        socket.emit('room:error', '加入房间失败')
        return
      }

      socket.join(roomId)
      
      const roomData = {
        ...room,
        players: Array.from(room.players.values()),
        spectators: Array.from(room.spectators.values())
      }
      
      io.to(roomId).emit('room:update', roomData)
      io.emit('room:list', roomManager.getRoomList().map(r => ({
        id: r.id,
        name: r.name,
        difficulty: r.difficulty,
        hostId: r.hostId,
        state: r.state,
        playerCount: r.playerCount,
        maxPlayers: r.maxPlayers,
        createdAt: r.createdAt
      })))
    })

    socket.on('room:leave', ({ roomId }) => {
      const room = roomManager.leaveRoom(roomId, socket.id)
      socket.leave(roomId)

      if (room) {
        io.to(roomId).emit('room:update', {
          ...room,
          players: Array.from(room.players.values()),
          spectators: Array.from(room.spectators.values())
        })
        
        io.emit('room:list', roomManager.getRoomList().map(r => ({
          id: r.id,
          name: r.name,
          difficulty: r.difficulty,
          hostId: r.hostId,
          state: r.state,
          playerCount: r.playerCount,
          maxPlayers: r.maxPlayers,
          createdAt: r.createdAt
        })))
      }
    })

    socket.on('game:start', ({ roomId }) => {
      const room = store.getRoom(roomId)
      if (!room || room.hostId !== socket.id) {
        socket.emit('game:error', '只有房主可以开始游戏')
        return
      }

      if (room.players.size < 1) {
        socket.emit('game:error', '至少需要 1 名玩家')
        return
      }

      roomManager.setRoomReady(roomId)
      roomManager.setPlayerReady(roomId, socket.id)
      
      io.to(roomId).emit('game:prepare', 10)
      io.to(roomId).emit('game:start', { roomId })

      room.readyTimeout = setTimeout(() => {
        const currentRoom = store.getRoom(roomId)
        if (!currentRoom || currentRoom.state !== 'ready') return

        const playersToRemove: string[] = []
        currentRoom.players.forEach((_, playerId) => {
          if (!currentRoom.readyVotes.has(playerId)) {
            playersToRemove.push(playerId)
          }
        })

        playersToRemove.forEach(playerId => {
          const socket = io.sockets.sockets.get(playerId)
          if (socket) {
            socket.emit('game:kick')
            socket.leave(roomId)
          }
          roomManager.kickPlayer(roomId, playerId)
        })

        const updatedRoom = store.getRoom(roomId)
        if (!updatedRoom) return

        if (updatedRoom.players.size < 1) {
          roomManager.cancelReady(roomId)
          io.to(roomId).emit('room:update', {
            ...updatedRoom,
            players: Array.from(updatedRoom.players.values()),
            spectators: Array.from(updatedRoom.spectators.values())
          })
          return
        }

        if (updatedRoom.readyVotes.size >= updatedRoom.players.size) {
          startTheGame(roomId, updatedRoom)
        }
      }, 10000)

      store.updateRoom(room)
    })

    const startTheGame = (roomId: string, room: any) => {
      const game = gameSessionManager.createGame(room)
      
      io.to(roomId).emit('game:begin', game.puzzle)
      
      roomManager.setRoomState(roomId, 'playing')

      const updateLeaderboard = () => {
        const leaderboard = gameSessionManager.getLeaderboard(roomId)
        io.to(roomId).emit('game:leaderboard', leaderboard)
      }

      room.gameUpdateInterval = setInterval(updateLeaderboard, 1000)
      updateLeaderboard()

      const timeout = setTimeout(() => {
        endGame(roomId)
      }, 5 * 60 * 1000)
      room.gameTimeout = timeout
    }

    const endGame = (roomId: string) => {
      const room = store.getRoom(roomId)
      if (!room) return

      if (room.gameUpdateInterval) {
        clearInterval(room.gameUpdateInterval)
      }
      if (room.gameTimeout) {
        clearTimeout(room.gameTimeout)
      }

      const results = gameSessionManager.getGameResults(roomId)
      io.to(roomId).emit('game:end', results)

      roomManager.setRoomState(roomId, 'finished')
      
      setTimeout(() => {
        gameSessionManager.deleteGame(roomId)
        store.deleteRoom(roomId)
        io.emit('room:list', roomManager.getRoomList().map(r => ({
          id: r.id,
          name: r.name,
          difficulty: r.difficulty,
          hostId: r.hostId,
          state: r.state,
          playerCount: r.playerCount,
          maxPlayers: r.maxPlayers,
          createdAt: r.createdAt
        })))
      }, 30000)
    }

    socket.on('game:ready', ({ roomId }) => {
      const room = roomManager.setPlayerReady(roomId, socket.id)
      if (room) {
        io.to(roomId).emit('game:ready', { playerId: socket.id })
        const allReady = room.readyVotes.size >= room.players.size
        console.log(`Player ${socket.id} ready. readyVotes: ${room.readyVotes.size}, players: ${room.players.size}, allReady: ${allReady}`)
        if (allReady && room.players.size >= 1) {
          console.log('All players ready, starting game...')
          if (room.readyTimeout) {
            clearTimeout(room.readyTimeout)
            room.readyTimeout = undefined
          }
          startTheGame(roomId, room)
        }
      }
    })

    socket.on('game:progress', ({ roomId, progress }) => {
      const game = store.getGame(roomId)
      if (!game) return

      gameSessionManager.updatePlayerProgress(roomId, socket.id, progress)
      
      const leaderboard = gameSessionManager.getLeaderboard(roomId)
      io.to(roomId).emit('game:leaderboard', leaderboard)
    })

    socket.on('game:finish', ({ roomId, time }) => {
      const game = store.getGame(roomId)
      if (!game) return

      const isComplete = gameSessionManager.finishGame(roomId, socket.id, time)
      if (isComplete) {
        const room = store.getRoom(roomId)
        if (room && game.finishedPlayers.size >= room.players.size) {
          endGame(roomId)
          return
        }
      }

      const leaderboard = gameSessionManager.getLeaderboard(roomId)
      io.to(roomId).emit('game:leaderboard', leaderboard)
    })

    socket.on('reconnect', ({ playerId, roomId }) => {
      const room = store.getRoom(roomId)
      if (!room) {
        socket.emit('room:error', '房间不存在')
        return
      }

      const game = store.getGame(roomId)
      if (game) {
        const puzzle = game.puzzle
        socket.emit('game:begin', puzzle)
      }

      const roomData = {
        ...room,
        players: Array.from(room.players.values()),
        spectators: Array.from(room.spectators.values())
      }
      socket.emit('room:update', roomData)
    })

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id)

      const rooms = store.getAllRooms()
      for (const room of rooms) {
        if (room.players.has(socket.id) || room.spectators.has(socket.id)) {
          const updatedRoom = roomManager.leaveRoom(room.id, socket.id)
          if (updatedRoom) {
            io.to(room.id).emit('room:update', {
              ...updatedRoom,
              players: Array.from(updatedRoom.players.values()),
              spectators: Array.from(updatedRoom.spectators.values())
            })
          }
          io.emit('room:list', roomManager.getRoomList().map(r => ({
            id: r.id,
            name: r.name,
            difficulty: r.difficulty,
            hostId: r.hostId,
            state: r.state,
            playerCount: r.playerCount,
            maxPlayers: r.maxPlayers,
            createdAt: r.createdAt
          })))
          break
        }
      }
    })
  })
}
