import { expect, test } from '@playwright/test'
import { nativeSimulator } from './native-simulator'
const original = [
  { id: 'old', title: '原有事项', done: false, category: 'work', dueDate: '2026-10-15' },
]
const incoming = {
  id: 'new',
  title: '导入事项',
  done: true,
  category: 'study',
  dueDate: '2026-10-16',
}
test('export all filters, copy through SDK, preview duplicates/conflicts, merge and reload', async ({
  page,
}) => {
  const native = await nativeSimulator(page, JSON.stringify(original))
  await page.goto('/')
  await page.getByLabel('分类筛选').selectOption('personal')
  await page.getByRole('button', { name: '生成备份' }).click()
  const exported = JSON.parse(await page.getByLabel('备份 JSON', { exact: true }).inputValue())
  expect(exported.todos).toEqual(original)
  await page.getByRole('button', { name: '复制备份' }).click()
  await expect(page.getByText('备份已复制到剪贴板，请粘贴到文件或其他设备保存。')).toBeVisible()
  expect(
    native.requests.find((item) => item.action === 'system.clipboard.writeText')?.params.text,
  ).toContain('原有事项')
  await page.getByLabel('粘贴备份 JSON').fill(JSON.stringify([...original, incoming]))
  await page.getByRole('button', { name: '预览导入' }).click()
  await expect(page.getByText('新增 1 项 · 重复跳过 1 项 · 冲突保留现有 0 项')).toBeVisible()
  expect(native.writes()).toHaveLength(0)
  await page.getByRole('button', { name: '确认合并导入' }).click()
  await expect(page.getByText('备份导入已保存', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('.todo-list li')).toHaveCount(2)
  expect(JSON.parse(native.value)).toEqual([incoming, ...original])
  await page.getByLabel('粘贴备份 JSON').fill(JSON.stringify([{ ...original[0], done: true }]))
  await page.getByRole('button', { name: '预览导入' }).click()
  await expect(page.getByText('新增 0 项 · 重复跳过 0 项 · 冲突保留现有 1 项')).toBeVisible()
  await expect(page.getByRole('button', { name: '确认合并导入' })).toBeDisabled()
  expect(native.writes()).toHaveLength(1)
})
test('bad JSON does not write; failed save retains preview and retries', async ({ page }) => {
  const native = await nativeSimulator(page, JSON.stringify(original))
  await page.goto('/')
  await page.getByLabel('粘贴备份 JSON').fill('{bad')
  await page.getByRole('button', { name: '预览导入' }).click()
  await expect(page.getByText('请输入有效的 JSON 备份')).toBeVisible()
  expect(native.writes()).toHaveLength(0)
  await page.getByLabel('粘贴备份 JSON').fill(JSON.stringify([incoming]))
  await page.getByRole('button', { name: '预览导入' }).click()
  native.setWriteMode('fail')
  await page.getByRole('button', { name: '确认合并导入' }).click()
  await expect(page.getByRole('alert')).toContainText('SIMULATED_STORAGE_FAILURE')
  expect(native.value).toBe(JSON.stringify(original))
  await expect(page.getByRole('button', { name: '确认合并导入' })).toBeEnabled()
  native.setWriteMode('ok')
  await page.getByRole('button', { name: '确认合并导入' }).click()
  await expect(page.getByText('备份导入已保存', { exact: true })).toBeVisible()
})
test('changed todos invalidate preview, cancellation writes nothing', async ({ page }) => {
  const native = await nativeSimulator(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: '生成备份' })).toBeEnabled()
  await page.getByLabel('粘贴备份 JSON').fill(JSON.stringify([incoming]))
  await page.getByRole('button', { name: '预览导入' }).click()
  await page.getByRole('button', { name: '取消导入' }).click()
  expect(native.writes()).toHaveLength(0)
  await page.getByRole('button', { name: '预览导入' }).click()
  await page.getByLabel('新待办', { exact: true }).fill('预览后新任务')
  await page.getByRole('button', { name: '＋ 添加' }).click()
  await expect(page.getByText('待办已变化，请重新预览导入。')).toBeVisible()
  await expect(page.getByRole('button', { name: '确认合并导入' })).toHaveCount(0)
})
test('browser file import and JSON download round trip', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '生成备份' })).toBeEnabled()
  await page.getByLabel('选择 JSON 文件').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify([incoming])),
  })
  await expect(page.getByText('文件已读取，请预览导入。')).toBeVisible()
  await page.getByRole('button', { name: '预览导入' }).click()
  await page.getByRole('button', { name: '确认合并导入' }).click()
  await expect(page.getByText('备份导入已保存', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '生成备份' }).click()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载 JSON' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('runtime-todo-backup.json')
  const stream = await download.createReadStream()
  const chunks = []
  for await (const chunk of stream!) chunks.push(chunk)
  expect(JSON.parse(Buffer.concat(chunks).toString()).todos).toEqual([incoming])
  await page.reload()
  await expect(page.locator('.todo-title')).toHaveText('导入事项')
})
test('corrupt storage and uncertain save disable import', async ({ page }) => {
  const native = await nativeSimulator(page, JSON.stringify(original))
  await page.goto('/')
  await page.getByLabel('粘贴备份 JSON').fill(JSON.stringify([incoming]))
  await page.getByRole('button', { name: '预览导入' }).click()
  native.setWriteMode('invalid')
  await page.getByRole('button', { name: '确认合并导入' }).click()
  await expect(page.getByRole('alert')).toContainText('保存结果尚未确认')
  await expect(page.getByRole('button', { name: '确认合并导入' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '生成备份' })).toBeDisabled()
})
