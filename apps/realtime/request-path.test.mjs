import assert from 'node:assert/strict'
import test from 'node:test'
import { isSocketIoRequest } from './request-path.ts'

test('the bridge router leaves Socket.IO requests to Socket.IO', () => {
  assert.equal(isSocketIoRequest('/socket.io/?EIO=4&transport=polling'), true)
  assert.equal(isSocketIoRequest('/broadcast'), false)
})
