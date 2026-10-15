import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { postLongJson } from './long-request.mjs'

const exec = promisify(execFile)

export async function videoInfo(filePath) {
  const { stdout } = await exec(process.env.FFPROBE_BIN || 'ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,sample_aspect_ratio,duration:stream_side_data=rotation:format=duration',
    '-of', 'json', filePath,
  ], { timeout: 30_000, maxBuffer: 64 * 1024 })
  const probe = JSON.parse(stdout)
  const stream = probe.streams?.[0]
  if (!stream?.width || !stream?.height) throw new Error('Video dimensions unavailable')
  const [num, den] = String(stream.sample_aspect_ratio || '1:1').split(':').map(Number)
  const sar = num > 0 && den > 0 ? num / den : 1
  let width = Math.max(1, Math.round(stream.width * sar))
  let height = stream.height
  const rotation = stream.side_data_list?.find(item => Number.isFinite(item.rotation))?.rotation || 0
  if (Math.abs(rotation % 180) === 90) [width, height] = [height, width]
  const seconds = Number(probe.format?.duration || stream.duration)
  return { width, height, ...(seconds > 0 && Number.isFinite(seconds) ? { duration: Math.ceil(seconds) } : {}) }
}

export async function sendVideoFile(api, chatId, filePath) {
  const { data } = await postLongJson(`${api}/sendVideo`, {
    chat_id: chatId,
    video: `file://${filePath}`,
    supports_streaming: true,
    ...await videoInfo(filePath),
  }, 30 * 60 * 1000)
  if (!data.ok) throw new Error('Telegram file send failed')
}
