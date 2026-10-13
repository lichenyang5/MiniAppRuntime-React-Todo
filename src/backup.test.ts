import assert from 'node:assert/strict'
import { test } from 'node:test'
import { decodeBackup, encodeBackup, planImport, MAX_BACKUP_BYTES } from './backup.ts'
const original = [
  { id: 'a', title: '任务', done: false, category: 'work' as const, dueDate: '2026-10-15' },
]
test('backup round trip retains identity, metadata and legacy arrays', () => {
  assert.deepEqual(decodeBackup(encodeBackup(original)), original)
  assert.deepEqual(decodeBackup('\uFEFF' + JSON.stringify(original)), original)
})
test('invalid and oversized backup never become an empty list', () => {
  for (const text of [
    '',
    '{}',
    '{"format":"miniappruntime-react-todo","version":2,"todos":[]}',
    '[{"id":"a","title":"任务","done":false,"dueDate":"2026-02-30"}]',
    '[{"id":"","title":"任务","done":false}]',
    JSON.stringify([original[0], original[0]]),
    ' '.repeat(MAX_BACKUP_BYTES + 1),
  ])
    assert.throws(() => decodeBackup(text))
})
test('merge preserves conflicts, skips identical and adds new IDs without mutating source', () => {
  const incoming = [...original, { ...original[0], id: 'b' }]
  const plan = planImport(original, incoming)
  assert.equal(plan.added, 1)
  assert.equal(plan.skipped, 1)
  assert.equal(plan.next[1], original[0])
  const conflict = planImport(original, [{ ...original[0], done: true }])
  assert.equal(conflict.conflicts.length, 1)
  assert.equal(conflict.next[0].done, false)
  assert.equal(original.length, 1)
  assert.equal(planImport(original, []).added, 0)
})

test('merged backup remains within the export byte limit', () => {
  const longTitle = '汉'.repeat(120)
  const left = Array.from({ length: 1500 }, (_, index) => ({
    id: 'a' + index,
    title: longTitle,
    done: false,
  }))
  const right = Array.from({ length: 1500 }, (_, index) => ({
    id: 'b' + index,
    title: longTitle,
    done: false,
  }))
  assert.ok(encodeBackup(left))
  assert.ok(encodeBackup(right))
  assert.throws(() => planImport(left, right), /1 MiB/)
})
