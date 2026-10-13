import test from 'node:test'
import assert from 'node:assert/strict'
import { addTodo, decodeTodos, updateTodo, validDueDate, isOverdue, localToday } from './todos.ts'

test('empty storage and saved tasks decode', () => {
  assert.deepEqual(decodeTodos(undefined), [])
  const todos = addTodo([], '  第一件事  ', 'a')
  assert.deepEqual(decodeTodos(JSON.stringify(todos)), [
    { id: 'a', title: '第一件事', done: false },
  ])
})

test('legacy stored tasks retain their shape without an automatic migration write', () => {
  const old = [{ id: 'old', title: '旧事项', done: true }]
  assert.deepEqual(decodeTodos(JSON.stringify(old)), old)
})

test('edit preserves identity and completion, leaving unrelated tasks unchanged', () => {
  const old = [
    { id: 'a', title: 'old', done: true },
    { id: 'b', title: 'other', done: false },
  ]
  const next = updateTodo(old, 'a', {
    title: '  updated  ',
    category: 'work',
    dueDate: '2026-10-15',
  })
  assert.deepEqual(next[0], {
    id: 'a',
    title: 'updated',
    done: true,
    category: 'work',
    dueDate: '2026-10-15',
  })
  assert.equal(next[1], old[1])
  assert.equal(old[0].title, 'old')
  assert.deepEqual(decodeTodos(JSON.stringify(next)), next)
  assert.throws(() => updateTodo(old, 'missing', { title: 'x', category: 'personal', dueDate: '' }))
})

test('calendar dates distinguish leap years and reject malformed metadata', () => {
  for (const date of ['', '2024-02-29', '0001-01-01']) assert.equal(validDueDate(date), true)
  for (const date of ['2025-02-29', '2026-04-31', '2026-13-01', '2026-1-01', '0000-01-01', null])
    assert.equal(validDueDate(date), false)
  for (const metadata of [
    { category: 'unknown' },
    { category: '__proto__' },
    { dueDate: '2025-02-29' },
    { dueDate: null },
  ]) {
    assert.throws(() =>
      decodeTodos(JSON.stringify([{ id: 'a', title: 'task', done: false, ...metadata }])),
    )
  }
  assert.throws(() =>
    updateTodo([{ id: 'a', title: 'old', done: false }], 'a', {
      title: 'task',
      category: 'personal',
      dueDate: '2025-02-29',
    }),
  )
})

test('overdue uses calendar dates and excludes today, no date, and completed tasks', () => {
  const todo = { id: 'a', title: 'task', done: false, dueDate: '2026-10-12' }
  assert.equal(isOverdue(todo, '2026-10-13'), true)
  assert.equal(isOverdue(todo, '2026-10-12'), false)
  assert.equal(isOverdue({ ...todo, done: true }, '2026-10-13'), false)
  assert.equal(isOverdue({ ...todo, dueDate: '' }, '2026-10-13'), false)
  assert.equal(localToday(new Date(2026, 9, 13, 0, 1)), '2026-10-13')
})
test('corrupt data is rejected rather than silently replaced', () => {
  for (const value of ['null', '{}', '[{"id":"a","title":"x","done":"false"}]', 'broken'])
    assert.throws(() => decodeTodos(value))
  assert.throws(() =>
    decodeTodos('[{"id":"a","title":"x","done":false},{"id":"a","title":"y","done":true}]'),
  )
})
test('invalid titles and duplicate ids are rejected without mutating previous state', () => {
  const old = [{ id: 'a', title: 'old', done: true }]
  for (const title of ['', '  ', 'x'.repeat(121)]) assert.throws(() => addTodo(old, title, 'b'))
  assert.throws(() => addTodo(old, 'new', 'a'))
  assert.equal(addTodo(old, 'new', 'b').length, 2)
  assert.deepEqual(old, [{ id: 'a', title: 'old', done: true }])
})
