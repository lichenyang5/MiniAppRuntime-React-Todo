import { expect, test } from '@playwright/test'
import { nativeSimulator } from './native-simulator'

const saved = JSON.stringify([{ id: 'existing', title: '原有待办', done: false }])
const input = (page: Parameters<typeof nativeSimulator>[0]) =>
  page.getByRole('textbox', { name: '新待办' })
async function add(page: Parameters<typeof nativeSimulator>[0], title = '新待办内容') {
  await input(page).fill(title)
  await page.getByRole('button', { name: '＋ 添加' }).click()
}

test('successful save survives reload and uses native storage', async ({ page }) => {
  const native = await nativeSimulator(page)
  await page.goto('/')
  await expect(page.getByText('● 鸿蒙 Runtime · 原生存储')).toBeVisible()
  await add(page)
  await expect(page.getByText('已添加待办', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('新待办内容', { exact: true })).toBeVisible()
  expect(native.writes()).toHaveLength(1)
  expect(native.toasts()).toHaveLength(1)
})

test('definite save failure retains old tasks and allows retry', async ({ page }) => {
  const native = await nativeSimulator(page, saved)
  native.setWriteMode('fail')
  await page.goto('/')
  await add(page)
  await expect(page.getByRole('alert')).toContainText('SIMULATED_STORAGE_FAILURE (1100)')
  await expect(page.getByText('原有待办', { exact: true })).toBeVisible()
  await expect(page.getByText('新待办内容', { exact: true })).toHaveCount(0)
  await expect(input(page)).toHaveValue('新待办内容')
  expect(native.value).toBe(saved)
  expect(native.toasts()).toHaveLength(0)
  native.setWriteMode('ok')
  await page.getByRole('button', { name: '＋ 添加' }).click()
  await expect(page.getByText('已添加待办', { exact: true })).toBeVisible()
  expect(native.writes()).toHaveLength(2)
})

test('timeout pauses editing and ignores late success until reload', async ({ page }) => {
  const native = await nativeSimulator(page, saved)
  native.setWriteMode('hold')
  await page.goto('/')
  await add(page)
  await expect(page.getByRole('alert')).toContainText('保存结果尚未确认')
  await expect(input(page)).toBeDisabled()
  await expect(page.getByRole('button', { name: '＋ 添加' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '重新连接' })).toHaveCount(0)
  native.releaseWrites()
  await expect.poll(() => native.recorded(native.writes()[0].requestId, 'callback_lost')).toBe(true)
  await expect(input(page)).toBeDisabled()
  expect(native.writes()).toHaveLength(1)
  expect(native.toasts()).toHaveLength(0)
  await page.reload()
  await expect(page.getByText('新待办内容', { exact: true })).toBeVisible()
  await expect(input(page)).toBeEnabled()
  expect(native.writes()).toHaveLength(1)
})

test('invalid native write response pauses editing', async ({ page }) => {
  const native = await nativeSimulator(page, saved)
  native.setWriteMode('invalid')
  await page.goto('/')
  await add(page)
  await expect(page.getByRole('alert')).toContainText('INVALID_RESPONSE')
  await expect(input(page)).toBeDisabled()
  expect(native.writes()).toHaveLength(1)
})

test('corrupt native storage cannot be overwritten by an empty list', async ({ page }) => {
  const native = await nativeSimulator(page, '{broken')
  await page.goto('/')
  await expect(page.getByText('暂时无法读取待办。')).toBeVisible()
  await expect(input(page)).toBeDisabled()
  await page.getByRole('button', { name: '重新连接' }).click()
  await expect(page.getByText('暂时无法读取待办。')).toBeVisible()
  expect(native.writes()).toHaveLength(0)
  expect(native.value).toBe('{broken')
})

test('Toast failure reports saved data without rolling back', async ({ page }) => {
  const native = await nativeSimulator(page)
  native.failToast()
  await page.goto('/')
  await add(page)
  await expect(page.getByText(/数据已保存，Toast 失败/)).toBeVisible()
  await page.reload()
  await expect(page.getByText('新待办内容', { exact: true })).toBeVisible()
  expect(native.writes()).toHaveLength(1)
})

test('rapid duplicate submission performs one native write', async ({ page }) => {
  const native = await nativeSimulator(page)
  native.setWriteMode('hold')
  await page.goto('/')
  await input(page).fill('快速提交')
  await page.locator('form').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
  await expect.poll(() => native.writes().length).toBe(1)
  native.releaseWrites()
  await expect(page.getByText('快速提交', { exact: true })).toBeVisible()
  expect(native.writes()).toHaveLength(1)
})

test('unmount releases pending save and prevents late Toast', async ({ page }) => {
  const native = await nativeSimulator(page)
  native.setWriteMode('hold')
  await page.goto('/tests/fixtures/lifecycle.html')
  await add(page)
  await expect.poll(() => native.writes().length).toBe(1)
  await page.evaluate(() =>
    (window as unknown as Window & { unmountTodo: () => void }).unmountTodo(),
  )
  const requestId = native.writes()[0].requestId
  await expect.poll(() => native.recorded(requestId, 'cancelled')).toBe(true)
  native.releaseWrites()
  await expect.poll(() => native.recorded(requestId, 'late_after_abort')).toBe(true)
  await expect(page.locator('#root')).toBeEmpty()
  expect(native.toasts()).toHaveLength(0)
})

test('reload with an outstanding save restores data without another write', async ({ page }) => {
  const native = await nativeSimulator(page)
  native.setWriteMode('hold')
  await page.goto('/')
  await add(page)
  await expect.poll(() => native.writes().length).toBe(1)
  await page.reload()
  native.releaseWrites()
  await expect(page.getByText('新待办内容', { exact: true })).toBeVisible()
  await expect(input(page)).toBeEnabled()
  expect(native.writes()).toHaveLength(1)
  expect(native.toasts()).toHaveLength(0)
})
