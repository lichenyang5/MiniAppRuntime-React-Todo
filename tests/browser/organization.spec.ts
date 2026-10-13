import { expect, test } from '@playwright/test'
import { nativeSimulator } from './native-simulator'

test.use({ timezoneId: 'Asia/Shanghai', viewport: { width: 390, height: 844 } })
const legacy = JSON.stringify([{ id: 'legacy', title: '旧事项', done: true }])

test('edit legacy task, retain completion, and combine category/status filters after reload', async ({
  page,
}) => {
  const native = await nativeSimulator(page, legacy)
  await page.goto('/')
  await expect(page.getByText('旧事项', { exact: true })).toBeVisible()
  expect(native.writes()).toHaveLength(0)
  await page.getByRole('button', { name: '编辑：旧事项', exact: true }).click()
  await expect(page.getByLabel('编辑分类')).toHaveValue('personal')
  await expect(page.getByLabel('编辑截止日期')).toHaveValue('')
  await page.getByLabel('编辑内容').fill('修改后的事项')
  await page.getByLabel('编辑分类').selectOption('work')
  await page.getByLabel('编辑截止日期').fill('2026-10-15')
  await page.getByRole('button', { name: '保存修改' }).click()
  await expect(page.getByText('已更新待办', { exact: true })).toBeVisible()
  expect(JSON.parse(native.value)).toEqual([
    { id: 'legacy', title: '修改后的事项', done: true, category: 'work', dueDate: '2026-10-15' },
  ])
  await page.reload()
  await expect(page.getByText('修改后的事项', { exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox')).toBeChecked()
  await page.getByLabel('分类筛选').selectOption('work')
  await page.getByRole('button', { name: '已完成', exact: true }).click()
  await expect(page.locator('.todo-list li')).toHaveCount(1)
  await page.getByLabel('分类筛选').selectOption('personal')
  await expect(page.getByText('这个分类暂时没有待办。')).toBeVisible()
  expect(native.writes()).toHaveLength(1)
})

test('due date persists, overdue clears on completion, and removing date saves', async ({
  page,
}) => {
  const native = await nativeSimulator(page)
  await page.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'))
  await page.goto('/')
  await page.getByRole('textbox', { name: '新待办' }).fill('学习计划')
  await page.getByLabel('新增分类').selectOption('study')
  await page.getByLabel('新增截止日期').fill('2026-10-12')
  await page.getByRole('button', { name: '＋ 添加' }).click()
  await expect(page.getByText('已逾期 · 2026-10-12')).toBeVisible()
  await page.reload()
  await expect(page.getByText('已逾期 · 2026-10-12')).toBeVisible()
  await page.getByRole('checkbox').click()
  await expect(page.getByRole('checkbox')).toBeChecked()
  await expect(page.getByText('截止 · 2026-10-12')).toBeVisible()
  await expect(page.getByText(/已逾期/)).toHaveCount(0)
  await page.getByRole('button', { name: '编辑：学习计划', exact: true }).click()
  await page.getByLabel('编辑截止日期').fill('')
  await page.getByRole('button', { name: '保存修改' }).click()
  await expect(page.getByText('已更新待办', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('学习计划', { exact: true })).toBeVisible()
  expect(JSON.parse(native.value)[0]).toMatchObject({ category: 'study', dueDate: '', done: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})

test('cancelled edit leaves stored legacy task unchanged', async ({ page }) => {
  const native = await nativeSimulator(page, legacy)
  await page.goto('/')
  await page.getByRole('button', { name: '编辑：旧事项', exact: true }).click()
  await page.getByLabel('编辑内容').fill('不保存的修改')
  await page.getByRole('button', { name: '取消编辑' }).click()
  await expect(page.getByRole('region', { name: '编辑待办', exact: true })).toHaveCount(0)
  await expect(page.getByText('旧事项', { exact: true })).toBeVisible()
  expect(native.value).toBe(legacy)
  expect(native.writes()).toHaveLength(0)
})

test('failed edit retains draft and original data, then succeeds on retry', async ({ page }) => {
  const native = await nativeSimulator(page, legacy)
  native.setWriteMode('fail')
  await page.goto('/')
  await page.getByRole('button', { name: '编辑：旧事项', exact: true }).click()
  await page.getByLabel('编辑内容').fill('重试后的事项')
  await page.getByLabel('编辑分类').selectOption('work')
  await page.getByRole('button', { name: '保存修改' }).click()
  await expect(page.getByRole('alert')).toContainText('SIMULATED_STORAGE_FAILURE')
  await expect(page.getByLabel('编辑内容')).toHaveValue('重试后的事项')
  await expect(page.getByText('旧事项', { exact: true })).toBeVisible()
  expect(native.value).toBe(legacy)
  native.setWriteMode('ok')
  await page.getByRole('button', { name: '保存修改' }).click()
  await expect(page.getByText('已更新待办', { exact: true })).toBeVisible()
  await expect(page.getByText('重试后的事项', { exact: true })).toBeVisible()
  expect(JSON.parse(native.value)[0].done).toBe(true)
})

test('editing from a long mobile list reveals editor and restores trigger focus on cancel', async ({
  page,
}) => {
  const native = await nativeSimulator(
    page,
    JSON.stringify(
      Array.from({ length: 20 }, (_, index) => ({
        id: `long-${index}`,
        title: `长列表事项 ${index}`,
        done: false,
      })),
    ),
  )
  await page.goto('/')
  const trigger = page.getByRole('button', { name: '编辑：长列表事项 19', exact: true })
  await trigger.click()
  await expect(page.getByLabel('编辑内容')).toBeFocused()
  await expect(page.getByLabel('编辑内容')).toBeInViewport()
  await page.getByRole('button', { name: '取消编辑' }).click()
  await expect(trigger).toBeFocused()
  expect(native.writes()).toHaveLength(0)
})
