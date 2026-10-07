import http from 'node:http'
import net from 'node:net'
import { lookup } from 'node:dns/promises'
import { isBlockedHostname, isPrivateAddress } from './private-net.mjs'

// Every connection yt-dlp opens goes through here. The name is resolved once
// and the socket is pinned to that address, so a later DNS answer cannot
// point the same download at a private host.

async function publicAddress(hostname) {
  if (isBlockedHostname(hostname)) return null
  if (net.isIP(hostname)) return isPrivateAddress(hostname) ? null : hostname
  let records
  try {
    records = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    return null
  }
  if (records.length === 0 || records.some((item) => isPrivateAddress(item.address))) return null
  return records[0].address
}

function refuse(socket) {
  socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
  socket.end()
}

export function startProxy(port) {
  const server = http.createServer(async (req, res) => {
    let target
    try {
      target = new URL(req.url)
    } catch {
      res.writeHead(400)
      res.end()
      return
    }
    const address = await publicAddress(target.hostname)
    if (!address) {
      res.writeHead(403)
      res.end()
      return
    }
    const headers = { ...req.headers, host: target.host }
    const outbound = http.request({
      host: address,
      port: target.port || 80,
      method: req.method,
      path: target.pathname + target.search,
      headers,
    }, (upstream) => {
      res.writeHead(upstream.statusCode || 502, upstream.headers)
      upstream.pipe(res)
    })
    outbound.on('error', () => {
      if (!res.headersSent) res.writeHead(502)
      res.end()
    })
    req.pipe(outbound)
  })

  server.on('connect', async (req, socket) => {
    const [hostname, portText] = String(req.url || '').split(':')
    const address = await publicAddress(hostname)
    const port = Number(portText || 443)
    if (!address || !Number.isInteger(port) || port < 1 || port > 65535) {
      refuse(socket)
      return
    }
    const remote = net.connect(port, address)
    remote.on('connect', () => {
      socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      remote.pipe(socket)
      socket.pipe(remote)
    })
    remote.on('error', () => refuse(socket))
    socket.on('error', () => remote.destroy())
  })

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}
