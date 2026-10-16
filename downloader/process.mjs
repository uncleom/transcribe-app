import { spawn } from 'node:child_process'

// Metadata needs a complete JSON document, not the diagnostic ring buffer.
export function run(cmd, args, timeoutMs, { stdoutLimit = 4000, complete = false } = {}) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  let chunks = []
  let bytes = 0
  let stderr = Buffer.alloc(0)
  let timedOut = false
  let overflow = false
  const kill = () => {
    try { process.kill(-child.pid, 'SIGKILL') } catch { child.kill('SIGKILL') }
  }
  child.stdout.on('data', chunk => {
    if (overflow) return
    if (complete) {
      bytes += chunk.length
      if (bytes > stdoutLimit) { overflow = true; chunks = []; kill(); return }
      chunks.push(chunk)
    } else {
      chunks = [Buffer.concat([...chunks, chunk]).subarray(-stdoutLimit)]
    }
  })
  child.stderr.on('data', chunk => {
    stderr = Buffer.concat([stderr, chunk]).subarray(-4000)
  })
  const timer = setTimeout(() => { timedOut = true; kill() }, timeoutMs)
  return new Promise((resolve, reject) => {
    child.on('error', err => { clearTimeout(timer); reject(err) })
    child.on('close', code => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, stdout: Buffer.concat(chunks).toString('utf8'),
        stderr: stderr.toString('utf8'), timedOut, overflow })
    })
  })
}
