import { readFile, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import assert from 'node:assert/strict'
import { root, host } from './init-harmony.mjs'

const profile = JSON.parse(await readFile(path.join(host, 'build-profile.template.json5'), 'utf8'))
assert.deepEqual(profile.app.signingConfigs, [])
assert.equal(profile.app.products[0].compatibleSdkVersion, '6.1.0(23)')
const dependency = JSON.parse(await readFile(path.join(host, 'entry/oh-package.json5'), 'utf8'))
assert.equal(dependency.dependencies.myascf_runtime, '1.0.0')
const module = JSON.parse(await readFile(path.join(host, 'entry/src/main/module.json5'), 'utf8'))
assert.equal(module.module.mainElement, 'EntryAbility')
assert.deepEqual(
  JSON.parse(
    await readFile(
      path.join(host, 'entry/src/main/resources/base/profile/main_pages.json'),
      'utf8',
    ),
  ).src,
  ['pages/Index'],
)
const index = await readFile(path.join(host, 'entry/src/main/ets/pages/Index.ets'), 'utf8')
assert.ok(index.includes("$rawfile('web/index.html')") && index.includes('.javaScriptProxy('))
await access(path.join(host, 'entry/src/main/ets/entryability/EntryAbility.ets'))
const tracked = execFileSync('git', ['ls-files', '-z', '--', 'harmony'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter(Boolean)
for (const file of tracked) {
  assert.ok(
    !/(?:^|\/)(?:local\.properties|build-profile\.json5)$/.test(file) ||
      file === 'harmony/entry/build-profile.json5',
    `本地配置不应跟踪：${file}`,
  )
  assert.ok(!/\.(?:p12|p7b|cer|keystore)$/i.test(file), `签名文件不应跟踪：${file}`)
  if (/\.(?:json5?|ts|ets|properties)$/i.test(file)) {
    const content = await readFile(path.join(root, file), 'utf8')
    assert.ok(
      !/"(?:keyPassword|storePassword|certpath|storeFile)"\s*:/.test(content),
      `检测到本地签名材料：${file}`,
    )
  }
}
console.log('Harmony host: dependency, startup, public template and tracked-file checks passed.')
