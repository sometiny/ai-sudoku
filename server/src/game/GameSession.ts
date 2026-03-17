import type { GameSession, LeaderboardEntry, GameResult } from '../types'
import { store } from '../store/MemoryStore'
import { sudokuGenerator } from '../game/SudokuGenerator'
import type { Room } from '../types'

export class GameSessionManager {
  createGame(room: Room): GameSession {
    const { puzzle, solution } = sudokuGenerator.generatePuzzle(room.difficulty)
    
    const playerProgress = new Map<string, number[][]>()
    room.players.forEach((_, playerId) => {
      const progress = puzzle.map(row => [...row])
      playerProgress.set(playerId, progress)
    })

    const game: GameSession = {
      roomId: room.id,
      puzzle,
      solution,
      playerProgress,
      startTime: Date.now(),
      finishedPlayers: new Map()
    }

    store.setGame(room.id, game)
    return game
  }

  updatePlayerProgress(roomId: string, playerId: string, progress: number[][]): number {
    const game = store.getGame(roomId)
    if (!game) return 0

    game.playerProgress.set(playerId, progress)
    
    const puzzle = game.puzzle
    let filledCount = 0
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (progress[i][j] !== 0) filledCount++
      }
    }
    
    const totalEmpty = puzzle.flat().filter(n => n === 0).length
    return Math.round((filledCount / (81 - totalEmpty)) * 100)
  }

  validateMove(roomId: string, row: number, col: number, value: number): boolean {
    const game = store.getGame(roomId)
    if (!game) return false
    return sudokuGenerator.validateMove(game.puzzle, game.solution, row, col, value)
  }

  finishGame(roomId: string, playerId: string, time: number): boolean {
    const game = store.getGame(roomId)
    if (!game) return false

    const progress = game.playerProgress.get(playerId)
    if (!progress) return false

    if (sudokuGenerator.isComplete(progress, game.solution)) {
      game.finishedPlayers.set(playerId, time)
      return true
    }
    return false
  }

  getLeaderboard(roomId: string): LeaderboardEntry[] {
    const game = store.getGame(roomId)
    const room = store.getRoom(roomId)
    if (!game || !room) return []

    const entries: LeaderboardEntry[] = []

    room.players.forEach((player, playerId) => {
      const progress = game.playerProgress.get(playerId)
      if (!progress) return

      let filledCount = 0
      for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
          if (progress[i][j] !== 0) filledCount++
        }
      }

      const time = game.finishedPlayers.get(playerId) || 0
      entries.push({
        playerId,
        nickname: player.nickname,
        progress: filledCount,
        time
      })
    })

    entries.sort((a, b) => {
      if (b.progress !== a.progress) return b.progress - a.progress
      if (a.time && b.time) return a.time - b.time
      if (a.time) return -1
      if (b.time) return 1
      return 0
    })

    entries.forEach((entry, index) => {
      entry.rank = index + 1
    })

    return entries
  }

  getGameResults(roomId: string): GameResult[] {
    const game = store.getGame(roomId)
    const room = store.getRoom(roomId)
    if (!game || !room) return []

    const results: GameResult[] = []
    const finishedEntries = Array.from(game.finishedPlayers.entries())
      .sort((a, b) => a[1] - b[1])

    finishedEntries.forEach(([playerId, time], index) => {
      const player = room.players.get(playerId)
      if (player) {
        results.push({
          playerId,
          nickname: player.nickname,
          rank: index + 1,
          time,
          isFinished: true
        })
      }
    })

    room.players.forEach((player, playerId) => {
      if (!game.finishedPlayers.has(playerId)) {
        results.push({
          playerId,
          nickname: player.nickname,
          rank: results.length + 1,
          time: 0,
          isFinished: false
        })
      }
    })

    return results
  }

  deleteGame(roomId: string): void {
    store.deleteGame(roomId)
  }
}

export const gameSessionManager = new GameSessionManager()
