export interface Todo { id: string; title: string; done: boolean }
export const STORAGE_KEY = 'react-todo:v1'

export function decodeTodos(value: string | undefined): Todo[] {
  if (value === undefined || value === '') return []
  const items: unknown = JSON.parse(value)
  if (!Array.isArray(items) || !items.every((item) =>
    item && typeof item.id === 'string' && typeof item.title === 'string' &&
    item.title.trim().length > 0 && item.title.length <= 120 && typeof item.done === 'boolean'
  ) || new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error('保存的数据格式不正确，请检查存储；原数据未被覆盖。')
  }
  return items.map(({ id, title, done }) => ({ id, title, done }))
}

export function addTodo(items: Todo[], title: string, id: string): Todo[] {
  const text = title.trim()
  if (!text || text.length > 120) throw new Error('请输入 1–120 个字符的待办。')
  if (items.some((item) => item.id === id)) throw new Error('待办编号重复，请重试。')
  return [{ id, title: text, done: false }, ...items]
}

let idSequence = 0
export function newTodoId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  const bytes = new Uint32Array(2)
  if (typeof globalThis.crypto?.getRandomValues === 'function') globalThis.crypto.getRandomValues(bytes)
  else { bytes[0] = Math.floor(Math.random() * 0xffffffff); bytes[1] = Math.floor(Math.random() * 0xffffffff) }
  return `${Date.now().toString(36)}-${++idSequence}-${bytes[0].toString(36)}${bytes[1].toString(36)}`
}
