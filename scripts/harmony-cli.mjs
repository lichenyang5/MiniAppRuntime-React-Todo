import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { host, initHarmony } from './init-harmony.mjs'

const action = process.argv[2]
if (!['install', 'build'].includes(action)) throw new Error('支持的操作：install、build')
const deveco =
  process.env.DEVECO_HOME ||
  (process.platform === 'win32' ? 'C:/Program Files/Huawei/DevEco Studio' : '')
if (!deveco) throw new Error('请设置 DEVECO_HOME 为本机 DevEco Studio 安装目录。')
const bundledNode = path.join(
  deveco,
  'tools/node',
  process.platform === 'win32' ? 'node.exe' : 'bin/node',
)
const node = existsSync(bundledNode) ? bundledNode : process.execPath
const tool = path.join(
  deveco,
  action === 'install' ? 'tools/ohpm/bin/pm-cli.js' : 'tools/hvigor/bin/hvigorw.js',
)
if (!existsSync(tool)) throw new Error(`找不到 DevEco 工具 ${tool}，请检查 DEVECO_HOME。`)
await initHarmony()
const java = process.env.JAVA_HOME || path.join(deveco, 'jbr')
const env = {
  ...process.env,
  DEVECO_SDK_HOME: process.env.DEVECO_SDK_HOME || path.join(deveco, 'sdk'),
  JAVA_HOME: java,
}
const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH'
env[pathKey] = [path.join(java, 'bin'), path.dirname(node), env[pathKey] || ''].join(path.delimiter)
const args =
  action === 'install'
    ? ['install', '--all']
    : [
        '--mode',
        'module',
        '-p',
        'product=default',
        '-p',
        'module=entry@default',
        '-p',
        'buildMode=debug',
        'assembleHap',
        '--no-daemon',
      ]
const result = spawnSync(node, [tool, ...args], { cwd: host, env, stdio: 'inherit' })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
