import { io, type Socket } from 'socket.io-client'
import type { ServerToClientEvents, SocketEvents } from '../types'

let socket: Socket<ServerToClientEvents, SocketEvents> | null = null

export function useSocket() {
  const connect = (nickname?: string) => {
    if (socket?.connected) return socket

    const query = nickname ? { nickname } : {}
    
    socket = io('http://localhost:4000', {
      query,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })

    socket.on('connect', () => {
      console.log('Socket connected')
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
    })

    return socket
  }

  const getSocket = () => {
    return socket
  }

  const disconnect = () => {
    if (socket) {
      socket.disconnect()
      socket = null
    }
  }

  return {
    connect,
    getSocket,
    disconnect
  }
}
