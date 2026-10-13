import { expect, test } from '@playwright/test'
import { nativeSimulator } from './native-simulator'
test('permission is explicit, OS reminders survive reload, completion cancels them', async ({
  page,
}) => {
  const native = await nativeSimulator(
    page,
    JSON.stringify([{ id: 'a', title: '提醒测试', done: false }]),
  )
  native.enableReminders()
  await page.goto('/')
  await expect(page.getByRole('button', { name: '开启通知' })).toBeVisible()
  expect(
    native.requests.some((request) => request.action === 'app.reminder.requestPermission'),
  ).toBe(false)
  await page.getByRole('button', { name: '开启通知' }).click()
  await expect(page.getByText('通知已开启', { exact: true })).toBeVisible()
  await page.getByLabel('提醒事项').selectOption('a')
  await page.getByRole('button', { name: '2分钟后' }).click()
  await page.getByRole('button', { name: '设置提醒' }).click()
  await expect(page.getByText('提醒已交给鸿蒙系统', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: '取消提醒：提醒测试' })).toBeVisible()
  await page.getByRole('checkbox').click()
  await expect(page.getByRole('checkbox')).toBeChecked()
  await expect(page.getByRole('button', { name: '取消提醒：提醒测试' })).toHaveCount(0)
  expect(native.reminders).toHaveLength(0)
})
test('cancel failure preserves todo; storage failure reports prior cancellation', async ({
  page,
}) => {
  const native = await nativeSimulator(
    page,
    JSON.stringify([{ id: 'a', title: '保留事项', done: false }]),
  )
  native.enableReminders(true)
  native.reminders.push({ taskId: 'a', title: '保留事项', atMs: Date.now() + 120000 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: '取消提醒：保留事项' })).toBeVisible()
  native.failCancel(true)
  await page.getByRole('button', { name: '删除：保留事项' }).click()
  await expect(page.getByRole('alert')).toContainText('SIMULATED_CANCEL_FAILURE')
  expect(native.writes()).toHaveLength(0)
  native.failCancel(false)
  native.setWriteMode('fail')
  await page.getByRole('button', { name: '删除：保留事项' }).click()
  await expect(page.getByRole('alert')).toContainText('提醒已取消')
  await expect(page.locator('.todo-title')).toHaveText('保留事项')
  expect(native.reminders).toHaveLength(0)
})
test('notification launch reveals and focuses filtered task', async ({ page }) => {
  const native = await nativeSimulator(
    page,
    JSON.stringify([{ id: 'a', title: '通知返回事项', done: false, category: 'work' }]),
  )
  native.enableReminders(true)
  await page.goto('/')
  await page.getByLabel('分类筛选').selectOption('personal')
  await expect(page.locator('.todo-list li')).toHaveCount(0)
  await page.evaluate(() => {
    ;(window as Window & { __todoReminderOpen__?: string }).__todoReminderOpen__ = JSON.stringify({
      taskId: 'a',
      token: 1,
    })
    window.dispatchEvent(new Event('todo-reminder-open'))
  })
  await expect(page.locator('#todo-a')).toBeFocused()
  await expect(page.locator('#todo-a')).toHaveClass(/reminder-target/)
  await page.getByLabel('提醒事项').focus()
  await page.evaluate(() => {
    ;(window as Window & { __todoReminderOpen__?: string }).__todoReminderOpen__ = JSON.stringify({
      taskId: 'a',
      token: 2,
    })
    window.dispatchEvent(new Event('todo-reminder-open'))
  })
  await expect(page.locator('#todo-a')).toBeFocused()
})
test('browser preview clearly reports reminders unsupported', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('当前环境不支持原生提醒，请在本项目的鸿蒙宿主中使用。')).toBeVisible()
})

test('restricted capability reports failure without inventing a reminder', async ({ page }) => {
  const native = await nativeSimulator(
    page,
    JSON.stringify([{ id: 'a', title: '权限测试', done: false }]),
  )
  native.enableReminders(true)
  native.failSchedule()
  await page.goto('/')
  await page.getByLabel('提醒事项').selectOption('a')
  await page.getByRole('button', { name: '2分钟后' }).click()
  await page.getByRole('button', { name: '设置提醒' }).click()
  await expect(
    page.getByText('代理提醒能力尚未开通，请更新 Profile', { exact: true }),
  ).toBeVisible()
  expect(native.reminders).toHaveLength(0)
  expect(native.writes()).toHaveLength(0)
})

test('cold launch payload waits for native todos and focuses its task', async ({ page }) => {
  await nativeSimulator(page, JSON.stringify([{ id: 'cold', title: '冷启动事项', done: false }]))
  await page.addInitScript(() => {
    ;(window as Window & { __todoReminderOpen__?: string }).__todoReminderOpen__ = JSON.stringify({
      taskId: 'cold',
      token: 1,
    })
  })
  await page.goto('/')
  await expect(page.locator('#todo-cold')).toBeFocused()
})
