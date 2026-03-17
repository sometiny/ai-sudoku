import http from 'http'
import express from 'express'
import { Server } from 'socket.io'
import { setupSocketHandlers } from './socket/handlers'

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

setupSocketHandlers(io)

const PORT = process.env.PORT || 4000

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
