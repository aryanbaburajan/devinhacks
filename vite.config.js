import { defineConfig } from 'vite'

const allowedHosts = [
  '.ngrok-free.app',
  '.ngrok-free.dev',
  '.ngrok.app',
  '.ngrok.dev',
  '.ngrok.io',
  '.ngrok.pizza',
  '.ngrok.pro',
]

export default defineConfig({
  server: { allowedHosts },
  preview: { allowedHosts },
})
