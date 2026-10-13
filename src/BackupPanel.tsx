import {
  ERROR_CODE_TIMEOUT,
  ERROR_CODE_INVALID_RESPONSE,
} from '@lcy453/miniapp-runtime-harmony-web-sdk'
import { useEffect, useRef, useState } from 'react'
import type { Todo } from './todos'
import { decodeBackup, encodeBackup, MAX_BACKUP_BYTES, planImport } from './backup'
import type { ImportPlan } from './backup'
import { usesNativeFiles, copyBackup, nativeBackupFile } from './runtime'

const explain = (error: unknown) =>
  error instanceof Error
    ? error.message
    : error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : String(error)

export function BackupPanel({
  todos,
  disabled,
  onBusy,
  onImport,
}: {
  todos: Todo[]
  disabled: boolean
  onBusy: (value: boolean) => void
  onImport: (next: Todo[], saved: () => void) => void
}) {
  const [output, setOutput] = useState('')
  const [input, setInput] = useState('')
  const [preview, setPreview] = useState<{ base: Todo[]; plan: ImportPlan } | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [])
  const plan = preview?.base === todos ? preview.plan : null
  const inactive = disabled || busy
  const nativeFiles = usesNativeFiles()
  const [pickerUncertain, setPickerUncertain] = useState(false)

  function exportText() {
    try {
      setOutput(encodeBackup(todos))
      setMessage('备份已生成，包含当前全部待办。请复制或保存为 JSON 文件。')
    } catch (error) {
      setMessage(explain(error))
    }
  }
  async function copy() {
    const signal = lifetime.current?.signal
    if (inactive || lock.current || !signal || signal.aborted) return
    lock.current = true
    setBusy(true)
    onBusy(true)
    try {
      await copyBackup(output, signal)
      if (!signal.aborted) setMessage('备份已复制到剪贴板，请粘贴到文件或其他设备保存。')
    } catch (error) {
      if (!signal.aborted) setMessage('复制失败：' + explain(error) + '。可长按备份文本手动复制。')
    } finally {
      lock.current = false
      if (!signal.aborted) {
        setBusy(false)
        onBusy(false)
      }
    }
  }
  async function readFile(file: File | undefined) {
    const signal = lifetime.current?.signal
    if (!file || inactive || lock.current || !signal || signal.aborted) return
    lock.current = true
    setBusy(true)
    onBusy(true)
    setPreview(null)
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('备份不能超过 1 MiB')
      const text = await file.text()
      if (!signal.aborted) {
        setInput(text)
        setMessage('文件已读取，请预览导入。')
      }
    } catch (error) {
      if (!signal.aborted) {
        setInput('')
        setMessage(explain(error))
      }
    } finally {
      lock.current = false
      if (!signal.aborted) {
        setBusy(false)
        onBusy(false)
      }
    }
  }
  async function pick(action: 'saveFile' | 'openFile') {
    const signal = lifetime.current?.signal
    if (inactive || pickerUncertain || lock.current || !signal || signal.aborted) return
    lock.current = true
    setBusy(true)
    onBusy(true)
    try {
      const result = await nativeBackupFile(
        action,
        action === 'saveFile' ? output : undefined,
        signal,
      )
      if (signal.aborted) return
      if (result.cancelled) {
        setMessage('已取消文件选择，原内容保留。')
        return
      }
      if (action === 'openFile') {
        setInput(result.text!)
        setPreview(null)
        setMessage('文件已读取，请预览导入。')
      } else setMessage('备份文件已保存到选择的位置。')
    } catch (error) {
      if (signal.aborted) return
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
      if ([ERROR_CODE_TIMEOUT, ERROR_CODE_INVALID_RESPONSE].includes(Number(code))) {
        setPickerUncertain(true)
        setMessage(
          '文件操作结果待确认。请关闭系统选择器并退出重启应用，再核对目标文件；不要重复保存。',
        )
      } else setMessage('文件操作失败：' + explain(error) + '。原导入内容保留。')
    } finally {
      lock.current = false
      if (!signal.aborted) {
        setBusy(false)
        onBusy(false)
      }
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([output], { type: 'application/json;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'runtime-todo-backup.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <section className="board backup-panel" aria-label="数据备份">
      <h2>数据备份</h2>
      <p>导出全部待办；导入仅添加新编号，已有事项保留当前内容。</p>
      <button type="button" className="primary" disabled={inactive} onClick={exportText}>
        生成备份
      </button>
      {output && (
        <>
          <label htmlFor="backup-output">备份 JSON</label>
          <textarea id="backup-output" readOnly value={output} rows={6} />
          <div className="edit-actions">
            <button className="quiet" disabled={inactive} onClick={() => void copy()}>
              复制备份
            </button>
            {nativeFiles && (
              <button
                className="quiet"
                disabled={inactive || pickerUncertain}
                onClick={() => void pick('saveFile')}
              >
                保存 JSON 文件
              </button>
            )}

            {!nativeFiles && (
              <button className="quiet" disabled={inactive} onClick={download}>
                下载 JSON
              </button>
            )}
          </div>
        </>
      )}
      <label htmlFor="backup-input">粘贴备份 JSON</label>
      <textarea
        id="backup-input"
        value={input}
        rows={5}
        disabled={inactive}
        onChange={(event) => {
          setInput(event.target.value)
          setPreview(null)
          setMessage('')
        }}
        placeholder="在这里粘贴备份，先预览再确认导入"
      />
      {nativeFiles && (
        <button
          type="button"
          className="quiet"
          disabled={inactive || pickerUncertain}
          onClick={() => void pick('openFile')}
        >
          从文件导入
        </button>
      )}
      {!nativeFiles && (
        <label>
          选择 JSON 文件
          <input
            type="file"
            accept=".json,application/json"
            disabled={inactive}
            onChange={(event) => {
              void readFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </label>
      )}
      <button
        className="quiet"
        disabled={inactive || !input.trim()}
        onClick={() => {
          try {
            setPreview({ base: todos, plan: planImport(todos, decodeBackup(input)) })
            setMessage('')
          } catch (error) {
            setPreview(null)
            setMessage(explain(error))
          }
        }}
      >
        预览导入
      </button>
      {preview && !plan && <p>待办已变化，请重新预览导入。</p>}
      {plan && (
        <div className="import-preview" aria-label="导入预览">
          <p>
            新增 {plan.added} 项 · 重复跳过 {plan.skipped} 项 · 冲突保留现有 {plan.conflicts.length}{' '}
            项
          </p>
          {plan.conflicts.length > 0 && (
            <details>
              <summary>查看冲突事项</summary>
              <ul>
                {plan.conflicts.map((item) => (
                  <li key={item.id}>{item.title}</li>
                ))}
              </ul>
            </details>
          )}
          <button
            className="primary"
            disabled={inactive || plan.added === 0}
            onClick={() => {
              if (lock.current || disabled || !plan) return
              onImport(plan.next, () => {
                setInput('')
                setPreview(null)
                setMessage('备份导入已保存')
              })
            }}
          >
            确认合并导入
          </button>
          <button className="quiet" disabled={inactive} onClick={() => setPreview(null)}>
            取消导入
          </button>
        </div>
      )}
      <p className="backup-feedback" role="status">
        {busy ? '正在处理备份…' : message}
      </p>
    </section>
  )
}
