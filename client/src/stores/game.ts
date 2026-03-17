import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LeaderboardEntry, GameResult } from '../types'

export const useGameStore = defineStore('game', () => {
  const puzzle = ref<number[][]>([])
  const playerProgress = ref<number[][]>([])
  const leaderboard = ref<LeaderboardEntry[]>([])
  const gameResults = ref<GameResult[]>([])
  const gameState = ref<'waiting' | 'playing' | 'finished'>('waiting')
  const countdown = ref<number>(0)
  const elapsedTime = ref<number>(0)
  const timerInterval = ref<number | null>(null)
  const errorCells = ref<Set<string>>(new Set())

  const isReady = computed(() => gameState.value !== 'waiting')
  const isFinished = computed(() => gameState.value === 'finished')

  function setPuzzle(newPuzzle: number[][]) {
    puzzle.value = newPuzzle
    playerProgress.value = newPuzzle.map(row => [...row])
  }

  function updateCell(row: number, col: number, value: number) {
    playerProgress.value[row][col] = value
    validateCell(row, col, value)
  }

  function validateCell(row: number, col: number, value: number) {
    const key = `${row}-${col}`
    if (value === 0) {
      errorCells.value.delete(key)
      errorCells.value = new Set(errorCells.value)
      return
    }

    let hasError = false
    for (let i = 0; i < 9; i++) {
      if (i !== col && playerProgress.value[row][i] === value) {
        hasError = true
        break
      }
      if (i !== row && playerProgress.value[i][col] === value) {
        hasError = true
        break
      }
    }

    if (!hasError) {
      const boxRow = Math.floor(row / 3) * 3
      const boxCol = Math.floor(col / 3) * 3
      for (let i = boxRow; i < boxRow + 3; i++) {
        for (let j = boxCol; j < boxCol + 3; j++) {
          if ((i !== row || j !== col) && playerProgress.value[i][j] === value) {
            hasError = true
            break
          }
        }
        if (hasError) break
      }
    }

    if (hasError) {
      errorCells.value.add(key)
    } else {
      errorCells.value.delete(key)
    }
    errorCells.value = new Set(errorCells.value)
  }

  function isErrorCell(row: number, col: number): boolean {
    return errorCells.value.has(`${row}-${col}`)
  }

  function setLeaderboard(entries: LeaderboardEntry[]) {
    leaderboard.value = entries
  }

  function setResults(results: GameResult[]) {
    gameResults.value = results
  }

  function setGameState(state: 'waiting' | 'playing' | 'finished') {
    gameState.value = state
  }

  function setCountdown(seconds: number) {
    countdown.value = seconds
  }

  function startTimer() {
    elapsedTime.value = 0
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
    }
    timerInterval.value = window.setInterval(() => {
      elapsedTime.value += 100
    }, 100) as unknown as number
  }

  function stopTimer() {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }
  }

  function resetGame() {
    puzzle.value = []
    playerProgress.value = []
    leaderboard.value = []
    gameResults.value = []
    gameState.value = 'waiting'
    countdown.value = 0
    elapsedTime.value = 0
    errorCells.value = new Set()
    stopTimer()
  }

  return {
    puzzle,
    playerProgress,
    leaderboard,
    gameResults,
    gameState,
    countdown,
    elapsedTime,
    errorCells,
    isReady,
    isFinished,
    setPuzzle,
    updateCell,
    setLeaderboard,
    setResults,
    setGameState,
    setCountdown,
    startTimer,
    stopTimer,
    resetGame,
    isErrorCell
  }
})
