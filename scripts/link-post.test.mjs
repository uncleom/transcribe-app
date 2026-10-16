import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, symlink, access, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { readDownloaderPost } from '../src/lib/link-post.mjs'

const id = '11111111-1111-4111-8111-111111111111'
async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'link-post-'))
  const dir = path.join(root, id)
  await mkdir(dir)
  try { await run(root, dir) } finally { await rm(root, { recursive: true, force: true }) }
}

test('decodes an ordered mixed post and removes its UUID workspace', async () => fixture(async (root, dir) => {
  for (const file of ['1.jpg', '2.mp4', '2.m4a']) await writeFile(path.join(dir, file), 'fixture')
  const post = await readDownloaderPost({ id, text: 'Автор 👋', items: [
    { index: 1, type: 'photo', file: '1.jpg' },
    { index: 2, type: 'video', file: '2.mp4', audio: '2.m4a', durationSeconds: 2 },
    { index: 3, type: 'photo', file: null, error: 'source_blocked' },
  ] }, root)
  assert.equal(post.text, 'Автор 👋')
  assert.deepEqual(post.items.map(item => [item.index, item.type, item.error]), [[1, 'photo', null], [2, 'video', null], [3, 'photo', 'source_blocked']])
  assert.equal(post.items[0].filePath, path.join(await realpath(dir), '1.jpg'))
  assert.equal(post.items[0].audioPath, null)
  await post.cleanup()
  await assert.rejects(access(dir))
}))

test('supports legacy video response, silent video and text-only post', async () => {
  await fixture(async (root, dir) => {
    await writeFile(path.join(dir, 'video.mp4'), 'fixture')
    await writeFile(path.join(dir, 'audio.m4a'), 'fixture')
    const post = await readDownloaderPost({ id, video: 'video.mp4', audio: 'audio.m4a' }, root)
    assert.equal(post.items[0].type, 'video')
    assert.ok(post.items[0].audioPath)
    const silent = await readDownloaderPost({ id, items: [{ index: 1, type: 'video', file: 'video.mp4', audio: null }] }, root)
    assert.equal(silent.items[0].audioPath, null)
  })
  await fixture(async root => {
    const post = await readDownloaderPost({ id, text: 'Без медиа', items: [] }, root)
    assert.deepEqual(post.items, [])
  })
})

test('rejects traversal, escaped symlink and malformed contract, without deleting the target', async () => {
  for (const name of ['../outside', '..', '/etc/passwd']) await fixture(async root => {
    await assert.rejects(readDownloaderPost({ id, items: [{ index: 1, type: 'photo', file: name }] }, root))
  })
  await fixture(async (root, dir) => {
    const target = path.join(root, 'outside.txt')
    await writeFile(target, 'must survive')
    await symlink(target, path.join(dir, 'escaped.jpg'))
    await assert.rejects(readDownloaderPost({ id, items: [{ index: 1, type: 'photo', file: 'escaped.jpg' }] }, root))
    await access(target)
    await assert.rejects(access(dir))
  })
  for (const items of [[], [{ index: 0, type: 'photo', file: null, error: 'blocked' }],
    [{ index: 1, type: 'photo', error: 'blocked' }, { index: 1, type: 'photo', error: 'blocked' }],
    [{ index: 1, type: 'photo', error: 'https://secret.example' }]]) await fixture(async root => {
    await assert.rejects(readDownloaderPost({ id, items }, root))
  })
})
