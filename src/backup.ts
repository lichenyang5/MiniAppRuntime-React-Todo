import { decodeTodos } from './todos.ts'
import type { Todo } from './todos.ts'

export const MAX_BACKUP_BYTES = 1024 * 1024
export const MAX_TODOS = 5000
export interface ImportPlan {
  next: Todo[]
  added: number
  skipped: number
  conflicts: Todo[]
}
function validate(items: Todo[]): Todo[] {
  if (items.length > MAX_TODOS || items.some((item) => !item.id.trim() || item.id.length > 128))
    throw new Error('备份最多支持 5000 项，每项编号为 1–128 个字符')
  return items
}
export function decodeBackup(text: string): Todo[] {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error('备份不能超过 1 MiB')
  let value: unknown
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('请输入有效的 JSON 备份')
  }
  if (Array.isArray(value)) return validate(decodeTodos(JSON.stringify(value)))
  if (
    !value ||
    typeof value !== 'object' ||
    !('format' in value) ||
    value.format !== 'miniappruntime-react-todo' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('todos' in value) ||
    !Array.isArray(value.todos)
  )
    throw new Error('备份格式或版本不支持')
  return validate(decodeTodos(JSON.stringify(value.todos)))
}
export function encodeBackup(items: Todo[], date = new Date()): string {
  const text = JSON.stringify(
    {
      format: 'miniappruntime-react-todo',
      version: 1,
      exportedAt: date.toISOString(),
      todos: validate(decodeTodos(JSON.stringify(items))),
    },
    null,
    2,
  )
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES)
    throw new Error('备份不能超过 1 MiB')
  return text
}
function same(left: Todo, right: Todo) {
  return (
    left.title === right.title &&
    left.done === right.done &&
    (left.category ?? 'personal') === (right.category ?? 'personal') &&
    (left.dueDate ?? '') === (right.dueDate ?? '')
  )
}
export function planImport(current: Todo[], incoming: Todo[]): ImportPlan {
  const existing = new Map(current.map((item) => [item.id, item]))
  const additions: Todo[] = []
  const conflicts: Todo[] = []
  let skipped = 0
  for (const item of incoming) {
    const old = existing.get(item.id)
    if (!old) additions.push(item)
    else if (same(old, item)) skipped++
    else conflicts.push(item)
  }
  if (current.length + additions.length > MAX_TODOS)
    throw new Error('合并后超过 5000 项，请减少导入数量')
  const next = [...additions, ...current]
  encodeBackup(next) // Imported state must remain exportable.
  return { next, added: additions.length, skipped, conflicts }
}
