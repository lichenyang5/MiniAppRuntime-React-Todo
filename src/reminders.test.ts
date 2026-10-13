import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeReminderStatus, localReminderTime, parseReminderTime } from './reminders.ts'
test('calendar validation rejects nonexistent dates and past times', () => {
  const now = new Date(2026, 9, 13, 12, 0).getTime()
  assert.throws(() => parseReminderTime('2026-02-30T12:30', now))
  assert.throws(() => parseReminderTime('2026-10-13T12:00', now))
  const valid = new Date(2026, 9, 13, 12, 2).getTime()
  assert.equal(parseReminderTime(localReminderTime(valid), now), valid)
})
test('reminder response rejects malformed state without inventing empty reminders', () => {
  assert.throws(() => decodeReminderStatus({ supported: true, notificationEnabled: true }))
  assert.throws(() =>
    decodeReminderStatus({
      supported: true,
      notificationEnabled: true,
      reminders: [{ taskId: 'a', title: 'task', atMs: NaN }],
    }),
  )
  assert.deepEqual(
    decodeReminderStatus({ supported: true, notificationEnabled: false, reminders: [] }),
    { supported: true, notificationEnabled: false, reminders: [] },
  )
})
