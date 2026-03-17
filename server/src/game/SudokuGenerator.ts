import type { Difficulty } from '../types'

export class SudokuGenerator {
  generateSolution(): number[][] {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0))
    this.fillBoard(board)
    return board
  }

  private fillBoard(board: number[][]): boolean {
    const empty = this.findEmpty(board)
    if (!empty) return true

    const [row, col] = empty
    const numbers = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])

    for (const num of numbers) {
      if (this.isValid(board, row, col, num)) {
        board[row][col] = num
        if (this.fillBoard(board)) return true
        board[row][col] = 0
      }
    }

    return false
  }

  private findEmpty(board: number[][]): [number, number] | null {
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (board[i][j] === 0) return [i, j]
      }
    }
    return null
  }

  private isValid(board: number[][], row: number, col: number, num: number): boolean {
    for (let i = 0; i < 9; i++) {
      if (board[row][i] === num || board[i][col] === num) return false
    }

    const startRow = Math.floor(row / 3) * 3
    const startCol = Math.floor(col / 3) * 3
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (board[startRow + i][startCol + j] === num) return false
      }
    }

    return true
  }

  private shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  generatePuzzle(difficulty: Difficulty): { puzzle: number[][]; solution: number[][] } {
    const solution = this.generateSolution()
    const holes = { easy: 35, medium: 45, hard: 55 }[difficulty]
    const puzzle = solution.map(row => [...row])

    const positions = this.shuffle(
      Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9] as [number, number])
    )

    for (let i = 0; i < holes && i < positions.length; i++) {
      const [row, col] = positions[i]
      puzzle[row][col] = 0
    }

    return { puzzle, solution }
  }

  validateMove(puzzle: number[][], solution: number[][], row: number, col: number, value: number): boolean {
    if (puzzle[row][col] !== 0) return false
    return solution[row][col] === value
  }

  isComplete(board: number[][], solution: number[][]): boolean {
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (board[i][j] !== solution[i][j]) return false
      }
    }
    return true
  }
}

export const sudokuGenerator = new SudokuGenerator()
