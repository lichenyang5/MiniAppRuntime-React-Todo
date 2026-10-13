export interface TaskReminder {
  taskId: string
  title: string
  atMs: number
}
export interface ReminderStatus {
  supported: boolean
  notificationEnabled: boolean
  reminders: TaskReminder[]
}
export const unsupported: ReminderStatus = {
  supported: false,
  notificationEnabled: false,
  reminders: [],
}

export function decodeReminderStatus(value: unknown): ReminderStatus {
  if (
    !value ||
    typeof value !== 'object' ||
    !('supported' in value) ||
    !('notificationEnabled' in value) ||
    !('reminders' in value) ||
    typeof value.supported !== 'boolean' ||
    typeof value.notificationEnabled !== 'boolean' ||
    !Array.isArray(value.reminders)
  )
    throw new Error('提醒状态响应无效，请刷新确认')
  const reminders: TaskReminder[] = value.reminders.map((item: unknown) => {
    if (
      !item ||
      typeof item !== 'object' ||
      !('taskId' in item) ||
      !('title' in item) ||
      !('atMs' in item) ||
      typeof item.taskId !== 'string' ||
      typeof item.title !== 'string' ||
      typeof item.atMs !== 'number' ||
      !Number.isFinite(item.atMs)
    )
      throw new Error('提醒数据无效')
    return { taskId: item.taskId, title: item.title, atMs: item.atMs }
  })
  return { supported: value.supported, notificationEnabled: value.notificationEnabled, reminders }
}
export function localReminderTime(atMs: number) {
  const date = new Date(atMs)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export function parseReminderTime(value: string, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('请选择提醒时间')
  const time = new Date(value).getTime()
  if (!Number.isFinite(time) || localReminderTime(time) !== value) throw new Error('提醒日期无效')
  if (time < now + 60000) throw new Error('提醒时间至少需要在一分钟后')
  return time
}
export function reminderError(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return String(error)
}
