import test from 'node:test'
import assert from 'node:assert/strict'
import { addTodo, decodeTodos } from './todos.ts'

test('empty storage and saved tasks decode', () => {
  assert.deepEqual(decodeTodos(undefined), [])
  const todos = addTodo([], '  第一件事  ', 'a')
  assert.deepEqual(decodeTodos(JSON.stringify(todos)), [
    { id: 'a', title: '第一件事', done: false },
  ])
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
