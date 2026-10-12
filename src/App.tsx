import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { addTodo, newTodoId } from './todos'
import { ERROR_CODE_TIMEOUT, ERROR_CODE_INVALID_RESPONSE } from '@lcy453/miniapp-runtime-harmony-web-sdk'
import type { Todo } from './todos'
import { loadTodos, notify, saveTodos, storageLabel } from './runtime'
import './App.css'

type Filter = 'all' | 'active' | 'done'
const errorCode = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
const errorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) return `${String(error.message)} (${String(errorCode(error) ?? 'UNKNOWN')})`
  return String(error)
}

function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error' | 'uncertain'>('loading')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const locked = useRef(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    loadTodos().then((items) => {
      if (!active) return
      setTodos(items); setPhase('ready'); setError('')
    }).catch((reason: unknown) => {
      if (!active) return
      setError(errorMessage(reason)); setPhase('error')
    })
    return () => { active = false }
  }, [reload])

  async function persist(next: Todo[], success: string, afterSave?: () => void) {
    if (locked.current || phase !== 'ready') return
    locked.current = true; setBusy(true); setError(''); setMessage('')
    try {
      await saveTodos(next)
      setTodos(next); afterSave?.(); setMessage(success)
      try { await notify(success) }
      catch (reason) { setMessage(`${success}（数据已保存，Toast 失败：${errorMessage(reason)}）`) }
    } catch (reason) {
      if ([ERROR_CODE_TIMEOUT, ERROR_CODE_INVALID_RESPONSE].includes(Number(errorCode(reason)))) {
        setPhase('uncertain')
        setError(`保存结果尚未确认：${errorMessage(reason)}。请彻底退出并重新启动应用，读取最终存储结果后继续。`)
      } else { setError(`保存失败，页面保留原内容：${errorMessage(reason)}`) }
    } finally { locked.current = false; setBusy(false) }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    try { void persist(addTodo(todos, title, newTodoId()), '已添加待办', () => setTitle('')) }
    catch (reason) { setError(errorMessage(reason)) }
  }

  const completed = todos.filter((item) => item.done).length
  const visible = todos.filter((item) => filter === 'all' || (filter === 'done' ? item.done : !item.done))
  const disabled = phase !== 'ready' || busy

  return <main className="workspace">
    <header><span className="eyebrow">MINIAPP RUNTIME / REACT</span><h1>留点时间，<br />完成重要的小事。</h1>
      <p>把想法记下来，一件一件完成。</p><span className="connection">● {storageLabel()}</span></header>
    <section className="board" aria-label="待办事项">
      <div className="board-heading"><h2>我的待办 <span>{todos.length - completed}</span></h2><small>{completed} 项已完成</small></div>
      <form onSubmit={submit}><label className="sr-only" htmlFor="todo-title">新待办</label>
        <input id="todo-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} disabled={disabled} placeholder="接下来想完成什么？" autoComplete="off" />
        <button className="primary" disabled={disabled || !title.trim()} type="submit">＋ 添加</button></form>
      <div className="toolbar"><div className="filters" aria-label="筛选待办">
        {([['all', '全部'], ['active', '待完成'], ['done', '已完成']] as const).map(([value, label]) =>
          <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
      </div><button className="quiet" disabled={disabled || completed === 0} onClick={() => void persist(todos.filter((item) => !item.done), '已清理完成事项')}>清理已完成</button></div>
      {phase === 'uncertain' ? <p className="empty">保存结果待确认，已暂停编辑。请退出并重新启动应用。</p> : phase === 'loading' ? <p className="empty">正在读取待办…</p> : phase === 'error' ?
        <div className="empty"><p>暂时无法读取待办。</p><button onClick={() => { setPhase('loading'); setReload((value) => value + 1) }}>重新连接</button></div> :
        visible.length === 0 ? <div className="empty"><span>○</span><p>{todos.length === 0 ? '从一件小事开始吧。' : '这个分类暂时没有待办。'}</p></div> :
        <ul className="todo-list">{visible.map((item) => <li key={item.id} className={item.done ? 'done' : ''}>
          <label><input type="checkbox" checked={item.done} disabled={disabled} onChange={() => void persist(todos.map((todo) => todo.id === item.id ? { ...todo, done: !todo.done } : todo), item.done ? '已恢复待办' : '已完成待办')} /><span>{item.title}</span></label>
          <button className="delete" disabled={disabled} aria-label={`删除：${item.title}`} onClick={() => void persist(todos.filter((todo) => todo.id !== item.id), '已删除待办')}>×</button>
        </li>)}</ul>}
      <div className="feedback" aria-live="polite">{busy ? '正在保存…' : message}</div>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
    <footer>每一步，都算数。<span>React Todo · MiniAppRuntime</span></footer>
  </main>
}
export default App
