import { constants } from 'node:fs'
import { copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const host = path.join(root, 'harmony')
export async function initHarmony() {
  try {
    await copyFile(
      path.join(host, 'build-profile.template.json5'),
      path.join(host, 'build-profile.json5'),
      constants.COPYFILE_EXCL,
    )
    console.log('已生成 harmony/build-profile.json5，请在 DevEco 中配置本机签名。')
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    console.log('保留已有 harmony/build-profile.json5（含本地 SDK/签名配置）。')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await initHarmony()
