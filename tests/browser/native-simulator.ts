import type { Page } from '@playwright/test'

interface Request {
  requestId: string
  action: string
  params: { key?: string; value?: string; message?: string; text?: string }
}
interface Response {
  requestId: string
  code: number | string
  message: string
  data?: { value?: string; echoAction?: string; cancelled?: boolean; text?: string }
}
interface DebugRecord {
  requestId: string
  status: string
}
export async function nativeSimulator(page: Page, initialValue = '[]') {
  const requests: Request[] = []
  let value = initialValue
  let writeMode: 'ok' | 'fail' | 'hold' | 'invalid' = 'ok'
  let toastFails = false
  let fileText = '[]'
  let fileMode: 'ok' | 'cancel' | 'fail' | 'invalid' | 'hold' = 'ok'
  const pendingFiles: Array<() => void> = []
  const pending: Array<() => void> = []
  await page.exposeFunction('__testNativeSend', async (raw: string): Promise<Response> => {
    const request: Request = JSON.parse(raw)
    requests.push(request)
    const success: Response = {
      requestId: request.requestId,
      code: 0,
      message: 'SUCCESS',
      data: { echoAction: request.action },
    }
    if (request.action.startsWith('app.backup.')) {
      if (fileMode === 'fail') return { ...success, code: 2011, message: 'SIMULATED_FILE_FAILURE' }
      if (fileMode === 'invalid') return { ...success, data: {} }
      if (fileMode === 'hold') await new Promise<void>((resolve) => pendingFiles.push(resolve))
      if (fileMode === 'cancel') return { ...success, data: { cancelled: true } }
      if (request.action === 'app.backup.saveFile') fileText = request.params.text!
      return {
        ...success,
        data: {
          cancelled: false,
          ...(request.action === 'app.backup.openFile' ? { text: fileText } : {}),
        },
      }
    }
    if (request.action === 'system.storage.getItem') return { ...success, data: { value } }
    if (request.action === 'system.storage.setItem') {
      if (writeMode === 'fail')
        return { ...success, code: 1100, message: 'SIMULATED_STORAGE_FAILURE' }
      if (writeMode === 'invalid') return { ...success, code: 'malformed' }
      value = request.params.value!
      if (writeMode === 'hold') await new Promise<void>((resolve) => pending.push(resolve))
    }
    if (request.action === 'ui.showToast' && toastFails)
      return { ...success, code: 1101, message: 'SIMULATED_TOAST_FAILURE' }
    return success
  })
  await page.addInitScript(() => {
    const target = window as unknown as Window & {
      MyASCFNative: { postMessage: (raw: string) => void }
      __testNativeSend: (raw: string) => Promise<unknown>
      __myascf_on_native_response__?: (response: unknown) => void
      __testDebugRecords: DebugRecord[]
    }
    target.__testDebugRecords = []
    const panel = target as unknown as {
      MyASCFDebugPanel: Record<string, (record: DebugRecord) => void>
    }
    panel.MyASCFDebugPanel = Object.fromEntries(
      ['recordAbort', 'recordLateAfterAbort', 'recordLost'].map((method) => [
        method,
        (record: DebugRecord) => target.__testDebugRecords.push(record),
      ]),
    )
    target.MyASCFNative = {
      postMessage(raw) {
        void target
          .__testNativeSend(raw)
          .then((response) => target.__myascf_on_native_response__?.(response))
      },
    }
  })
  return {
    requests,
    setFileMode(mode: typeof fileMode) {
      fileMode = mode
    },
    setFileText(text: string) {
      fileText = text
    },
    get fileText() {
      return fileText
    },
    releaseFiles() {
      pendingFiles.splice(0).forEach((resolve) => resolve())
    },
    async recorded(requestId: string, status: string) {
      return page.evaluate(
        ({ requestId, status }) =>
          (window as unknown as { __testDebugRecords: DebugRecord[] }).__testDebugRecords.some(
            (record) => record.requestId === requestId && record.status === status,
          ),
        { requestId, status },
      )
    },
    get value() {
      return value
    },
    setWriteMode(mode: typeof writeMode) {
      writeMode = mode
    },
    failToast() {
      toastFails = true
    },
    releaseWrites() {
      pending.splice(0).forEach((resolve) => resolve())
    },
    writes() {
      return requests.filter((request) => request.action === 'system.storage.setItem')
    },
    toasts() {
      return requests.filter((request) => request.action === 'ui.showToast')
    },
  }
}
