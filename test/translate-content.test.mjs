import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

test('审校允许源文与译文数字顺序不同', () => {
  const output = execFileSync(process.execPath, ['scripts/translate-content.mjs', '--self-test'], {
    encoding: 'utf8',
  })
  assert.match(output, /审校数字占位符自检通过/)
})
