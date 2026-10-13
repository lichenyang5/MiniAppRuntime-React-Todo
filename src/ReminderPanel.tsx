import { useEffect, useRef, useState } from 'react'
import type { Todo } from './todos'
import type { ReminderStatus } from './reminders'
import { localReminderTime, parseReminderTime, reminderError } from './reminders'
import { reminderCall } from './runtime'

export function ReminderPanel({
  todos,
  disabled,
  revision,
  onBusy,
}: {
  todos: Todo[]
  disabled: boolean
  revision: number
  onBusy: (busy: boolean) => void
}) {
  const [state, setState] = useState<ReminderStatus | null>(null)
  const [taskId, setTaskId] = useState('')
  const [time, setTime] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const lifetime = useRef<AbortController | null>(null)
  const lock = useRef(false)
  const operation = useRef(0)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    const refresh = () => {
      const ticket = operation.current
      if (lock.current) return
      void reminderCall('status', {}, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted && ticket === operation.current) {
            setState(result)
            setMessage('')
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted && ticket === operation.current)
            setMessage(reminderError(error))
        })
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => {
      controller.abort()
      window.removeEventListener('focus', refresh)
    }
  }, [revision])

  async function run(action: 'requestPermission' | 'schedule' | 'cancel', id = taskId) {
    const signal = lifetime.current?.signal
    if (disabled || lock.current || !signal || signal.aborted) return
    const params: Record<string, unknown> = {}
    try {
      if (action === 'schedule') {
        const todo = todos.find((item) => item.id === id && !item.done)
        if (!todo) throw new Error('请选择待完成事项')
        params.taskId = id
        params.title = todo.title
        params.atMs = parseReminderTime(time)
      } else if (action === 'cancel') params.taskId = id
    } catch (error) {
      setMessage(reminderError(error))
      return
    }
    operation.current++
    lock.current = true
    setBusy(true)
    onBusy(true)
    setMessage('')
    try {
      const result = await reminderCall(action, params, signal)
      if (signal.aborted) return
      setState(result)
      setMessage(
        action === 'schedule'
          ? '提醒已交给鸿蒙系统'
          : action === 'cancel'
            ? '提醒已取消'
            : result.notificationEnabled
              ? '通知已开启'
              : '通知尚未开启，可在系统设置中允许通知',
      )
    } catch (error) {
      if (signal.aborted) return
      setMessage(`操作结果待确认：${reminderError(error)}。请刷新提醒核对后继续。`)
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
      if (code === 1700002) setMessage(reminderError(error))
      else setState(null)
    } finally {
      lock.current = false
      if (!signal.aborted) {
        setBusy(false)
        onBusy(false)
      }
    }
  }

  async function refresh() {
    const signal = lifetime.current?.signal
    if (lock.current || !signal || signal.aborted) return
    operation.current++
    lock.current = true
    setBusy(true)
    onBusy(true)
    try {
      const result = await reminderCall('status', {}, signal)
      if (!signal.aborted) {
        setState(result)
        setMessage('已刷新提醒状态')
      }
    } catch (error) {
      if (!signal.aborted) {
        setState(null)
        setMessage(reminderError(error))
      }
    } finally {
      lock.current = false
      if (!signal.aborted) {
        setBusy(false)
        onBusy(false)
      }
    }
  }
  const inactive = disabled || busy
  return (
    <section className="board reminder-panel" aria-label="待办提醒">
      <h2>待办提醒</h2>
      <p>提醒时间独立于截止日期；修改待办内容后，请取消旧提醒并重新设置。</p>
      {state?.supported === false ? (
        <p>当前环境不支持原生提醒，请在本项目的鸿蒙宿主中使用。</p>
      ) : (
        state?.supported && (
          <>
            {!state.notificationEnabled && (
              <button
                className="primary"
                disabled={inactive}
                onClick={() => void run('requestPermission')}
              >
                开启通知
              </button>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void run('schedule')
              }}
            >
              <label htmlFor="reminder-task">提醒事项</label>
              <select
                id="reminder-task"
                value={taskId}
                disabled={inactive}
                onChange={(event) => setTaskId(event.target.value)}
              >
                <option value="">请选择待办</option>
                {todos
                  .filter((todo) => !todo.done)
                  .map((todo) => (
                    <option key={todo.id} value={todo.id}>
                      {todo.title}
                    </option>
                  ))}
              </select>
              <label htmlFor="reminder-time">提醒时间</label>
              <input
                id="reminder-time"
                type="datetime-local"
                value={time}
                disabled={inactive}
                onChange={(event) => setTime(event.target.value)}
              />
              <div className="edit-actions">
                <button
                  type="button"
                  className="quiet"
                  disabled={inactive}
                  onClick={() =>
                    setTime(localReminderTime(Math.ceil(Date.now() / 60000) * 60000 + 120000))
                  }
                >
                  2分钟后
                </button>
                <button
                  className="primary"
                  disabled={inactive || !state.notificationEnabled || !taskId || !time}
                >
                  设置提醒
                </button>
              </div>
            </form>
            <ul className="reminder-list">
              {state.reminders.map((item) => (
                <li key={item.taskId}>
                  <span>
                    {item.title}
                    <small>{localReminderTime(item.atMs).replace('T', ' ')}</small>
                  </span>
                  <button
                    className="quiet"
                    disabled={inactive}
                    onClick={() => void run('cancel', item.taskId)}
                    aria-label={`取消提醒：${item.title}`}
                  >
                    取消提醒
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      )}
      <button type="button" className="quiet" disabled={inactive} onClick={() => void refresh()}>
        刷新提醒
      </button>
      <p aria-live="polite">{busy ? '正在处理提醒…' : message}</p>
    </section>
  )
}
