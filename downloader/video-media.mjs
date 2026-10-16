import { chmod, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { run } from './process.mjs'
import { failureCode } from './failures.mjs'

const MAX_SECONDS = 135 * 60
const SEND_MAX_BYTES = 2_000_000_000
const fail = code => { throw Object.assign(new Error(code), { code }) }

export async function inspectMedia(file, execute = run) {
  const result = await execute('ffprobe', ['-v', 'error', '-protocol_whitelist', 'file,pipe',
    '-show_entries', 'stream=codec_type,codec_name,pix_fmt:format=duration', '-of', 'json', file],
  30_000, { stdoutLimit: 64 * 1024, complete: true })
  if (result.code !== 0 || result.overflow) fail('unavailable')
  let info
  try { info = JSON.parse(result.stdout) } catch { fail('unavailable') }
  const duration = Number(info.format?.duration)
  if (Number.isFinite(duration) && duration > MAX_SECONDS) fail('too_long')
  return { streams: Array.isArray(info.streams) ? info.streams : [],
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : undefined }
}

async function findFile(dir, stem) {
  return (await readdir(dir)).find(name => new RegExp(`^${stem}\\.[a-zA-Z0-9]+$`).test(name)
    && !/\.(part|ytdl|json)$/.test(name))
}

// Use the original source URL and its exact playlist position, never a preview URL.
export async function downloadVideo({ url, dir, item, ytDlp, ytBase, execute = run }) {
  if (item.durationSeconds > MAX_SECONDS) fail('too_long')
  const selection = item.selection || ['--no-playlist']
  const base = [...ytBase, ...selection]
  const fetched = await execute(ytDlp, [...base, '--max-filesize', '2000M',
    '--merge-output-format', 'mp4', '-o', path.join(dir, 'video.%(ext)s'), url], 20 * 60 * 1000)
  const video = await findFile(dir, 'video')
  const overLimit = /larger than max-filesize|File is larger/i.test(
    (fetched.stderr || '') + (fetched.stdout || ''))
  if (fetched.code !== 0 && !overLimit) fail(failureCode(fetched))
  if (!video && !overLimit) fail('unavailable')
  if (!video) {
    const audioRun = await execute(ytDlp, [...base, '--max-filesize', '2000M', '-f', 'ba/b', '-x',
      '--audio-format', 'm4a', '-o', path.join(dir, 'speech.%(ext)s'), url], 20 * 60 * 1000)
    if (audioRun.code !== 0) fail(failureCode(audioRun))
    const speech = await findFile(dir, 'speech')
    if (!speech || (await stat(path.join(dir, speech))).size > SEND_MAX_BYTES) fail('no_audio')
    const info = await inspectMedia(path.join(dir, speech), execute)
    if (!info.streams.some(s => s.codec_type === 'audio')) fail('no_audio')
    await chmod(path.join(dir, speech), 0o644)
    return { file: null, audio: speech,
      durationSeconds: info.durationSeconds ?? item.durationSeconds, videoTooBig: true }
  }

  const videoPath = path.join(dir, video)
  const info = await inspectMedia(videoPath, execute)
  const picture = info.streams.find(s => s.codec_type === 'video')
  if (!picture) fail('no_media')
  let audio = null
  let audioError
  // Silent video is valid: no audio extraction and no ASR input.
  if (info.streams.some(s => s.codec_type === 'audio')) {
    const extracted = await execute('ffmpeg', ['-v', 'error', '-y', '-protocol_whitelist', 'file,pipe',
      '-i', videoPath, '-map', '0:a:0', '-vn', '-ac', '1', '-c:a', 'aac', '-b:a', '64k',
      path.join(dir, 'audio.m4a')], 15 * 60 * 1000)
    if (extracted.code !== 0) {
      await rm(path.join(dir, 'audio.m4a'), { force: true })
      audioError = 'no_audio'
    } else {
      audio = 'audio.m4a'
      await chmod(path.join(dir, audio), 0o644)
    }
  }

  let file = video
  let videoTooBig = (await stat(videoPath)).size > SEND_MAX_BYTES
  if (!videoTooBig) {
    const playable = picture.codec_name === 'h264' && ['yuv420p', 'yuvj420p'].includes(picture.pix_fmt)
    if (!playable || !/\.mp4$/i.test(video)) {
      file = 'video-h264.mp4'
      const codecArgs = playable ? ['-c', 'copy'] : [
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23',
        '-c:a', 'aac', '-ac', '2', '-b:a', '128k',
        '-vf', 'scale=trunc(ih*dar/2)*2:trunc(ih/2)*2,setsar=1',
      ]
      const encoded = await execute('ffmpeg', ['-v', 'error', '-y', '-protocol_whitelist', 'file,pipe',
        '-i', videoPath, '-map', '0:v:0', '-map', '0:a:0?', ...codecArgs,
        '-movflags', '+faststart', path.join(dir, file)], 20 * 60 * 1000)
      if (encoded.code !== 0) fail('transcode_failed')
      const output = await inspectMedia(path.join(dir, file), execute)
      const outputVideo = output.streams.find(s => s.codec_type === 'video')
      if (outputVideo?.codec_name !== 'h264'
        || !['yuv420p', 'yuvj420p'].includes(outputVideo.pix_fmt)) fail('transcode_failed')
      await rm(videoPath, { force: true })
      videoTooBig = (await stat(path.join(dir, file))).size > SEND_MAX_BYTES
    }
  }
  if (videoTooBig) {
    await rm(path.join(dir, file), { force: true })
    file = null
  } else {
    await chmod(path.join(dir, file), 0o644)
  }
  if (!file && !audio) fail('no_media')
  return { file, audio, durationSeconds: info.durationSeconds ?? item.durationSeconds, videoTooBig,
    ...(audioError ? { audioError } : {}) }
}
