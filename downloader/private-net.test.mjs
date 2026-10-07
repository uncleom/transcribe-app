import assert from 'node:assert/strict'
import net from 'node:net'
import { isBlockedHostname, isPrivateAddress } from './private-net.mjs'
import { startProxy } from './proxy.mjs'

assert.equal(isPrivateAddress('127.0.0.1'), true)
assert.equal(isPrivateAddress('10.1.2.3'), true)
assert.equal(isPrivateAddress('169.254.169.254'), true)
assert.equal(isPrivateAddress('172.16.0.1'), true)
assert.equal(isPrivateAddress('192.168.1.1'), true)
assert.equal(isPrivateAddress('100.64.0.1'), true)
assert.equal(isPrivateAddress('8.8.8.8'), false)
assert.equal(isPrivateAddress('::1'), true)
assert.equal(isPrivateAddress('::ffff:127.0.0.1'), true)
assert.equal(isBlockedHostname('localhost'), true)
assert.equal(isBlockedHostname('metadata.google.internal'), true)
assert.equal(isBlockedHostname('169.254.169.254'), true)
assert.equal(isBlockedHostname('example.com'), false)

const proxy = await startProxy(8877)
await new Promise((resolve, reject) => {
  const socket = net.connect(8877, '127.0.0.1', () => {
    socket.write('CONNECT 127.0.0.1:9 HTTP/1.1\r\nHost: 127.0.0.1:9\r\n\r\n')
  })
  let data = ''
  socket.on('data', (chunk) => {
    data += chunk.toString()
    if (data.includes('403')) {
      socket.end()
      resolve()
    }
  })
  socket.on('error', reject)
  setTimeout(() => reject(new Error(data || 'proxy timeout')), 2000)
})
proxy.close()

console.log('private-net ok')
