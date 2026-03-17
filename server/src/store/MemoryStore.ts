import type { Room, GameSession } from '../types'

export class MemoryStore {
  private rooms: Map<string, Room> = new Map()
  private games: Map<string, GameSession> = new Map()

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values())
  }

  createRoom(room: Room): void {
    this.rooms.set(room.id, room)
  }

  updateRoom(room: Room): void {
    this.rooms.set(room.id, room)
  }

  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId)
  }

  getGame(roomId: string): GameSession | undefined {
    return this.games.get(roomId)
  }

  setGame(roomId: string, game: GameSession): void {
    this.games.set(roomId, game)
  }

  deleteGame(roomId: string): boolean {
    return this.games.delete(roomId)
  }
}

export const store = new MemoryStore()
