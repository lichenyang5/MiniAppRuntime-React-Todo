import { createTypedApi, initMyASCF } from '@lcy453/miniapp-runtime-harmony-web-sdk'
import { decodeTodos, STORAGE_KEY } from './todos'
import type { Todo } from './todos'

import { decodeReminderStatus, unsupported } from './reminders'
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

export async function reminderCall(
  action: 'status' | 'requestPermission' | 'schedule' | 'cancel',
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
) {
  if (browserPreview && !(window as ProxyWindow).MyASCFNative) return unsupported
  await waitForNative(signal)
  try {
    const response = await client.send('app.reminder.' + action, params, {
      signal,
      timeout: action === 'requestPermission' ? 60000 : 15000,
    })
    return decodeReminderStatus(response.data)
  } catch (error) {
    if (
      action === 'status' &&
      error &&
      typeof error === 'object' &&
      'message' in error &&
      /UNKNOWN_ACTION|unknown action|未注册|不支持.*action/i.test(String(error.message))
    )
      return unsupported
    throw error
  }
}
