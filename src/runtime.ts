import {
  createTypedApi,
  initMyASCF,
  ERROR_CODE_INVALID_RESPONSE,
} from '@lcy453/miniapp-runtime-harmony-web-sdk'
import { decodeTodos, STORAGE_KEY } from './todos'
import type { Todo } from './todos'

const client = initMyASCF()
const api = createTypedApi(client)
type ProxyWindow = Window & { MyASCFNative?: { postMessage?: unknown } }
export const browserPreview = !/^(resource|file):$/.test(location.protocol)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForNative(signal?: AbortSignal) {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (signal?.aborted) throw new DOMException('页面已退出', 'AbortError')
    if (typeof (window as ProxyWindow).MyASCFNative?.postMessage === 'function') return
    await sleep(100)
  }
  throw new Error('未连接鸿蒙 Runtime，请检查 Index.ets 的 JavaScriptProxy 配置后重试。')
}

export async function loadTodos(signal?: AbortSignal): Promise<Todo[]> {
  if (browserPreview && !(window as ProxyWindow).MyASCFNative) {
    return decodeTodos(localStorage.getItem(STORAGE_KEY) ?? undefined)
  }
  await waitForNative(signal)
  const result = await api.system.storage.getItem({ key: STORAGE_KEY }, { signal })
  return decodeTodos(result.data?.value)
}

export async function saveTodos(items: Todo[], signal?: AbortSignal) {
  const value = JSON.stringify(items)
  if (browserPreview && !(window as ProxyWindow).MyASCFNative) {
    localStorage.setItem(STORAGE_KEY, value)
    return
  }
  await api.system.storage.setItem({ key: STORAGE_KEY, value }, { signal })
}

export async function notify(message: string, signal?: AbortSignal) {
  if (browserPreview && !(window as ProxyWindow).MyASCFNative) return
  await api.ui.showToast({ message }, { signal })
}

export function storageLabel() {
  return browserPreview && !(window as ProxyWindow).MyASCFNative
    ? '浏览器预览 · 本地存储'
    : '鸿蒙 Runtime · 原生存储'
}

export async function copyBackup(text: string, signal?: AbortSignal) {
  if (browserPreview && !(window as ProxyWindow).MyASCFNative) {
    if (signal?.aborted) throw new DOMException('页面已退出', 'AbortError')
    if (!navigator.clipboard?.writeText) throw new Error('当前浏览器不支持自动复制')
    await navigator.clipboard.writeText(text)
    return
  }
  await waitForNative(signal)
  await api.system.clipboard.writeText({ text }, { signal })
}

export function usesNativeFiles() {
  return !browserPreview || typeof (window as ProxyWindow).MyASCFNative?.postMessage === 'function'
}
export async function nativeBackupFile(
  action: 'saveFile' | 'openFile',
  text?: string,
  signal?: AbortSignal,
): Promise<{ cancelled: boolean; text?: string }> {
  await waitForNative(signal)
  let response
  try {
    response = await client.send('app.backup.' + action, action === 'saveFile' ? { text } : {}, {
      signal,
      timeout: 120000,
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 1001)
      throw new Error('此宿主未接入原生文件备份，请更新鸿蒙宿主，或使用复制粘贴备份', {
        cause: error,
      })
    throw error
  }
  const data = response.data
  if (
    !data ||
    typeof data.cancelled !== 'boolean' ||
    (!data.cancelled && action === 'openFile' && typeof data.text !== 'string')
  ) {
    throw Object.assign(new Error('文件操作响应无效，请退出重启后核对文件'), {
      code: ERROR_CODE_INVALID_RESPONSE,
    })
  }
  return {
    cancelled: data.cancelled,
    ...(typeof data.text === 'string' ? { text: data.text } : {}),
  }
}
