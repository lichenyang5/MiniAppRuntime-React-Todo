import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, copyFile, writeFile, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { root } from './init-harmony.mjs'

async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'runtime-todo-host-'))
  await mkdir(path.join(dir, 'scripts'))
  await mkdir(path.join(dir, 'harmony/entry/src/main'), { recursive: true })
  await mkdir(path.join(dir, 'dist'))
  await writeFile(
    path.join(dir, 'harmony/build-profile.template.json5'),
    '{"app":{"signingConfigs":[]}}',
  )
  await writeFile(path.join(dir, 'harmony/entry/src/main/module.json5'), '{}')
  await writeFile(path.join(dir, 'dist/index.html'), '<h1>fresh build</h1>')
  for (const file of ['init-harmony.mjs', 'sync-harmony.mjs'])
    await copyFile(path.join(root, 'scripts', file), path.join(dir, 'scripts', file))
  return dir
}
function run(dir, script, args = []) {
  return spawnSync(process.execPath, [path.join(dir, 'scripts', script), ...args], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
    env: { ...process.env, HARMONY_PROJECT: '' },
  })
}
test('initialization preserves local signing configuration on repeated runs', async () => {
  const dir = await fixture()
  assert.equal(run(dir, 'init-harmony.mjs').status, 0)
  const local = '{"app":{"signingConfigs":[{"name":"local-test"}]}}'
  await writeFile(path.join(dir, 'harmony/build-profile.json5'), local)
  assert.equal(run(dir, 'init-harmony.mjs').status, 0)
  assert.equal(await readFile(path.join(dir, 'harmony/build-profile.json5'), 'utf8'), local)
})
test('sync defaults to bundled host even when cwd differs, and replaces its page', async () => {
  const dir = await fixture()
  assert.equal(run(dir, 'sync-harmony.mjs').status, 0)
  const page = path.join(dir, 'harmony/entry/src/main/resources/rawfile/web/index.html')
  assert.equal(await readFile(page, 'utf8'), '<h1>fresh build</h1>')
  await writeFile(path.join(dir, 'dist/index.html'), '<h1>next build</h1>')
  assert.equal(run(dir, 'sync-harmony.mjs').status, 0)
  assert.equal(await readFile(page, 'utf8'), '<h1>next build</h1>')
})
test('invalid explicit target is rejected instead of becoming a new host', async () => {
  const dir = await fixture()
  assert.notEqual(run(dir, 'sync-harmony.mjs', [path.join(dir, 'missing')]).status, 0)
})
