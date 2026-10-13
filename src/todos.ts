export interface Todo {
  id: string
  title: string
  done: boolean
  category?: Category
  dueDate?: string
}
export const CATEGORIES = { personal: '生活', work: '工作', study: '学习' } as const
export type Category = keyof typeof CATEGORIES
export interface TodoDraft {
  title: string
  category: Category
  dueDate: string
}
export const STORAGE_KEY = 'react-todo:v1'

function validCategory(value: unknown): value is Category {
  return typeof value === 'string' && Object.hasOwn(CATEGORIES, value)
}
export function validDueDate(value: unknown): value is string {
  if (value === '') return true
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}
export function localToday(date = new Date()): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function isOverdue(todo: Todo, today = localToday()): boolean {
  return !todo.done && Boolean(todo.dueDate && todo.dueDate < today)
}

export function decodeTodos(value: string | undefined): Todo[] {
  if (value === undefined || value === '') return []
  const items: unknown = JSON.parse(value)
  if (
    !Array.isArray(items) ||
    !items.every(
      (item) =>
        item &&
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        item.title.trim().length > 0 &&
        item.title.length <= 120 &&
        typeof item.done === 'boolean' &&
        (item.category === undefined || validCategory(item.category)) &&
        (item.dueDate === undefined || validDueDate(item.dueDate)),
    ) ||
    new Set(items.map((item) => item.id)).size !== items.length
  ) {
    throw new Error('保存的数据格式不正确，请检查存储；原数据未被覆盖。')
  }
  return items.map(({ id, title, done, category, dueDate }) => ({
    id,
    title,
    done,
    ...(category === undefined ? {} : { category }),
    ...(dueDate === undefined ? {} : { dueDate }),
  }))
}

export function addTodo(
  items: Todo[],
  title: string,
  id: string,
  details?: Omit<TodoDraft, 'title'>,
): Todo[] {
  const text = title.trim()
  if (!text || text.length > 120) throw new Error('请输入 1–120 个字符的待办。')
  if (items.some((item) => item.id === id)) throw new Error('待办编号重复，请重试。')
  if (details && (!validCategory(details.category) || !validDueDate(details.dueDate)))
    throw new Error('请选择有效分类和截止日期。')
  return [{ id, title: text, done: false, ...details }, ...items]
}

export function updateTodo(items: Todo[], id: string, draft: TodoDraft): Todo[] {
  const title = draft.title.trim()
  if (!title || title.length > 120) throw new Error('请输入 1–120 个字符的待办。')
  if (!validCategory(draft.category) || !validDueDate(draft.dueDate))
    throw new Error('请选择有效分类和截止日期。')
  if (!items.some((item) => item.id === id)) throw new Error('待办不存在，请重新读取。')
  return items.map((item) => (item.id === id ? { ...item, ...draft, title } : item))
}

let idSequence = 0
export function newTodoId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  const bytes = new Uint32Array(2)
  if (typeof globalThis.crypto?.getRandomValues === 'function')
    globalThis.crypto.getRandomValues(bytes)
  else {
    bytes[0] = Math.floor(Math.random() * 0xffffffff)
    bytes[1] = Math.floor(Math.random() * 0xffffffff)
  }
  return `${Date.now().toString(36)}-${++idSequence}-${bytes[0].toString(36)}${bytes[1].toString(36)}`
}
