import { createRouter, createWebHistory } from 'vue-router'
import Lobby from './views/Lobby.vue'
import Room from './views/Room.vue'
import Game from './views/Game.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'Lobby', component: Lobby },
    { path: '/room/:roomId', name: 'Room', component: Room },
    { path: '/game/:roomId', name: 'Game', component: Game }
  ]
})

export default router
