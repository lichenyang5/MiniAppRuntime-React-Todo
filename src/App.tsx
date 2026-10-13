import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { addTodo, newTodoId, updateTodo, CATEGORIES, isOverdue, localToday } from './todos'
import {
  ERROR_CODE_TIMEOUT,
  ERROR_CODE_INVALID_RESPONSE,
} from '@lcy453/miniapp-runtime-harmony-web-sdk'
import type { Todo, Category, TodoDraft } from './todos'
import { loadTodos, notify, saveTodos, storageLabel, reminderCall } from './runtime'
import { ReminderPanel } from './ReminderPanel'
import './App.css'

type Filter = 'all' | 'active' | 'done'
const errorCode = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error)
    return `${String(error.message)} (${String(errorCode(error) ?? 'UNKNOWN')})`
  return String(error)
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('personal')
  const [dueDate, setDueDate] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | Category>('all')
  const [editing, setEditing] = useState<{ id: string; draft: TodoDraft } | null>(null)
  const [today, setToday] = useState(() => localToday())
  const [filter, setFilter] = useState<Filter>('all')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error' | 'uncertain'>('loading')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const locked = useRef(false)
  const lifecycle = useRef<AbortController | null>(null)
  const editorInput = useRef<HTMLInputElement | null>(null)
  const newInput = useRef<HTMLInputElement | null>(null)
  const returnFocus = useRef<HTMLButtonElement | null>(null)
  const [reload, setReload] = useState(0)
  const [reminderBusy, setReminderBusy] = useState(false)
  const [reminderRevision, setReminderRevision] = useState(0)
  const reminderLocked = useRef(false)
  const [reminderTarget, setReminderTarget] = useState('')
  const [reminderOpen, setReminderOpen] = useState(0)
  const editingId = editing?.id

  useEffect(() => {
    const receive = () => {
      try {
        const raw = (window as Window & { __todoReminderOpen__?: string }).__todoReminderOpen__
        if (!raw) return
        const value: unknown = JSON.parse(raw)
        if (
          value &&
          typeof value === 'object' &&
          'taskId' in value &&
          typeof value.taskId === 'string'
        ) {
          setFilter('all')
          setCategoryFilter('all')
          setReminderTarget(value.taskId)
          setReminderOpen((previous) => previous + 1)
        }
      } catch {
        /* Ignore unrelated or malformed launch parameters. */
      }
    }
    receive()
    window.addEventListener('todo-reminder-open', receive)
    return () => window.removeEventListener('todo-reminder-open', receive)
  }, [])
  useEffect(() => {
    if (!reminderTarget || phase !== 'ready') return
    const node = document.getElementById('todo-' + reminderTarget)
    if (node) {
      node.scrollIntoView({ block: 'center' })
      node.focus()
    }
  }, [reminderTarget, reminderOpen, phase, filter, categoryFilter, todos])

  useEffect(() => {
    if (editingId) {
      editorInput.current?.focus()
      editorInput.current?.scrollIntoView({ block: 'center' })
    }
  }, [editingId])

  useEffect(() => {
    if (!editingId && !busy && returnFocus.current) {
      if (returnFocus.current.isConnected) returnFocus.current.focus()
      else newInput.current?.focus()
      returnFocus.current = null
    }
  }, [editingId, busy])

  useEffect(() => {
    const refresh = () => setToday(localToday())
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    lifecycle.current = controller
    loadTodos(controller.signal)
      .then((items) => {
        if (!active) return
        setTodos(items)
        setPhase('ready')
        setError('')
      })
      .catch((reason: unknown) => {
        if (!active) return
        setError(errorMessage(reason))
        setPhase('error')
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [reload])

  async function persist(next: Todo[], success: string, afterSave?: () => void) {
    const signal = lifecycle.current?.signal
    if (!signal || signal.aborted || locked.current || reminderLocked.current || phase !== 'ready')
      return
    locked.current = true
    setBusy(true)
    setError('')
    setMessage('')
    let remindersCancelled = false
    let saving = false
    try {
      const removed = todos.filter(
        (todo) =>
          !next.some((item) => item.id === todo.id) ||
          (!todo.done && next.some((item) => item.id === todo.id && item.done)),
      )
      if (removed.length) {
        const state = await reminderCall('status', {}, signal)
        for (const todo of removed) {
          if (state.reminders.some((item) => item.taskId === todo.id)) {
            await reminderCall('cancel', { taskId: todo.id }, signal)
            remindersCancelled = true
          }
        }
      }
      if (signal.aborted) return
      saving = true
      await saveTodos(next, signal)
      if (signal.aborted) return
      setTodos(next)
      afterSave?.()
      setMessage(success)
      try {
        await notify(success, signal)
      } catch (reason) {
        if (!signal.aborted)
          setMessage(`${success}（数据已保存，Toast 失败：${errorMessage(reason)}）`)
      }
    } catch (reason) {
      if (signal.aborted) return
      if (
        saving &&
        [ERROR_CODE_TIMEOUT, ERROR_CODE_INVALID_RESPONSE].includes(Number(errorCode(reason)))
      ) {
        setPhase('uncertain')
        setError(
          `保存结果尚未确认：${errorMessage(reason)}。请彻底退出并重新启动应用，读取最终存储结果后继续。`,
        )
      } else {
        setError(`保存失败，页面保留原内容：${errorMessage(reason)}`)
      }
      if (remindersCancelled) setError((value) => '提醒已取消；' + value)
    } finally {
      locked.current = false
      if (!signal.aborted) {
        setBusy(false)
        setReminderRevision((value) => value + 1)
      }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    try {
      void persist(addTodo(todos, title, newTodoId(), { category, dueDate }), '已添加待办', () => {
        setTitle('')
        setDueDate('')
      })
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  function submitEdit(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    try {
      void persist(updateTodo(todos, editing.id, editing.draft), '已更新待办', () =>
        setEditing(null),
      )
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  const completed = todos.filter((item) => item.done).length
  const visible = todos.filter(
    (item) =>
      (filter === 'all' || (filter === 'done' ? item.done : !item.done)) &&
      (categoryFilter === 'all' || (item.category ?? 'personal') === categoryFilter),
  )
  const disabled = phase !== 'ready' || busy || reminderBusy

  return (
    <main className="workspace">
      <header>
        <span className="eyebrow">MINIAPP RUNTIME / REACT</span>
        <h1>
          留点时间，
          <br />
          完成重要的小事。
        </h1>
        <p>把想法记下来，一件一件完成。</p>
        <span className="connection">● {storageLabel()}</span>
      </header>
      <section className="board" aria-label="待办事项">
        <div className="board-heading">
          <h2>
            我的待办 <span>{todos.length - completed}</span>
          </h2>
          <small>{completed} 项已完成</small>
        </div>
        <form onSubmit={submit}>
          <div className="composer-row">
            <label className="sr-only" htmlFor="todo-title">
              新待办
            </label>
            <input
              id="todo-title"
              ref={newInput}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              disabled={disabled || Boolean(editing)}
              placeholder="接下来想完成什么？"
              autoComplete="off"
            />
            <button
              className="primary"
              disabled={disabled || Boolean(editing) || !title.trim()}
              type="submit"
            >
              ＋ 添加
            </button>
          </div>
          <div className="detail-fields">
            <label htmlFor="new-category">
              分类
              <select
                id="new-category"
                aria-label="新增分类"
                value={category}
                disabled={disabled || Boolean(editing)}
                onChange={(event) => setCategory(event.target.value as Category)}
              >
                {Object.entries(CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="new-due">
              截止日期（可选）
              <input
                id="new-due"
                aria-label="新增截止日期"
                type="date"
                min="0001-01-01"
                max="9999-12-31"
                value={dueDate}
                disabled={disabled || Boolean(editing)}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
          </div>
        </form>
        {editing && (
          <section className="editor" aria-label="编辑待办">
            <h3>编辑待办</h3>
            <form onSubmit={submitEdit}>
              <label htmlFor="edit-title">内容</label>
              <input
                id="edit-title"
                ref={editorInput}
                aria-label="编辑内容"
                value={editing.draft.title}
                maxLength={120}
                disabled={disabled}
                onChange={(event) =>
                  setEditing({ ...editing, draft: { ...editing.draft, title: event.target.value } })
                }
              />
              <div className="detail-fields">
                <label htmlFor="edit-category">
                  分类
                  <select
                    id="edit-category"
                    aria-label="编辑分类"
                    value={editing.draft.category}
                    disabled={disabled}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        draft: { ...editing.draft, category: event.target.value as Category },
                      })
                    }
                  >
                    {Object.entries(CATEGORIES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor="edit-due">
                  截止日期（可选）
                  <input
                    id="edit-due"
                    aria-label="编辑截止日期"
                    type="date"
                    min="0001-01-01"
                    max="9999-12-31"
                    value={editing.draft.dueDate}
                    disabled={disabled}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        draft: { ...editing.draft, dueDate: event.target.value },
                      })
                    }
                  />
                </label>
              </div>
              <div className="edit-actions">
                <button
                  className="primary"
                  type="submit"
                  disabled={disabled || !editing.draft.title.trim()}
                >
                  保存修改
                </button>
                <button
                  className="quiet"
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setEditing(null)
                    setError('')
                  }}
                >
                  取消编辑
                </button>
              </div>
            </form>
          </section>
        )}
        <div className="toolbar">
          <div className="filters" aria-label="筛选待办">
            {(
              [
                ['all', '全部'],
                ['active', '待完成'],
                ['done', '已完成'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
          <button
            className="quiet"
            disabled={disabled || Boolean(editing) || completed === 0}
            onClick={() =>
              void persist(
                todos.filter((item) => !item.done),
                '已清理完成事项',
              )
            }
          >
            清理已完成
          </button>
        </div>
        <div className="category-filter">
          <label htmlFor="category-filter">分类筛选</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as 'all' | Category)}
          >
            <option value="all">全部分类</option>
            {Object.entries(CATEGORIES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {phase === 'uncertain' ? (
          <p className="empty">保存结果待确认，已暂停编辑。请退出并重新启动应用。</p>
        ) : phase === 'loading' ? (
          <p className="empty">正在读取待办…</p>
        ) : phase === 'error' ? (
          <div className="empty">
            <p>暂时无法读取待办。</p>
            <button
              onClick={() => {
                setPhase('loading')
                setReload((value) => value + 1)
              }}
            >
              重新连接
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <span>○</span>
            <p>{todos.length === 0 ? '从一件小事开始吧。' : '这个分类暂时没有待办。'}</p>
          </div>
        ) : (
          <ul className="todo-list">
            {visible.map((item) => (
              <li
                key={item.id}
                id={'todo-' + item.id}
                tabIndex={-1}
                className={[
                  item.done ? 'done' : '',
                  reminderTarget === item.id ? 'reminder-target' : '',
                ].join(' ')}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={disabled || Boolean(editing)}
                    onChange={() =>
                      void persist(
                        todos.map((todo) =>
                          todo.id === item.id ? { ...todo, done: !todo.done } : todo,
                        ),
                        item.done ? '已恢复待办' : '已完成待办',
                      )
                    }
                  />
                  <span className="todo-copy">
                    <span className="todo-title">{item.title}</span>
                    <span className="meta-tags">
                      <span className="meta-tag">{CATEGORIES[item.category ?? 'personal']}</span>
                      {item.dueDate && (
                        <span className={isOverdue(item, today) ? 'meta-tag overdue' : 'meta-tag'}>
                          {isOverdue(item, today) ? '已逾期' : '截止'} · {item.dueDate}
                        </span>
                      )}
                    </span>
                  </span>
                </label>
                <button
                  className="quiet edit-button"
                  type="button"
                  disabled={disabled || Boolean(editing)}
                  aria-label={`编辑：${item.title}`}
                  onClick={(event) => {
                    returnFocus.current = event.currentTarget
                    setEditing({
                      id: item.id,
                      draft: {
                        title: item.title,
                        category: item.category ?? 'personal',
                        dueDate: item.dueDate ?? '',
                      },
                    })
                    setError('')
                    setMessage('')
                  }}
                >
                  编辑
                </button>
                <button
                  className="delete"
                  disabled={disabled || Boolean(editing)}
                  aria-label={`删除：${item.title}`}
                  onClick={() =>
                    void persist(
                      todos.filter((todo) => todo.id !== item.id),
                      '已删除待办',
                    )
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="feedback" aria-live="polite">
          {busy ? '正在保存…' : message}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
      {reminderTarget && phase === 'ready' && !todos.some((todo) => todo.id === reminderTarget) && (
        <p role="status">提醒对应的待办已删除。</p>
      )}
      <ReminderPanel
        todos={todos}
        disabled={phase !== 'ready' || busy || Boolean(editing)}
        revision={reminderRevision}
        onBusy={(value) => {
          reminderLocked.current = value
          setReminderBusy(value)
        }}
      />
      <footer>
        每一步，都算数。<span>React Todo · MiniAppRuntime</span>
      </footer>
    </main>
  )
}
export default App
