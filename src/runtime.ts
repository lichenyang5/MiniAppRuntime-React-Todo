import { createTypedApi, initMyASCF } from '@lcy453/miniapp-runtime-harmony-web-sdk'
import { decodeTodos, STORAGE_KEY } from './todos'
import type { Todo } from './todos'

const api = createTypedApi(initMyASCF())
type ProxyWindow = Window & { MyASCFNative?: { postMessage?: unknown } }
export const browserPreview = !/^(resource|file):$/.test(location.protocol)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForNative() {
  for (let attempt = 0; attempt < 30; attempt++) {
    if (typeof (window as ProxyWindow).MyASCFNative?.postMessage === 'function') return
    await sleep(100)
  }
  throw new Error('未连接鸿蒙 Runtime，请检查 Index.ets 的 JavaScriptProxy 配置后重试。')
}

export async function loadTodos(): Promise<Todo[]> {
  if (browserPreview && !(window as ProxyWindow).MyASCFNative) {
    return decodeTodos(localStorage.getItem(STORAGE_KEY) ?? undefined)
  }
  await waitForNative()
  const result = await api.system.storage.getItem({ key: STORAGE_KEY })
  return decodeTodos(result.data?.value)
}

export async function saveTodos(items: Todo[]) {
  const value = JSON.stringify(items)
  if (browserPreview && !(window as ProxyWindow).MyASCFNative) {
    localStorage.setItem(STORAGE_KEY, value)
    return
  }
  await api.system.storage.setItem({ key: STORAGE_KEY, value })
}

export async function notify(message: string) {
  if (browserPreview && !(window as ProxyWindow).MyASCFNative) return
  await api.ui.showToast({ message })
}

export function storageLabel() {
  return browserPreview && !(window as ProxyWindow).MyASCFNative
    ? '浏览器预览 · 本地存储' : '鸿蒙 Runtime · 原生存储'
}
