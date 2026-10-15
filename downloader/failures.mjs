export function failureCode(result) {
  if (result.timedOut) return 'timeout'
  const message = result.stderr || ''
  if (/Unsupported URL|No suitable extractor/i.test(message)) return 'unsupported'
  if (/confirm you.?re not a bot|HTTP Error (?:403|429)|rate.?limit|too many requests|blocked by/i.test(message)) return 'source_blocked'
  if (/login required|log.?in|sign.?in|cookies.*authentication|private video/i.test(message)) return 'login_required'
  if (/No video formats|No video found|no video in this post/i.test(message)) return 'no_media'
  if (/timed? out|timeout/i.test(message)) return 'timeout'
  return 'unavailable'
}

export function logFailure(stage, url, result) {
  const code = failureCode(result)
  console.error(JSON.stringify({ event: 'download_failed', stage, host: new URL(url).hostname, code }))
  return code
}
