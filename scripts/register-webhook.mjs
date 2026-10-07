import { spawn } from 'node:child_process'
import { createConnection } from 'node:net'
import { networkInterfaces } from 'node:os'

// The local Bot API keeps the webhook address it resolved last time.
// A new container has a new address, so point the webhook at this container
// once Next is listening. Outside that Docker network the call is skipped.

const port = Number(process.env.PORT || 3000)
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
  stdio: 'inherit',
})

function forward(signal) {
  child.kill(signal)
}
process.on('SIGTERM', () => forward('SIGTERM'))
process.on('SIGINT', () => forward('SIGINT'))
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})

function containerAddress() {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address
    }
  }
  return null
}

function portOpen() {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    const done = (ok) => {
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

async function register() {
  const api = (process.env.TELEGRAM_BOT_API_URL || '').replace(/\/$/, '')
  const token = process.env.TELEGRAM_BOT_TOKEN
  const secret = process.env.TELEGRAM_SECRET_TOKEN
  const address = containerAddress()
  if (!api || !token || !secret || !address) return

  for (let i = 0; i < 60; i++) {
    if (await portOpen()) break
    await new Promise((resolve) => setTimeout(resolve, 500))
    if (i === 59) return
  }

  const base = `${api}/bot${token}`
  try {
    await fetch(api, { signal: AbortSignal.timeout(3000) })
  } catch {
    return
  }

  await fetch(`${base}/deleteWebhook`, {
    method: 'POST',
    body: new URLSearchParams({ drop_pending_updates: 'false' }),
    signal: AbortSignal.timeout(10000),
  })
  const body = new URLSearchParams()
  body.set('url', `http://${address}:${port}/api/telegram/webhook`)
  body.set('secret_token', secret)
  body.set('allowed_updates', JSON.stringify(['message', 'callback_query']))
  body.set('drop_pending_updates', 'false')
  const response = await fetch(`${base}/setWebhook`, {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(10000),
  })
  const result = await response.json()
  console.log(result.ok ? 'Telegram webhook points at this container' : 'Telegram webhook was not updated')
}

register().catch(() => {
  console.log('Telegram webhook was not updated')
})
