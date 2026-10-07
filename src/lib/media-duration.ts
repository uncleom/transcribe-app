import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const FFPROBE = process.env.FFPROBE_BIN || 'ffprobe'

function runProbe(file: string): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawn(FFPROBE, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=nw=1:nk=1',
      file,
    ], { stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    const timer = setTimeout(() => {
      child.kill()
    }, 30_000)
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString()
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        resolve(null)
        return
      }
      const value = Number(out.trim())
      resolve(Number.isFinite(value) && value > 0 ? value : null)
    })
    child.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })
  })
}

/** Length in seconds, read from the file itself. Null when the file has no readable duration. */
export async function probeMediaDuration(bytes: Uint8Array): Promise<number | null> {
  const dir = await mkdtemp(path.join(tmpdir(), 'media-'))
  try {
    const file = path.join(dir, 'input')
    await writeFile(file, bytes)
    return await runProbe(file)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
