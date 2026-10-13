import { cp, mkdir, access } from 'node:fs/promises'
import path from 'node:path'
import { root, host, initHarmony } from './init-harmony.mjs'

const targetArg = process.argv[2]
if (process.env.HARMONY_PROJECT && !targetArg)
  throw new Error('请取消 HARMONY_PROJECT 环境变量，或用显式路径运行 sync:harmony。')
const target = targetArg ? path.resolve(targetArg) : host
if (target === host) await initHarmony()
await access(path.join(target, 'build-profile.json5'))
await access(path.join(target, 'entry/src/main/module.json5'))
await access(path.join(root, 'dist/index.html'))
const web = path.join(target, 'entry/src/main/resources/rawfile/web')
await mkdir(web, { recursive: true })
await cp(path.join(root, 'dist'), web, { recursive: true })
console.log(`React 构建产物已同步到 ${web}。请在 DevEco Rebuild 后 Run entry。`)
