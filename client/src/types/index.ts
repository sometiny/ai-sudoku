export type Difficulty = 'easy' | 'medium' | 'hard'

export type RoomState = 'waiting' | 'ready' | 'playing' | 'finished'

export type PlayerRole = 'player' | 'spectator' | 'host'

export interface Player {
  id: string
  nickname: string
  role: PlayerRole
  isReady: boolean
  joinedAt: number
}

export interface RoomInfo {
  id: string
  name: string
  difficulty: Difficulty
  hostId: string
  state: RoomState
  playerCount: number
  maxPlayers: number
  createdAt: number
}

export interface Room extends RoomInfo {
  players: Map<string, Player>
  spectators: Map<string, Player>
  readyVotes: Set<string>
}

export interface GameSession {
  roomId: string
  puzzle: number[][]
  solution: number[][]
  playerProgress: Map<string, number[][]>
  startTime: number
  finishedPlayers: Map<string, number>
}

export interface SocketEvents {
  'room:create': (_data: { name: string; difficulty: Difficulty }) => void
  'room:join': (_data: { roomId: string; nickname: string; role: PlayerRole }) => void
  'room:leave': (_data: { roomId: string }) => void
  'room:list': () => void
  'game:start': (_data: { roomId: string }) => void
  'game:ready': (_data: { roomId: string }) => void
  'game:progress': (_data: { roomId: string; progress: number[][] }) => void
  'game:finish': (_data: { roomId: string; time: number }) => void
  'reconnect': (_data: { playerId: string; roomId: string }) => void
}

export interface ServerToClientEvents {
  'room:update': (_room: RoomInfo & { players: Player[]; spectators: Player[] }) => void
  'room:list': (_rooms: RoomInfo[]) => void
  'room:error': (_error: string) => void
  'game:prepare': (_timeout: number) => void
  'game:start': (_data: { roomId: string }) => void
  'game:begin': (_puzzle: number[][]) => void
  'game:leaderboard': (_leaderboard: LeaderboardEntry[]) => void
  'game:end': (_results: GameResult[]) => void
  'game:kick': () => void
  'game:error': (_error: string) => void
  'game:ready': (_data: { playerId: string }) => void
}

export interface LeaderboardEntry {
  playerId: string
  nickname: string
  progress: number
  time: number
  rank?: number
}

export interface GameResult {
  playerId: string
  nickname: string
  rank: number
  time: number
  isFinished: boolean
}
