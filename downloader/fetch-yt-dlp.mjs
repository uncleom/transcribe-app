import { createHash } from 'node:crypto'
import { chmod, mkdir, writeFile } from 'node:fs/promises'

const VERSION = '2026.08.19'
const SHA256 = '58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a'
const URL = `https://github.com/yt-dlp/yt-dlp/releases/download/${VERSION}/yt-dlp_linux`

const res = await fetch(URL)
if (!res.ok) throw new Error(`yt-dlp download failed: ${res.status}`)
const buf = Buffer.from(await res.arrayBuffer())
const hash = createHash('sha256').update(buf).digest('hex')
if (hash !== SHA256) throw new Error('yt-dlp checksum mismatch')

await mkdir('bin', { recursive: true })
await writeFile('bin/yt-dlp', buf)
await chmod('bin/yt-dlp', 0o755)
console.log(`yt-dlp ${VERSION}`)
