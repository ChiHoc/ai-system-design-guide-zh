import assert from 'node:assert/strict'
import test from 'node:test'
import { formatMathNotation, hasMathNotation, isFormulaFence } from '../.vitepress/math-notation.mjs'

test('识别公式围栏并排版上下标', () => {
  const attention = `Q = XW_Q
K = XW_K
V = XW_V

Attention(Q, K, V) = softmax(QK^T / √d_k) × V`

  assert.equal(isFormulaFence(attention), true)
  assert.equal(isFormulaFence('x = value  # Python assignment\nreturn x'), false)
  assert.equal(isFormulaFence('q1 = Embed("What") = [0.12, -0.34]'), false)
  assert.match(formatMathNotation(attention), /QK<sup>T<\/sup>/)
  assert.match(formatMathNotation(attention), /√d<sub>k<\/sub>/)
  assert.match(formatMathNotation('cost_per_task'), /cost<sub>per_task<\/sub>/)
  assert.equal(hasMathNotation('为什么要除以 √d_k？'), true)
})
