import { expect, test } from '@playwright/test'
import { nativeSimulator } from './native-simulator'
const task = {
  id: 'native-file',
  title: '文件恢复事项',
  done: false,
  category: 'work',
  dueDate: '2026-10-15',
}
test('native export sends snapshot and selecting file requires preview then persist', async ({
  page,
}) => {
  const native = await nativeSimulator(page, JSON.stringify([task]))
  await page.goto('/')
  await page.getByRole('button', { name: '生成备份' }).click()
  await page.getByRole('button', { name: '保存 JSON 文件' }).click()
  await expect(page.getByText('备份文件已保存到选择的位置。')).toBeVisible()
  expect(JSON.parse(native.fileText).todos).toEqual([task])
  native.setFileText(JSON.stringify([{ ...task, id: 'second', title: '导入文件任务' }]))
  await page.getByRole('button', { name: '从文件导入' }).click()
  await expect(page.getByText('文件已读取，请预览导入。')).toBeVisible()
  expect(native.writes()).toHaveLength(0)
  await page.getByRole('button', { name: '预览导入' }).click()
  await page.getByRole('button', { name: '确认合并导入' }).click()
  await expect(page.getByText('备份导入已保存', { exact: true })).toBeVisible()
  expect(JSON.parse(native.value)).toHaveLength(2)
  await page.reload()
  await expect(page.locator('.todo-list li')).toHaveCount(2)
})
test('cancel and read failure preserve input and valid preview', async ({ page }) => {
  const native = await nativeSimulator(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: '从文件导入' })).toBeEnabled()
  const input = JSON.stringify([task])
  await page.getByLabel('粘贴备份 JSON').fill(input)
  await page.getByRole('button', { name: '预览导入' }).click()
  native.setFileMode('cancel')
  await page.getByRole('button', { name: '从文件导入' }).click()
  await expect(page.getByText('已取消文件选择，原内容保留。')).toBeVisible()
  await expect(page.getByLabel('粘贴备份 JSON')).toHaveValue(input)
  await expect(page.getByRole('button', { name: '确认合并导入' })).toBeEnabled()
  native.setFileMode('fail')
  await page.getByRole('button', { name: '从文件导入' }).click()
  await expect(page.getByText(/SIMULATED_FILE_FAILURE/)).toBeVisible()
  await expect(page.getByLabel('粘贴备份 JSON')).toHaveValue(input)
  expect(native.writes()).toHaveLength(0)
})
test('busy picker blocks mutations; malformed response pauses picker retries', async ({ page }) => {
  const native = await nativeSimulator(page)
  native.setFileMode('hold')
  await page.goto('/')
  await page.getByRole('button', { name: '从文件导入' }).click()
  await expect(page.getByLabel('新待办', { exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '从文件导入' })).toBeDisabled()
  native.releaseFiles()
  await expect(page.getByText('文件已读取，请预览导入。')).toBeVisible()
  native.setFileMode('invalid')
  await page.getByRole('button', { name: '从文件导入' }).click()
  await expect(page.getByText(/文件操作结果待确认/)).toBeVisible()
  await expect(page.getByRole('button', { name: '从文件导入' })).toBeDisabled()
  expect(native.writes()).toHaveLength(0)
})
test('corrupt native file cannot be imported', async ({ page }) => {
  const native = await nativeSimulator(page)
  native.setFileText('{broken')
  await page.goto('/')
  await page.getByRole('button', { name: '从文件导入' }).click()
  await expect(page.getByText('文件已读取，请预览导入。')).toBeVisible()
  await page.getByRole('button', { name: '预览导入' }).click()
  await expect(page.getByText('请输入有效的 JSON 备份')).toBeVisible()
  expect(native.writes()).toHaveLength(0)
})
